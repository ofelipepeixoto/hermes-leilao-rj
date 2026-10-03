/** Regras determinísticas. Valores desconhecidos permanecem pendentes. */
export const normalize = (v: unknown) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
export function safeUrl(v: unknown): string {
  try { const u = new URL(String(v)); return u.protocol === 'https:' && !u.username && !u.password ? u.href : ''; } catch { return ''; }
}
export function money(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? v : NaN;
  let s = String(v ?? '').trim().replace(/R\$\s*/g, '').replace(/\s/g, '');
  if (!s || !/^[\d.,]+$/.test(s)) return NaN;
  if (s.includes(',')) {
    if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+),\d{1,2}$/.test(s)) return NaN;
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(?:\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  else if (!/^\d+(?:\.\d{1,2})?$/.test(s)) return NaN;
  const n = Number(s); return Number.isFinite(n) && n >= 0 ? n : NaN;
}
export const financeFields = ['arv','margin','bid','commissionPct','itbi','registry','capex','carry','selling','legal','contingency','taxes','debts','dispossession','marketing','opexAllocated','months','capital','committed','workingCapital','opexMonthly','postDistributionReserve'] as const;
export function calculate(f: Record<string, number>) {
  const missing = financeFields.filter(k => !Number.isFinite(f[k]) || f[k] < 0);
  const nonBid = ['itbi','registry','capex','carry','selling','legal','contingency','taxes','debts','dispossession','marketing'].reduce((s,k)=>s+f[k],0);
  const costs = f.bid * (1 + f.commissionPct / 100) + nonBid;
  const mao = Math.floor(Math.max(0, (f.arv * (1 - Math.max(30,f.margin) / 100) - nonBid) / (1 + f.commissionPct / 100)) * 100) / 100;
  const projected = (f.arv - costs) / f.arv;
  const loadedMargin = (f.arv - costs - f.opexAllocated) / f.arv;
  const roi = (f.arv - costs) / costs;
  const concentration = costs / f.capital;
  const remaining = Math.min(f.workingCapital, f.capital - f.committed) - costs;
  const reasons: string[] = [];
  if (!missing.length && ![costs, mao, projected, loadedMargin, roi, concentration, remaining].every(Number.isFinite)) {
    reasons.push('Cálculo fora do intervalo numérico válido; revise as premissas');
  }
  if(missing.length) reasons.push('Premissas ausentes ou inválidas: '+missing.map(k=>({arv:'saída conservadora',margin:'margem alvo',bid:'lance',commissionPct:'comissão',itbi:'ITBI',registry:'registro',capex:'reforma',carry:'carregamento',selling:'corretagem',legal:'jurídico',contingency:'contingência',taxes:'tributos',debts:'débitos',dispossession:'desocupação',marketing:'comercialização',opexAllocated:'OPEX rateado',months:'prazo',capital:'capital',committed:'giro comprometido',workingCapital:'caixa livre',opexMonthly:'OPEX mensal',postDistributionReserve:'reserva'}[k])).join(', '));
  if(Number.isFinite(f.arv) && !(f.arv >= 180000 && f.arv <= 350000)) reasons.push('Saída conservadora fora de R$180–350 mil');
  if(Number.isFinite(f.margin) && !(f.margin >=30 && f.margin<100)) reasons.push('Margem alvo deve ser de 30% a menos de 100%');
  if(['bid','capital','arv','months','opexMonthly'].some(k=>Number.isFinite(f[k]) && f[k]<=0)) reasons.push('Lance, capital, saída, prazo e OPEX precisam ser positivos');
  if(f.commissionPct>100) reasons.push('Comissão inválida: acima de 100%');
  if(f.committed>f.capital || f.workingCapital>f.capital) reasons.push('Giro comprometido ou caixa livre excede o capital imobiliário');
  if(Number.isFinite(projected) && Number.isFinite(mao) && !(projected >= .3 && costs / f.arv <= .7 && f.bid <= mao)) reasons.push('Margem direta, custo máximo ou MAO não atendido');
  if(Number.isFinite(f.months) && !(f.months <=9)) reasons.push('Ciclo acima de 9 meses');
  if(Number.isFinite(concentration) && !(concentration <=.2)) reasons.push('Concentração do ativo acima de 20%');
  if(Number.isFinite(remaining) && !(remaining >= f.capital*.25)) reasons.push('Folga de giro após aquisição abaixo de 25%');
  if(Number.isFinite(f.postDistributionReserve) && Number.isFinite(f.opexMonthly) && !(f.postDistributionReserve >= f.opexMonthly*12)) reasons.push('Reserva inferior a 12 meses de OPEX');
  return { costs,mao,projected,loadedMargin,roi,concentration,remaining,missing,reasons,pass:reasons.length===0 };
}
export function validDate(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function evidenceValid(e: {quarantine?:string;expiry?:string;confidence?:string;reviewer?:string;hash?:string;source?:string}, today:string) {
 return e.quarantine==='Revisado' && validDate(e.expiry) && validDate(today) && e.expiry>=today && e.confidence==='Alta' && !!e.reviewer?.trim() && !/revis[aã]o humana/i.test(e.reviewer) && /^[a-f0-9]{64}$/.test(e.hash||'') && !!e.source?.trim();
}
export const sourceRow = Symbol("sourceRow");
export function rowsFromMatrix(matrix: unknown[][]): Record<string,unknown>[] {
 const header = matrix.findIndex(row => row.some(v=>['id','codigo','nimovel','ndoimovel','numeroimovel','numerodoimovel','identificador'].includes(normalize(v))) && row.some(v=>['url','link','linkdoimovel','linkdeacesso','endereco','nome','descricao'].includes(normalize(v))));
 const fallback = matrix.findIndex(row => row.some(v=>['nome','endereco','imovel'].includes(normalize(v))) && row.some(v=>['cidade','municipio','url','link'].includes(normalize(v))));
 const i = header>=0?header:fallback;
 if(i<0) throw new Error('Cabeçalho não reconhecido. Use ID e Nome/Endereço/URL, ou Nome e Cidade');
 const columns = matrix[i].map(normalize).filter(Boolean);
 if (new Set(columns).size !== columns.length) throw new Error('Cabeçalhos repetidos. Use um nome único para cada coluna');
 if(matrix.length-i>10001) throw new Error('Limite de 10.000 linhas por importação');
 return matrix.slice(i+1).map((row,index)=>({row,line:i+index+2})).filter(({row})=>row.some(v=>String(v??'').trim())).map(({row,line})=>Object.assign(Object.fromEntries(matrix[i].map((key,j)=>[String(key??''),row[j]??''])),{[sourceRow]:line}));
}
export function invalidateDecision() { return {memo:false,audit:'PENDENTE' as const,approval1:false,approval2:false}; }

export function importIdentity(source: string, url: string, fileName: string, code: string) {
  const origin = source.trim() || (safeUrl(url) ? new URL(url).hostname : fileName);
  return "import-"+encodeURIComponent(origin.trim().toLowerCase())+"-"+encodeURIComponent(code.trim());
}
export function catalogCurrent(item: {pipelineOrigin?:string;catalogStatus?:string;capturedAt?:string;auctionAt?:string}, at=Date.now()) {
  if(item.pipelineOrigin!=="verified-catalog")return false;
  const captured=Date.parse(item.capturedAt||""); const auction=Date.parse(item.auctionAt||"");
  return item.catalogStatus==="Triagem · consulta atual" && captured<=at && at-captured<=86400000 && auction>at;
}
