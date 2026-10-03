import { calculate, catalogCurrent, normalize } from './domain.ts';
export type SelectionItem = {id:string;name:string;city:string;source:string;url:string;stage:string;propertyType?:string;observedBid?:number|null;auctionAt?:string;capturedAt?:string;catalogStatus?:string;pipelineOrigin?:string;favorite?:boolean;finance:Record<string,number>};
export const announcedPrice = (item:SelectionItem) => Number.isFinite(item.observedBid) && Number(item.observedBid)>0 ? Number(item.observedBid) : item.pipelineOrigin==='manual' && Number.isFinite(item.finance.bid) && item.finance.bid>0 ? item.finance.bid : NaN;
export function selectionStatus(item:SelectionItem, at=Date.now()) {
  if(item.propertyType && !['Apartamento','Pendente'].includes(item.propertyType))return 'Fora do perfil';
  if(item.city && !['rj','pendente','riodejaneiro','riodejaneirorj'].includes(normalize(item.city)))return 'Fora do perfil';
  if(item.auctionAt && Number.isFinite(Date.parse(item.auctionAt)) && Date.parse(item.auctionAt)<=at)return 'Evento passado';
  if(item.pipelineOrigin==='verified-catalog' && !catalogCurrent(item,at))return 'Revalidar fonte';
  const r=calculate(item.finance);
  if(r.missing.length)return 'Completar análise';
  if(!r.pass || (Number.isFinite(announcedPrice(item)) && item.finance.bid<announcedPrice(item)))return 'Rever viabilidade';
  if(!catalogCurrent(item,at))return 'Revalidar fonte';
  return 'Revisar documentos';
}
export type Filters = {query:string;source:string;city:string;type:string;maxPrice:string;includeUnknown:boolean;status:string;favoritesOnly:boolean;sort:string};
export function selectOpportunities<T extends SelectionItem>(items:T[],f:Filters,at=Date.now()):T[] {
  return items.filter(item=>normalize([item.id,item.name,item.city,item.source,item.stage,item.url].join(' ')).includes(normalize(f.query)) &&
    (!f.source||item.source===f.source) && (!f.city||normalize(item.city)===normalize(f.city)) && (!f.type||item.propertyType===f.type) &&
    (!f.status||selectionStatus(item,at)===f.status) && (!f.favoritesOnly||item.favorite) &&
    (Number.isFinite(announcedPrice(item))?(!f.maxPrice||announcedPrice(item)<=Number(f.maxPrice)):f.includeUnknown))
    .sort((a,b)=>{
      const value=(i:T)=>f.sort==='price'?announcedPrice(i):Date.parse(i.auctionAt||'');
      if(f.sort==='name')return a.name.localeCompare(b.name,'pt-BR');
      const av=value(a),bv=value(b);
      return (Number.isFinite(av)&&Number.isFinite(bv)?av-bv:Number.isFinite(av)?-1:Number.isFinite(bv)?1:0)||a.id.localeCompare(b.id);
    });
}
