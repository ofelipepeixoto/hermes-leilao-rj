// Optional local browser regression suite; never connects to production or auction sources.
// HERMES_PLAYWRIGHT_MODULE=/path/to/playwright HERMES_CHROMIUM=/usr/bin/chromium node tests/shadow-workflow.browser.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const { chromium } = createRequire(import.meta.url)(process.env.HERMES_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.HERMES_BASE_URL || 'http://127.0.0.1:5173';
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(base).hostname), 'Use only a local server');
const output = path.resolve(process.env.HERMES_EVIDENCE_DIR || 'outputs/shadow-ux');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.HERMES_CHROMIUM || undefined, headless: true, args: ['--no-sandbox'] });
const STORE = 'hermes-leilao-rj-v4';
const header = 'ID;Nome;Cidade;UF;Preço;Tipo;Fonte;Link';
const csv = (price = '100000', id = 'DEMO-001') => `${header}\n${id};Apartamento fictício ${id};Rio de Janeiro;RJ;${price};Apartamento;DEMO FICTÍCIA;https://example.org/${id}`;
const results = [];
const pageErrors = [];
const blockedExternal = [];
let catalogRequests = 0;
async function fresh(width = 1280) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await context.newPage();
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== new URL(base).origin) { blockedExternal.push(url.origin); return route.abort(); }
    if (url.pathname === '/api/catalog') { catalogRequests++; return route.fulfill({ status: 502, contentType: 'application/json', body: '{"error":"Falha sintética"}' }); }
    return route.continue();
  });
  await page.goto(base);
  await page.getByRole('heading', { name: 'Pipeline', exact: true }).waitFor();
  return { context, page };
}
async function pasted(page, text) {
  await page.getByRole('radio', { name: 'Colar da planilha', exact: true }).check();
  await page.getByLabel('Dados da lista', { exact: true }).fill(text);
  await page.getByRole('button', { name: 'Gerar prévia da lista', exact: true }).click();
}
async function confirm(page) {
  await page.getByRole('checkbox', { name: /Revisei esta versão/ }).check();
  await page.getByRole('button', { name: /^Importar \d+ linha/ }).click();
}
async function state(page) { return page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORE); }
async function check(name, task) {
  const start = Date.now(); await task(); results.push({ name, status: 'passed', ms: Date.now() - start }); console.log('PASS ' + name);
}
try {
  await check('empty workspace has a direct import path and no misleading private label', async () => {
    const { context, page } = await fresh();
    assert.equal(await page.getByRole('heading', { name: 'Filtrar oportunidades', exact: true }).count(), 0);
    assert.equal(await page.getByText('MVP privado · modo sombra', { exact: true }).count(), 0);
    await page.getByRole('link', { name: 'Importar lista CSV ou Excel', exact: true }).click();
    assert.equal(await page.evaluate(() => document.activeElement.id), 'import-heading');
    await page.screenshot({ path: path.join(output, 'after-empty-desktop.png'), fullPage: true });
    await context.close();
  });
  await check('file upload works from keyboard; missing, duplicate and rejected rows are explained', async () => {
    const { context, page } = await fresh(390);
    await page.getByRole('radio', { name: 'Selecionar arquivo', exact: true }).focus();
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.type), 'file');
    const chooser = page.waitForEvent('filechooser'); await page.keyboard.press('Space');
    const file = await chooser;
    const row = csv('').split('\n')[1];
    await file.setFiles({ name: 'ficticio.csv', mimeType: 'text/csv', buffer: Buffer.from(`${header}\n${row}\n${row}\n;Sem identidade;Rio de Janeiro;RJ;;Pendente;DEMO;`) });
    await page.getByRole('heading', { name: /Confira antes de importar/ }).waitFor();
    assert.match(await page.locator('#import-workspace').innerText(), /1 novo\(s\), 0 atualização\(ões\), 1 recusada\(s\), 1 repetida\(s\)/);
    assert.match(await page.locator('#import-workspace').innerText(), /Preço pendente/);
    assert.equal((await state(page)).items.length, 0);
    assert.equal(await page.getByRole('button', { name: /^Importar 1 linha/ }).isEnabled(), false);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: path.join(output, 'after-preview-mobile.png'), fullPage: true });
    await context.close();
  });
  await check('editing a reviewed input removes stale preview and resets consent', async () => {
    const { context, page } = await fresh();
    await pasted(page, csv()); await page.getByRole('checkbox', { name: /Revisei esta versão/ }).check();
    await page.getByLabel('Dados da lista', { exact: true }).fill(csv('', 'DEMO-002'));
    assert.equal(await page.getByRole('button', { name: /^Importar \d+ linha/ }).count(), 0);
    await page.getByRole('button', { name: 'Gerar prévia da lista', exact: true }).click();
    assert.equal(await page.getByRole('checkbox', { name: /Revisei esta versão/ }).isChecked(), false);
    await confirm(page); await page.getByRole('button', { name: 'Analisar primeiro imóvel importado' }).waitFor();
    assert.equal((await state(page)).items[0].name, 'Apartamento fictício DEMO-002');
    assert.equal((await state(page)).items[0].observedBid, null);
    await context.close();
  });
  await check('bad file replaces old preview with a focused recoverable error', async () => {
    const { context, page } = await fresh(); await pasted(page, csv());
    await page.getByRole('radio', { name: 'Selecionar arquivo', exact: true }).check();
    await page.getByLabel('Lista CSV ou Excel', { exact: true }).setInputFiles({ name: 'invalid.csv', mimeType: 'text/csv', buffer: Buffer.from('not a recognized header') });
    await page.getByRole('alert').waitFor();
    assert.match(await page.getByRole('alert').innerText(), /Cabeçalho não reconhecido/);
    assert.equal(await page.getByRole('button', { name: /^Importar \d+ linha/ }).count(), 0);
    await page.waitForFunction(() => document.activeElement.getAttribute('role') === 'alert');
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute('role')), 'alert');
    assert.equal((await state(page)).items.length, 0); await context.close();
  });
  await check('text draft resumes after reload and requires a new preview', async () => {
    const { context, page } = await fresh(); await pasted(page, csv());
    await page.reload(); await page.getByLabel('Dados da lista', { exact: true }).waitFor();
    assert.equal(await page.getByLabel('Dados da lista', { exact: true }).inputValue(), csv());
    assert.equal(await page.getByRole('heading', { name: /Confira antes de importar/ }).count(), 0);
    assert.match(await page.locator('#import-workspace').innerText(), /Rascunho de texto retomado/);
    await context.close();
  });
  await check('guided finance preserves edits, flags invalid inputs, resumes area and keeps committee blocked', async () => {
    const { context, page } = await fresh(390); await pasted(page, csv('')); await confirm(page);
    await page.getByRole('button', { name: 'Analisar primeiro imóvel importado' }).click();
    await page.getByRole('button', { name: 'Financeiro', exact: true }).click();
    await page.getByRole('button', { name: 'Ir à primeira pendência', exact: true }).click();
    await page.waitForFunction(() => document.activeElement.id === 'finance-arv');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'finance-arv');
    await page.getByLabel('Saída conservadora (R$)', { exact: true }).fill('-10');
    assert.equal(await page.getByLabel('Saída conservadora (R$)', { exact: true }).getAttribute('aria-invalid'), 'true');
    await page.getByLabel('Saída conservadora (R$)', { exact: true }).fill('300000');
    await page.getByRole('button', { name: /Continuar para custos/ }).click();
    await page.waitForFunction(() => document.activeElement.id === 'finance-step-title');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'finance-step-title');
    await page.getByLabel('Tributos da venda (R$)', { exact: true }).fill('0');
    await page.reload(); await page.getByRole('heading', { name: /Financeiro · Apartamento fictício/ }).waitFor();
    assert.equal((await state(page)).items[0].finance.arv, 300000);
    assert.equal((await state(page)).items[0].finance.taxes, 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: path.join(output, 'after-finance-mobile.png'), fullPage: true });
    await page.getByRole('button', { name: 'Comitê', exact: true }).click();
    assert.match(await page.locator('main').innerText(), /Comitê final bloqueado/);
    assert.equal((await state(page)).items[0].decision.approval1, false); await context.close();
  });
  await check('reimport retains financial assumptions and evidence, while announced price returns to pending', async () => {
    const { context, page } = await fresh(); await pasted(page, csv()); await confirm(page);
    await page.getByRole('button', { name: 'Analisar primeiro imóvel importado' }).click();
    await page.getByRole('button', { name: 'Financeiro', exact: true }).click();
    await page.getByLabel('Saída conservadora (R$)', { exact: true }).fill('300000');
    await page.getByRole('button', { name: 'Dossiê', exact: true }).click();
    await page.getByLabel('Anexar documentos', { exact: true }).setInputFiles({ name: 'ficticio.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\nDocumento sintético para testar armazenamento.\n%%EOF') });
    await page.getByRole('button', { name: 'Baixar anexo', exact: true }).waitFor();
    const before = (await state(page)).items[0];
    await page.getByRole('button', { name: 'Pipeline', exact: true }).click();
    await pasted(page, csv(''));
    assert.match(await page.locator('#import-workspace').innerText(), /0 novo\(s\), 1 atualização/);
    await confirm(page); await page.getByRole('button', { name: 'Analisar primeiro imóvel importado' }).waitFor();
    const after = (await state(page)).items[0];
    assert.equal(after.finance.arv, 300000); assert.equal(after.finance.bid, 100000); assert.equal(after.observedBid, null);
    assert.equal(after.evidence[0].hash, before.evidence[0].hash); assert.equal(after.evidence[0].blobKey, before.evidence[0].blobKey);
    assert.equal((await state(page)).items.length, 1); await context.close();
  });
  await check('checklist review binds the current version and stays invalid after editing then reverting finance', async () => {
    const { context, page } = await fresh(); await pasted(page, csv()); await confirm(page);
    await page.getByRole('button', { name: 'Analisar primeiro imóvel importado' }).click();
    await page.getByRole('button', { name: 'Dossiê', exact: true }).click();
    await page.getByLabel('Revisor responsável', { exact: true }).fill('Ana Teste');
    await page.getByLabel('Validade', { exact: true }).fill('2030-01-01');
    await page.getByLabel('Confiança', { exact: true }).selectOption('Alta');
    await page.getByLabel('Anexar documentos', { exact: true }).setInputFiles({ name: 'edital-ficticio.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 Documento fictício, sem validade operacional.') });
    await page.getByText(/integridade verificado/).waitFor();
    await page.getByRole('button', { name: 'Registrar revisão documental', exact: true }).click();
    const requirement = page.getByRole('group', { name: /Edital vigente e identificação do lote/ });
    await requirement.getByLabel('Documento que sustenta este item', { exact: true }).selectOption({ label: 'edital-ficticio.pdf' });
    await requirement.getByLabel('Página ou trecho pertinente', { exact: true }).fill('Página 1, lote DEMO-001');
    await requirement.getByLabel('Página ou trecho pertinente', { exact: true }).press('Tab');
    await requirement.getByLabel('Nome do revisor deste item', { exact: true }).fill('Ana Teste');
    await requirement.getByLabel('Nome do revisor deste item', { exact: true }).press('Tab');
    await requirement.getByLabel('Status: Edital vigente e identificação do lote', { exact: true }).selectOption('aprovado');
    await requirement.getByText(/Revisão vinculada à versão atual/).waitFor();
    await page.getByLabel('Nome do imóvel', { exact: true }).focus(); await page.keyboard.press('Tab');
    assert.equal(await requirement.getByLabel('Status: Edital vigente e identificação do lote', { exact: true }).inputValue(), 'aprovado');
    await page.reload(); await page.getByText(/Revisão vinculada à versão atual/).waitFor();
    await page.getByRole('button', { name: 'Financeiro', exact: true }).click();
    await page.getByLabel('Saída conservadora (R$)', { exact: true }).fill('300000');
    await page.getByLabel('Saída conservadora (R$)', { exact: true }).fill('');
    await page.getByRole('button', { name: 'Dossiê', exact: true }).click();
    assert.equal(await requirement.getByLabel('Status: Edital vigente e identificação do lote', { exact: true }).inputValue(), 'em revisão');
    assert.equal((await state(page)).items[0].checks.find(check => check.kind === 'Edital').reviewedSnapshot, undefined);
    await context.close();
  });
  await check('quota failure does not announce success or commit records; input can be retried', async () => {
    const { context, page } = await fresh(); await pasted(page, csv());
    await page.evaluate(key => { const native = Storage.prototype.setItem; window.restoreStorage = () => { Storage.prototype.setItem = native; }; Storage.prototype.setItem = function(k,v) { if (k === key) throw new DOMException('Synthetic quota failure', 'QuotaExceededError'); return native.call(this,k,v); }; }, STORE);
    await confirm(page); await page.getByRole('alert').waitFor();
    assert.match(await page.getByRole('alert').innerText(), /Não foi possível salvar/);
    assert.equal((await state(page)).items.length, 0);
    assert.equal(await page.getByLabel('Dados da lista', { exact: true }).inputValue(), csv());
    await page.evaluate(() => window.restoreStorage());
    await page.getByRole('button', { name: 'Gerar prévia da lista', exact: true }).click(); await confirm(page);
    await page.getByRole('button', { name: 'Analisar primeiro imóvel importado' }).waitFor(); assert.equal((await state(page)).items.length, 1); await context.close();
  });
  await check('concurrent tab data is preserved instead of overwritten by preview confirmation', async () => {
    const { context, page } = await fresh(); await pasted(page, csv());
    const concurrent = JSON.stringify({ ...(await state(page)), savedAt: 'another-tab-marker' });
    await page.evaluate(([key,value]) => localStorage.setItem(key,value), [STORE, concurrent]);
    await confirm(page); await page.getByRole('alert').waitFor();
    assert.match(await page.getByRole('alert').innerText(), /base mudou/);
    assert.equal(await page.evaluate(key => localStorage.getItem(key), STORE), concurrent); await context.close();
  });
  await check('320px pipeline exposes actions without page overflow; catalog failure is recoverable', async () => {
    const { context, page } = await fresh(320); await pasted(page, csv()); await confirm(page);
    await page.getByRole('button', { name: 'Analisar primeiro imóvel importado' }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.equal(await page.getByRole('button', { name: 'Analisar imóvel: Apartamento fictício DEMO-001', exact: true }).isVisible(), true);
    const before = (await state(page)).items;
    await page.route('**/api/catalog', async route => { catalogRequests++; await new Promise(resolve => setTimeout(resolve, 300)); await route.fulfill({ status: 502, body: '{}' }); });
    await page.getByRole('button', { name: 'Atualizar catálogo', exact: true }).click();
    await page.getByRole('button', { name: 'Consultando fontes…', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Consultando fontes…', exact: true }).isDisabled(), true);
    await page.getByText('Atualização não concluída. Nenhum dado local foi alterado.', { exact: false }).waitFor();
    assert.deepEqual((await state(page)).items, before);
    await page.screenshot({ path: path.join(output, 'after-pipeline-320.png'), fullPage: true }); await context.close();
  });
  assert.deepEqual(pageErrors, []); assert.deepEqual(blockedExternal, []); assert.equal(catalogRequests, 1);
} finally {
  await writeFile(path.join(output, 'browser-results.json'), JSON.stringify({ base, results, pageErrors, blockedExternal, catalogRequests, fixtures: 'Synthetic only; catalog response mocked locally', screenshots: ['after-empty-desktop.png', 'after-preview-mobile.png', 'after-finance-mobile.png', 'after-pipeline-320.png'] }, null, 2) + '\n');
  await browser.close();
}
