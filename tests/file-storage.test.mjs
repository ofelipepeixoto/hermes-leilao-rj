import test from 'node:test';
import assert from 'node:assert/strict';
import { indexedDB } from 'fake-indexeddb';
import { storeFiles, readStoredFile, discardFiles } from '../lib/file-storage.ts';
import { createBackup, verifyBackup, prepareRecovery, commitRecovery, sha256 } from '../lib/backup.ts';
globalThis.indexedDB = indexedDB;

test('IndexedDB grava lote atomicamente e preserva arquivos prévios após erro de clone', async () => {
  await storeFiles([{key:'previous',file:new Blob(['anterior'])}]);
  await assert.rejects(storeFiles([{key:'uncommitted',file:new Blob(['não confirmar'])},{key:'invalid',file:()=>{}}]));
  assert.equal(await (await readStoredFile('previous')).text(),'anterior');
  await assert.rejects(readStoredFile('uncommitted'),/ausente/);
  await assert.rejects(readStoredFile('invalid'),/ausente/);
});
test('backup e recuperação usam as mesmas operações de arquivo da interface', async () => {
  const original = new Blob(['PDF fictício preservado'],{type:'application/pdf'});
  const snapshot={items:[{id:'io-lot',name:'Teste',city:'Rio de Janeiro',source:'Teste',url:'https://example.org/1',stage:'Triagem',pipelineOrigin:'manual',finance:{},history:['Criado'],checks:[],evidence:[{id:'io-doc',name:'teste.pdf',kind:'Outro',source:'Teste',date:'2026-10-03',expiry:'',reviewer:'',hash:await sha256(original),blobKey:'io-lot/file'}]}]};
  await storeFiles([{key:'io-lot/file',file:original}]);
  const archive=await createBackup(snapshot,readStoredFile);
  const plan=prepareRecovery({items:[]},await verifyBackup(archive),'indexeddb');
  let metadata=null;
  await commitRecovery(plan,{stage:files=>storeFiles(files.map(file=>({key:file.key,file:file.blob}))),save:next=>{metadata=next;},discard:discardFiles});
  assert.equal(metadata.items.length,1);
  assert.equal(await (await readStoredFile(plan.files[0].key)).text(),await original.text());
  assert.equal(await (await readStoredFile('io-lot/file')).text(),await original.text());
  const failed=prepareRecovery({items:[]},await verifyBackup(archive),'failed');
  await assert.rejects(commitRecovery(failed,{stage:files=>storeFiles(files.map(file=>({key:file.key,file:file.blob}))),save:()=>{throw new Error('quota');},discard:discardFiles}),/quota/);
  await assert.rejects(readStoredFile(failed.files[0].key),/ausente/);
  assert.equal(await (await readStoredFile('io-lot/file')).text(),await original.text());
});
