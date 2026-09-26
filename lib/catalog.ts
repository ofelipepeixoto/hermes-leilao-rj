import { money, safeUrl } from './domain.ts';
export const LISTINGS = [
 {name:'Zuk RJ',url:'https://www.portalzuk.com.br/leilao-de-imoveis/u/todos-imoveis/rj',host:'www.portalzuk.com.br',key:'zuk'},
 {name:'Mega Leilões RJ',url:'https://www.megaleiloes.com.br/imoveis/apartamentos/rj',host:'www.megaleiloes.com.br',key:'mega'},
] as const;
export type Candidate = {externalId:string;name:string;city:string;source:string;url:string;bid:number;auctionAt:string;capturedAt:string;note:string;snapshotHash?:string};
const decode=(v:string)=>v.replace(/&amp;/g,'&').replace(/&#0*39;|&apos;/g,"'").replace(/&quot;/g,'"').replace(/&nbsp;/g,' ');
const text=(s:string)=>decode(s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim();
function date(v:string) { const m=v.match(/(\d{2})\/(\d{2})\/(\d{4})\s*(?:às|as)?\s*(\d{2}):(\d{2})/); if(!m)return '';const iso=`${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:00-03:00`;const d=new Date(iso);return Number.isFinite(d.getTime()) && new Date(d.getTime()-3*3600000).toISOString().slice(0,10)===iso.slice(0,10)?iso:''; }
export function parseListing(html:string,key:'zuk'|'mega',at:string):Candidate[] {
 const source=LISTINGS.find(s=>s.key===key)!;
 const chunks = key==='zuk'?html.split(/<div\s+class="card-property card_lotes_div"/i).slice(1):html.split(/<div[^>]*\bdata-key="\d+"[^>]*>/i).slice(1);
 const result = new Map<string,Candidate>();
 for(const card of chunks) {
  const link=card.match(key==='zuk'?/href=["']([^"']*\/imovel\/rj\/rio-de-janeiro\/[^"']+)["']/i:/href=["']([^"']*\/imoveis\/apartamentos\/rj\/rio-de-janeiro\/[^"']+)["']/i)?.[1];
  const url=safeUrl(decode(link||'')); if(!url || new URL(url).host!==source.host)continue;
  const canonical=new URL(url);canonical.search='';canonical.hash='';
  const type = key==='zuk'? text(card.match(/class="card-property-price-lote"[^>]*>([\s\S]*?)<\/span>/i)?.[1]||''):'Apartamento';
  if(!/^Apartamento$/i.test(type))continue;
  if(key==='mega'&&!/class="card\s+open"/i.test(card))continue;
  const title=key==='mega'? text(card.match(/class="card-title"[^>]*>([\s\S]*?)<\/a>/i)?.[1]||''): 'Apartamento — '+text(card.match(/<address[^>]*>([\s\S]*?)<\/address>/i)?.[1]||'');
  const events: {bid:number;at:string}[]=[];
  if(key==='zuk') {
   for(const m of card.matchAll(/class="card-property-price-value"[^>]*>\s*R\$\s*([\d.,]+)[\s\S]*?class="card-property-price-data"[^>]*>([^<]+)/gi)) events.push({bid:money(m[1]),at:date(text(m[2]))});
  } else {
   const bid=money(text(card.match(/class="card-price"[^>]*>([\s\S]*?)<\/div>/i)?.[1]||''));
   for(const m of card.matchAll(/class="card-(?:first|second)-instance-date"[^>]*>([\s\S]*?)<\/span>/gi))events.push({bid,at:date(text(m[1]))});
  }
  const event=events.filter(e=>e.at && Date.parse(e.at)>Date.parse(at) && e.bid>0 && e.bid<=245000).sort((a,b)=>a.bid-b.bid)[0];
  if(!event || !title.trim())continue;
  const id=key==='mega' ? canonical.pathname.match(/x\d+$/i)?.[0] : canonical.pathname.split('/').pop(); if(!id)continue;
  result.set(canonical.href,{externalId:key+'-'+id,name:title,city:'Rio de Janeiro/RJ',source:source.name,url:canonical.href,bid:event.bid,auctionAt:event.at,capturedAt:at,note:'Preço e data extraídos da listagem pública. Faixa de saída, custos, edital e disponibilidade exigem revisão. Município inicial: Rio de Janeiro.'});
 }
 return [...result.values()];
}
export function detailEligible(html:string,key:'zuk'|'mega') {
 const heading=text(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]||'');
 if(!/apartamento/i.test(heading))return false;
 const cls=key==='zuk'?'card-action-header-title':'instance-text';
 const status=text(html.match(new RegExp('class="'+cls+'"[^>]*>([\\s\\S]*?)<\\/div>','i'))?.[1]||'');
 if(!status || /encerrad|cancelad|suspens|vendido|arrematado/i.test(status))return false;
 return key==='zuk'? /encerra em|em leil[aã]o/i.test(status) : /aberto para lances/i.test(status);
}
export function blockedPage(html:string) {return /<title[^>]*>\s*(?:Just a moment|Access Denied|Verifica)/i.test(html) || /(?:verify you are human|verifique que voc[eê] [eé] humano|automated requests|access denied|request blocked)/i.test(text(html));}
export async function readPublic(url:string,host:string,fetcher:typeof fetch=fetch) {
 let current=new URL(url);
 for(let n=0;n<3;n++) {
  if(current.protocol!=='https:'||current.host!==host||current.username||current.password)throw new Error('Redirecionamento fora da fonte permitida');
  const r=await fetcher(current.href,{headers:{Accept:'text/html','User-Agent':'Hermes-Leilao-RJ/0.2 (public-read-only)'},redirect:'manual',signal:AbortSignal.timeout(8000)});
  if(r.status>=300&&r.status<400){const target=r.headers.get('location');if(!target)throw new Error('Redirecionamento sem destino');current=new URL(target,current);continue;}
  if(!r.ok)throw new Error('Fonte respondeu HTTP '+r.status);
  if(!/text\/html/i.test(r.headers.get('content-type')||''))throw new Error('Conteúdo não HTML');
  const reader=r.body?.getReader();if(!reader)throw new Error('Resposta vazia');let size=0;const chunks:Uint8Array[]=[];
  try {while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>2_000_000)throw new Error('Página excede limite de 2 MB');chunks.push(part.value);}} catch(e){await reader.cancel();throw e;}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  const html=new TextDecoder().decode(bytes);if(blockedPage(html))throw new Error('Fonte exige verificação de acesso');return html;
 }
 throw new Error('Limite de redirecionamentos');
}
export async function collectCatalog(fetcher:typeof fetch=fetch,at=new Date().toISOString()) {
 const sources=[];const catalog:Candidate[]=[];
 for(const source of LISTINGS) {
  try {
   const html=await readPublic(source.url,source.host,fetcher); const candidates=parseListing(html,source.key,at);
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(html)))).map(v=>v.toString(16).padStart(2,'0')).join('');
   let checked=0, failed=0, ineligible=0;
   // Bounded requests. An incomplete scan never becomes a claim of complete coverage.
   for(let i=0;i<Math.min(candidates.length,20);i+=4) {
    const group=await Promise.all(candidates.slice(i,Math.min(i+4,20)).map(async item=> {
     try {const detail=await readPublic(item.url,source.host,fetcher);checked++;
      if(!detailEligible(detail,source.key)){ineligible++;return null;}
      return {...item,snapshotHash:hash,note:item.note+' Página individual acessível; consulta parcial, máximo 20 detalhes por fonte.'};
     }catch{failed++;return null;}
    }));catalog.push(...group.filter((c):c is Candidate & {snapshotHash:string}=>c!==null));
   }
   sources.push({name:source.name,url:source.url,mode:'listagem pública',checkedAt:at,status:failed>0 && checked===0?'indisponível':'consultada',message:`Cobertura parcial: ${candidates.length} candidatos na página; ${checked} detalhes acessíveis, ${ineligible} sem condição ativa confirmada, ${failed} falhas de detalhe; máximo 20. Sem paginação. Zero resultados não comprova ausência de oportunidades.`,snapshotHash:hash});
  }catch(e){sources.push({name:source.name,url:source.url,mode:'listagem pública',checkedAt:at,status:'indisponível',message:e instanceof Error && /Fonte respondeu HTTP|Fonte exige|limite|Redirecionamento|Conteúdo não HTML/.test(e.message)?e.message:'Não foi possível consultar esta fonte neste ambiente. Tente novamente mais tarde; o histórico foi preservado.'});}
 }
 const pending=[
 ['CAIXA','https://venda-imoveis.caixa.gov.br/sistema/download-lista.asp','Importação manual. Busca restrita não é consultada.'],
 ['Santander Imóveis','https://www.santanderimoveis.com.br/','Adaptador pendente de homologação. Não consultado.'],
 ['Itaú Imóveis','https://www.itau.com.br/leiloes-imoveis','Adaptador pendente de homologação. Não consultado.'],
 ['TJRJ — cadastro de leiloeiros','https://cgj.tjrj.jus.br/','Referência de homologação, não é catálogo de imóveis. Não consultado.']
 ];
 for(const [name,url,message] of pending)sources.push({name,url,mode:'ação humana / pendente',checkedAt:at,status:'pendente',message});
 return {checkedAt:at,sources,catalog,catalogAdded:catalog.length,coverage:'partial',note:'Triagem de apartamentos do município do Rio. Até R$245 mil de preço mínimo é apenas condição necessária para saída de até R$350 mil; ARV e demais gates permanecem pendentes.'};
}
