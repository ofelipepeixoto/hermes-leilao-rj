import test from 'node:test';
import assert from 'node:assert/strict';
import {calculate,financeFields,money,rowsFromMatrix,safeUrl,evidenceValid} from '../lib/domain.ts';
import {parseListing,detailEligible,readPublic,blockedPage} from '../lib/catalog.ts';
const base=()=>({...Object.fromEntries(financeFields.map(k=>[k,0])),arv:300000,margin:30,bid:85000,commissionPct:5,itbi:7762.425,registry:5000,capex:30000,carry:10000,selling:15000,legal:5000,contingency:5000,taxes:9000,debts:2324,months:9,capital:1500000,workingCapital:1500000,opexMonthly:30000,postDistributionReserve:360000});
test('MAO reconcilia margem de 30% incluindo comissão',()=>{const f=base();const r=calculate(f);const onMao=calculate({...f,bid:r.mao});assert.ok(onMao.projected>=.3 && onMao.projected<.300001);assert.equal(r.pass,true);assert.notEqual(r.roi,r.projected);});
test('golden Holding: custos não-lance de 94.086,425 e MAO correto',()=>{const f={...base(),itbi:94086.425,registry:0,capex:0,carry:0,selling:0,legal:0,contingency:0,taxes:0,debts:0};const r=calculate(f);assert.ok(Math.abs(r.mao-110393.88095238)<.001);assert.ok(Math.abs(r.costs-183336.425)<.001);});
test('ausente, negativo, capital zero e margem inválida bloqueiam',()=>{for(const field of financeFields){assert.equal(calculate({...base(),[field]:NaN}).pass,false);assert.equal(calculate({...base(),[field]:-1}).pass,false);}assert.equal(calculate({...base(),capital:0}).pass,false);assert.equal(calculate({...base(),margin:100}).pass,false);});
test('ARV é faixa de saída, prazo até 9m e giro após nova aquisição',()=>{assert.equal(calculate({...base(),arv:179999}).pass,false);assert.equal(calculate({...base(),months:10}).pass,false);assert.equal(calculate({...base(),workingCapital:375000}).pass,false);});
test('compromissos de outros ativos não viram concentração deste ativo',()=>{const r=calculate({...base(),committed:600000});assert.equal(r.concentration,r.costs/1500000);});
test('moeda brasileira e ausências',()=>{assert.equal(money('R$ 180.000'),180000);assert.equal(money('R$ 180.000,50'),180000.5);assert.equal(money(180000),180000);assert.ok(Number.isNaN(money('')));assert.ok(Number.isNaN(money('pendente')));assert.ok(Number.isNaN(money('-12')));});
test('cabeçalho CAIXA após preâmbulo e linhas vazias',()=>{const r=rowsFromMatrix([['Lista de imóveis'],[],['N° do imóvel','UF','Cidade','Endereço','Preço','Link de acesso'],['123','RJ','Rio de Janeiro','Rua fictícia','100.000','https://example.org/lote']]);assert.equal(r.length,1);assert.equal(r[0]['N° do imóvel'],'123');assert.throws(()=>rowsFromMatrix([['qualquer','coisa']]));});
test('URLs executáveis, credenciais e protocolo inseguro são rejeitados',()=>{for(const u of ['javascript:alert(1)','data:text/html,x','http://example.org','https://user:pass@example.org'])assert.equal(safeUrl(u),'');assert.equal(safeUrl('https://example.org/lote'),'https://example.org/lote');});
test('quarentena, validade, confiança e revisor são obrigatórios',()=>{const e={quarantine:'Revisado',expiry:'2030-01-01',confidence:'Alta',reviewer:'Pessoa teste',source:'Fonte teste',hash:'a'.repeat(64)};assert.equal(evidenceValid(e,'2026-09-26'),true);for(const patch of [{expiry:''},{expiry:'2020-01-01'},{quarantine:'Em quarentena'},{confidence:'Baixa'},{reviewer:'Revisão humana'}])assert.equal(evidenceValid({...e,...patch},'2026-09-26'),false);});
const card=(type='Apartamento',price='100.000,00',date='29/09/2026 às 10:00')=>`<div class="card-property card_lotes_div"><a href="https://www.portalzuk.com.br/imovel/rj/rio-de-janeiro/teste/rua-ficticia/1-2"></a><span class="card-property-price-lote">${type}</span><address>Rio de Janeiro / RJ - Rua fictícia</address><span class="card-property-price-value">R$ ${price}</span><span class="card-property-price-data">${date}</span></div>`;
test('descoberta extrai URL/preço/data; recusa tipo, data passada e preço inviável',()=>{const at='2026-09-26T00:00:00Z';const r=parseListing(card(),'zuk',at);assert.equal(r.length,1);assert.equal(r[0].bid,100000);assert.equal(parseListing(card('Casa'),'zuk',at).length,0);assert.equal(parseListing(card('Apartamento','300.000,00'),'zuk',at).length,0);assert.equal(parseListing(card('Apartamento','100.000,00','01/01/2020 às 10:00'),'zuk',at).length,0);});
test('cancelado fora do título e status ausente não são elegíveis',()=>{assert.equal(detailEligible('<h1>Apartamento</h1><div class="instance-text">LEILÃO CANCELADO</div>','mega'),false);assert.equal(detailEligible('<h1>Apartamento</h1><div class="auction-status">LEILÃO CANCELADO</div>','mega'),false);assert.equal(detailEligible('<h1>Apartamento</h1><div class="instance-text">Aberto para lances</div>','mega'),true);assert.equal(detailEligible('<h1>Apartamento</h1><div class="card-action-header-title">Encerra em 29/09/26</div>','zuk'),true);});
test('script recaptcha sozinho não prova bloqueio',()=>{assert.equal(blockedPage('<script src="recaptcha.js"></script><h1>Imóveis</h1>'),false);assert.equal(blockedPage('<title>Just a moment</title>'),true);});
test('redirecionamento externo e conteúdo excessivo falham fechados',async()=>{await assert.rejects(readPublic('https://www.portalzuk.com.br/test','www.portalzuk.com.br',async()=>new Response('',{status:302,headers:{location:'https://evil.example/'}})));await assert.rejects(readPublic('https://www.portalzuk.com.br/test','www.portalzuk.com.br',async()=>new Response('x'.repeat(2000001),{headers:{'content-type':'text/html'}})));});


