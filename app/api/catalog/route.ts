import { collectCatalog } from '@/lib/catalog';
let recent: {at:number;payload:Awaited<ReturnType<typeof collectCatalog>>} | undefined;
let running: ReturnType<typeof collectCatalog> | undefined;
export async function GET() {
  const headers={'Cache-Control':'no-store'};
  if(recent && Date.now()-recent.at<60000) return Response.json({...recent.payload,reused:true},{headers});
  running ??= collectCatalog();
  try {const payload=await running;recent={at:Date.now(),payload};return Response.json(payload,{headers});}
  catch {return Response.json({error:'Consulta indisponível; preserve os dados locais.'},{status:502,headers});}
  finally {running=undefined;}
}
