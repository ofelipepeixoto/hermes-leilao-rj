import test from 'node:test';
import assert from 'node:assert/strict';
import { createBackup, verifyBackup, prepareRecovery, commitRecovery, sha256 } from '../lib/backup.ts';
import { checkApproved, checkEvidenceValid, prepareManualVerification } from '../lib/review.ts';
import { catalogCurrent, financeFields } from '../lib/domain.ts';
import { readLocalSnapshot } from '../lib/local-state.ts';

const at = Date.parse('2026-10-03T15:00:00Z');
const today = '2026-10-03';
const blob = new Blob(['Comprovante fictício, lote de teste'], { type: 'application/pdf' });
async function fixture() {
  const doc = { id: 'doc', name: 'consulta.pdf', kind: 'Parecer', source: 'Fonte fictícia', date: today,
    expiry: '2026-12-31', reviewer: 'Ana Teste', confidence: 'Alta', quarantine: 'Revisado',
    hash: await sha256(blob), blobKey: 'lot/doc', integrity: 'verificado' };
  const item = { id: 'lot', name: 'Apartamento fictício', city: 'Rio de Janeiro', source: 'CAIXA',
    url: 'https://venda-imoveis.caixa.gov.br/sistema/detalhe-imovel.asp?hdnimovel=123',
    stage: 'Triagem', propertyType: 'Apartamento', pipelineOrigin: 'file-import', history: ['Teste'],
    finance: Object.fromEntries(financeFields.map(key => [key, key === 'margin' ? 30 : null])),
    decision: { memo: true, audit: 'CONFORME', approval1: true, approval2: true }, evidence: [doc],
    checks: [{ id: 'check', title: 'Comparáveis', kind: 'Parecer', blocking: true, status: 'aprovado', reviewer: 'Ana Teste', evidenceId: 'doc', locator: 'página 1, comparáveis' }] };
  const snapshot = { items: [item], selectedId: item.id, importBatches: [{id:'batch', fileName:'caixa.csv', importedAt:new Date(at).toISOString(), rows:1,created:1,updated:0}], sourceChecks: [] };
  const input = { evidenceId: 'doc', reviewer: 'Ana Teste', locator: 'página 1, lote 123', auctionAt: '2026-10-10T15:00:00Z', observedBid: 90000 };
  return { doc, item, snapshot, input };
}
test('backup completo recupera bytes, dados pendentes e histórico de importação em uma base vazia', async () => {
  const { snapshot } = await fixture();
  const archive = await createBackup(snapshot, async key => { assert.equal(key, 'lot/doc'); return blob; });
  const backup = await verifyBackup(archive);
  assert.equal(await backup.files[0].blob.text(), await blob.text());
  const plan = prepareRecovery({ items: [] }, backup, 'one');
  assert.equal(plan.snapshot.items[0].finance.bid, null);
  assert.equal(plan.snapshot.items[0].checks[0].status, 'em revisão');
  assert.equal(plan.snapshot.items[0].decision.approval1, false);
  assert.equal(plan.snapshot.importBatches[0].fileName, 'caixa.csv');
  assert.equal(plan.snapshot.items[0].evidence[0].blobKey, plan.files[0].key);
  assert.deepEqual(readLocalSnapshot(JSON.stringify(plan.snapshot)), plan.snapshot);
});
test('restauração preserva os registros e arquivos anteriores e remove confirmação antiga da fonte', async () => {
  const { snapshot, item, input } = await fixture();
  snapshot.items[0].manualVerification = prepareManualVerification(item, input, today, at);
  const backup = await verifyBackup(await createBackup(snapshot, async () => blob));
  const plan = prepareRecovery(snapshot, backup, 'copy');
  assert.equal(plan.snapshot.items.length, 2);
  assert.deepEqual(plan.snapshot.items[1], snapshot.items[0]);
  assert.equal(plan.snapshot.items[0].manualVerification, undefined);
  assert.notEqual(plan.files[0].key, item.evidence[0].blobKey);
  assert.throws(() => prepareRecovery(plan.snapshot, backup, 'copy'), /já utilizado/);
});
test('backup recusa anexo ausente ou com conteúdo divergente', async () => {
  const { snapshot } = await fixture();
  await assert.rejects(createBackup(snapshot, async () => { throw new Error('ausente'); }), /ausente/);
  await assert.rejects(createBackup(snapshot, async () => new Blob(['errado'])), /divergente/);
});
test('backup adulterado é recusado, inclusive com checksum recalculado e anexo inválido', async () => {
  const { snapshot } = await fixture();
  const original = await createBackup(snapshot, async () => blob);
  const envelope = JSON.parse(original);
  envelope.payload.snapshot.items[0].name = 'Alterado';
  await assert.rejects(verifyBackup(JSON.stringify(envelope)), /checksum/);
  envelope.payload.files[0].base64 = btoa('arquivo falso');
  envelope.checksum = await sha256(new Blob([JSON.stringify(envelope.payload)]));
  await assert.rejects(verifyBackup(JSON.stringify(envelope)), /Integridade/);
});
test('manifestos incompletos, duplicados e versão desconhecida não chegam ao armazenamento', async () => {
  const { snapshot } = await fixture();
  const original = JSON.parse(await createBackup(snapshot, async () => blob));
  for (const edit of [e => e.payload.files.pop(), e => e.payload.files.push(e.payload.files[0]), e => e.payload.version = 2]) {
    const envelope = structuredClone(original); edit(envelope);
    envelope.checksum = await sha256(new Blob([JSON.stringify(envelope.payload)]));
    await assert.rejects(verifyBackup(JSON.stringify(envelope)));
  }
});
test('falha de cota ou conflito ao salvar metadados descarta somente os novos anexos', async () => {
  const { snapshot } = await fixture();
  const plan = prepareRecovery(snapshot, await verifyBackup(await createBackup(snapshot, async () => blob)), 'quota');
  const files = new Map([['lot/doc', blob]]); let saved = snapshot;
  await assert.rejects(commitRecovery(plan, {
    stage: async next => next.forEach(file => files.set(file.key, file.blob)),
    save: () => { throw new Error('QuotaExceededError'); },
    discard: async keys => keys.forEach(key => files.delete(key)),
  }), /QuotaExceeded/);
  assert.equal(files.size, 1); assert.equal(files.get('lot/doc'), blob); assert.equal(saved, snapshot);
  await commitRecovery(plan, { stage: async next => next.forEach(file => files.set(file.key, file.blob)), save: data => { saved = data; }, discard: async () => {} });
  assert.equal(saved.items.length, 2); assert.equal(files.size, 2);
});
test('falha ao gravar arquivos impede a gravação de metadados', async () => {
  const { snapshot } = await fixture();
  const plan = prepareRecovery(snapshot, await verifyBackup(await createBackup(snapshot, async () => blob)), 'io');
  let called = false;
  await assert.rejects(commitRecovery(plan, { stage: async () => { throw new Error('IndexedDB'); }, save: () => { called = true; }, discard: async () => {} }), /IndexedDB/);
  assert.equal(called, false);
});
test('CAIXA manual passa a ser atual com confirmação comprovada, preço e data futura', async () => {
  const { item, input } = await fixture();
  assert.equal(catalogCurrent(item, at), false);
  const manualVerification = prepareManualVerification(item, input, today, at);
  const confirmed = { ...item, manualVerification, observedBid: input.observedBid, auctionAt: input.auctionAt };
  assert.equal(catalogCurrent(confirmed, at), true);
  assert.equal(catalogCurrent(confirmed, at + 86400000), false);
  assert.equal(catalogCurrent(confirmed, at - 1), false);
  for (const patch of [{url:'https://example.org/other'},{source:'Outra'},{observedBid:100000},{auctionAt:'2026-10-11T00:00:00Z'},{evidence:[{...item.evidence[0],integrity:'ausente'}]},{evidence:[{...item.evidence[0],hash:'f'.repeat(64)}]}]) assert.equal(catalogCurrent({...confirmed,...patch},at),false);
});
test('confirmação manual recusa lacunas e documentos sem revisão atual', async () => {
  const { item, input } = await fixture();
  for (const patch of [{reviewer:'Jurídico'},{locator:''},{auctionAt:'2026-10-01T00:00:00Z'},{observedBid:0},{evidenceId:'ausente'}]) assert.throws(() => prepareManualVerification(item, {...input,...patch}, today, at));
  assert.throws(() => prepareManualVerification({...item,evidence:[{...item.evidence[0],quarantine:'Em quarentena'}]}, input, today, at));
});
test('um Parecer não aprova automaticamente outro requisito da mesma categoria', async () => {
  const { item } = await fixture();
  assert.equal(checkApproved(item,item.checks[0],today,at),true);
  const debts = {...item.checks[0],id:'debts',title:'Débitos',evidenceId:undefined,locator:undefined};
  assert.equal(checkApproved(item,debts,today,at),false);
  assert.equal(checkEvidenceValid(item,{...debts,evidenceId:'doc',locator:'página 2, débitos'},today),true);
  for (const patch of [{locator:''},{reviewer:'Mercado'},{kind:'Edital'},{evidenceId:'outro'}]) assert.equal(checkEvidenceValid(item,{...item.checks[0],...patch},today),false);
});
test('checklist da fonte exige vínculo documental e confirmação atual', async () => {
  const { item,input } = await fixture();
  const check = {...item.checks[0],kind:undefined};
  assert.equal(checkApproved(item,check,today,at),false);
  const confirmed = {...item,manualVerification:prepareManualVerification(item,input,today,at),auctionAt:input.auctionAt,observedBid:input.observedBid};
  assert.equal(checkApproved(confirmed,check,today,at),true);
  assert.equal(checkApproved(confirmed,check,today,at+86400000),false);
});