test('identidades de fontes diferentes e arquivos sem fonte não colidem', async()=> {
 const {importIdentity}=await import('../lib/domain.ts');
 assert.notEqual(importIdentity('', 'https://a.example/lote/1','a.csv','1'),importIdentity('', 'https://b.example/lote/1','b.csv','1'));
 assert.notEqual(importIdentity('', '', 'a.csv','1'),importIdentity('', '', 'b.csv','1'));
});
test('catálogo exige revalidação recente e leilão futuro', async()=> {
 const {catalogCurrent}=await import('../lib/domain.ts');const at=Date.parse('2026-09-26T12:00:00Z');
 const item={pipelineOrigin:'verified-catalog',catalogStatus:'Triagem · consulta atual',capturedAt:'2026-09-26T11:00:00Z',auctionAt:'2026-09-27T12:00:00Z'};
 assert.equal(catalogCurrent(item,at),true);
 assert.equal(catalogCurrent({...item,catalogStatus:'Não revalidado nesta consulta'},at),false);
 assert.equal(catalogCurrent({...item,auctionAt:'2026-09-25T12:00:00Z'},at),false);
 assert.equal(catalogCurrent({...item,capturedAt:'2026-09-24T12:00:00Z'},at),false);
});

test('leitor atualizado preserva moeda e cabeçalho em CSV e XLSX',async()=>{
 const XLSX=await import('xlsx');
 const matrix=[['ID','Nome','Cidade','Preço'],['001','Apartamento fictício','Rio de Janeiro','180.000,50']];
 const sheet=XLSX.utils.aoa_to_sheet(matrix);const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,sheet,'Lista');
 for(const kind of ['xlsx','csv']) {
  const bytes=XLSX.write(book,{bookType:kind,type:kind==='csv'?'string':'buffer'});
  const read=XLSX.read(bytes,{type:kind==='csv'?'string':'buffer',raw:true});
  const rows=rowsFromMatrix(XLSX.utils.sheet_to_json(read.Sheets[read.SheetNames[0]],{header:1,defval:''}));
  assert.equal(rows[0].Nome,'Apartamento fictício');assert.equal(money(rows[0]['Preço']),180000.5);
 }
});
