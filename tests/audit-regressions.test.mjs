import test from 'node:test';
import assert from 'node:assert/strict';
import { calculate, evidenceValid, financeFields, rowsFromMatrix } from '../lib/domain.ts';
import { prepareIntake } from '../lib/intake.ts';
import { selectOpportunities } from '../lib/selection.ts';
import { readLocalSnapshot } from '../lib/local-state.ts';

const finance = () => ({
  ...Object.fromEntries(financeFields.map(key => [key, 0])),
  arv: 300000, margin: 30, bid: 85000, commissionPct: 5, months: 9,
  capital: 1500000, workingCapital: 1500000, opexMonthly: 30000,
  postDistributionReserve: 360000,
});
const evidence = () => ({
  id: 'doc-1', name: 'Edital', kind: 'Edital', source: 'Fonte oficial',
  date: '2026-10-02', expiry: '2030-01-01', reviewer: 'Ana',
  confidence: 'Alta', quarantine: 'Revisado', hash: 'a'.repeat(64), blobKey: 'lot/doc-1',
});
const lot = () => ({
  id: 'lot', name: 'Apartamento fictício', city: 'Rio de Janeiro/RJ',
  source: 'Teste', url: 'https://example.org/1', stage: 'Triagem',
  pipelineOrigin: 'file-import', finance: finance(), history: ['Criado'],
  evidence: [evidence()], checks: [{ id: 'check', title: 'Edital', status: 'aprovado', reviewer: 'Ana', blocking: true }],
});

test('cálculo bloqueia overflow mesmo quando todas as entradas são finitas', () => {
  assert.equal(calculate(finance()).pass, true);
  const result = calculate({ ...finance(), itbi: 1e308, registry: 1e308 });
  assert.equal(result.missing.length, 0);
  assert.equal(result.pass, false);
  assert.ok(result.reasons.some(reason => /intervalo numérico/.test(reason)));
});

test('validade documental exige data ISO real, incluindo ano bissexto', () => {
  for (const expiry of ['banana', '2030-02-30', '2030-13-01', '2030-2-1', '2026-02-29', '2026-10-01']) {
    assert.equal(evidenceValid({ ...evidence(), expiry }, '2026-10-02'), false, expiry);
  }
  assert.equal(evidenceValid({ ...evidence(), expiry: '2028-02-29' }, '2026-10-02'), true);
  assert.equal(evidenceValid({ ...evidence(), expiry: '2026-10-02' }, '2026-10-02'), true);
  assert.equal(evidenceValid(evidence(), 'invalid'), false);
});

test('duplicata de URL após colisão de código mantém os dois lotes válidos', () => {
  const row = { ID: '001', Nome: 'Apartamento fictício', Cidade: 'Rio de Janeiro', Preço: '100000', Link: 'https://example.org/1' };
  const other = { ...row, Link: 'https://example.org/2' };
  const plan = prepareIntake([row, other, other], 'test.csv');
  assert.equal(plan.rows.length, 2);
  assert.equal(new Set(plan.rows.map(row => row.id)).size, 2);
  assert.equal(plan.duplicates, 1);
  assert.equal(plan.rejected.length, 0);
});

test('colunas repetidas são rejeitadas antes de perder preço ou identidade', () => {
  assert.throws(() => rowsFromMatrix([
    ['ID', 'Nome', 'Preço', ' PRECO '], ['1', 'Apartamento', '100000', '90000'],
  ]), /Cabeçalhos repetidos/);
});

test('excluir preços pendentes funciona mesmo sem teto de preço', () => {
  const filters = { query: '', source: '', city: '', type: '', maxPrice: '', includeUnknown: false, status: '', favoritesOnly: false, sort: 'price' };
  const items = [{ ...lot(), id: 'known', observedBid: 100000 }, { ...lot(), id: 'pending', observedBid: null }];
  assert.deepEqual(selectOpportunities(items, filters).map(item => item.id), ['known']);
  assert.equal(selectOpportunities(items, { ...filters, includeUnknown: true }).length, 2);
});

test('base local válida conserva documentos e premissas pendentes ao reler', () => {
  const snapshot = { items: [{ ...lot(), finance: { ...finance(), bid: null } }], selectedId: 'lot', importBatches: [], sourceChecks: [] };
  assert.deepEqual(readLocalSnapshot(JSON.stringify(snapshot)), snapshot);
  assert.deepEqual(readLocalSnapshot(null), { items: [] });
  assert.deepEqual(readLocalSnapshot('{"items":[]}'), { items: [] });
});

test('base corrompida ou IDs duplicados bloqueiam carga e preservam texto original', () => {
  const invalid = [null, [], {}, { items: {} }, { items: [null] }, { items: [lot(), lot()] },
    { items: [{ ...lot(), evidence: {} }] }, { items: [{ ...lot(), history: [1] }] },
    { items: [{ ...lot(), finance: { bid: '100000' } }] },
    { items: [], sourceChecks: {} }, { items: [], importBatches: [{}] }];
  for (const value of invalid) {
    const raw = JSON.stringify(value);
    assert.throws(() => readLocalSnapshot(raw));
    assert.deepEqual(JSON.parse(raw), value);
  }
  assert.throws(() => readLocalSnapshot('{'));
  assert.throws(() => readLocalSnapshot(''));
});
