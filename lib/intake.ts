import { importIdentity, money, normalize, safeUrl, sourceRow } from './domain.ts';

export type IntakeRow = { row: number; id: string; name: string; city: string; source: string; url: string; propertyType: string; observedBid: number; warnings: string[] };
export type IntakePlan = { fileName: string; rows: IntakeRow[]; rejected: {row:number;reason:string}[]; duplicates:number; total:number };
export const valueFrom = (row: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const match = Object.keys(row).find(k => normalize(k) === normalize(key));
    if (match !== undefined && String(row[match] ?? '').trim()) return String(row[match]).trim();
  }
  return '';
};
/** Each row is inspectable before mutation. Unknown prices are never zero. */
export function prepareIntake(rows: Record<string,unknown>[], fileName: string, firstRow = 2): IntakePlan {
  const plan: IntakePlan = { fileName, rows: [], rejected: [], duplicates: 0, total: rows.length };
  const seen = new Map<string, IntakeRow>();
  rows.forEach((row, index) => {
    const line = (row as Record<symbol,number>)[sourceRow] || firstRow + index;
    const val = (keys:string[]) => valueFrom(row,keys);
    const name = val(['Nome','Imóvel','Endereço','Descrição']);
    const code = val(['ID','Código','Número do imóvel','N° do imóvel','N imóvel','Identificador']);
    const rawUrl = val(['URL','Link','Link do imóvel','Link de acesso','Página']);
    const url = safeUrl(rawUrl);
    if (rawUrl && !url) { plan.rejected.push({row:line,reason:'Link inválido. Use endereço HTTPS sem credenciais.'}); return; }
    if (!code && !url) { plan.rejected.push({row:line,reason:'Falta ID ou link estável para evitar duplicação.'}); return; }
    const city = val(['Cidade','Município']); const uf = val(['UF','Estado']).toUpperCase();
    const source = val(['Fonte','Origem']) || (url ? new URL(url).hostname : fileName);
    const id = importIdentity(source,url,fileName,code || url);
    const type = normalize(val(['Tipo de imóvel','Tipo','Descrição']) || name);
    const propertyType = type.startsWith('apartamento') || type === 'apto' ? 'Apartamento' : type.startsWith('casa') ? 'Casa' : 'Pendente';
    const observedBid = money(val(['Preço','Preço de venda','Lance mínimo','Valor']));
    const warnings: string[] = [];
    if (!city) warnings.push('Município ausente');
    if (uf && !['RJ','RIO DE JANEIRO'].includes(uf)) warnings.push('Fora do estado do RJ');
    if (!Number.isFinite(observedBid) || observedBid <= 0) warnings.push('Preço pendente ou inválido');
    if (propertyType==='Pendente') warnings.push('Tipo do imóvel precisa de revisão');
    if (!url) warnings.push('Link da fonte ausente');
    warnings.push('Vigência e disponibilidade precisam de conferência');
    const item: IntakeRow = {row:line,id,name:name||`Imóvel ${code}`,city:city ? city+(uf&&!city.endsWith('/'+uf)?'/'+uf:'') : 'Pendente',source,url,propertyType,observedBid:observedBid>0?observedBid:NaN,warnings};
    const key = url || id;
    const previous=seen.get(key);
    if (previous) {
      if (previous.id===item.id && previous.name===item.name && previous.city===item.city && previous.propertyType===item.propertyType && Object.is(previous.observedBid,item.observedBid)) {plan.duplicates++;return;}
      plan.rejected.push({row:line,reason:`Conflito com a linha ${previous.row}: mesmo ID/link com dados diferentes. Corrija antes de importar.`});
      if (plan.rows.includes(previous)) {plan.rows=plan.rows.filter(r=>r!==previous);plan.rejected.push({row:previous.row,reason:`Conflito com a linha ${line}: registro preservado fora da importação.`});}
      return;
    }
    // Same code at different URLs remains separate, never overwriting the other lot.
    const collision=plan.rows.find(r=>r.id===id && r.url!==url);
    if(collision) item.id=id+'-'+encodeURIComponent(url);
    seen.set(key,item);plan.rows.push(item);
  });
  return plan;
}
