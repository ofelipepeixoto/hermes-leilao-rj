import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareIntake } from '../lib/intake.ts';
import { intakeImpact, intakeReviewCurrent, importedItemIndex } from '../lib/intake-workflow.ts';
import { financeGroups, financeIssue, firstFinanceIssue } from '../lib/finance-guidance.ts';
import { calculate, financeFields } from '../lib/domain.ts';
import { checkApproved, checkReviewSnapshot, invalidateChecklist } from '../lib/review.ts';
import { readLocalSnapshot } from '../lib/local-state.ts';

const finance = () => ({ ...Object.fromEntries(financeFields.map(key => [key, 0])), arv: 300000, margin: 30, bid: 85000, commissionPct: 5, months: 9, capital: 1500000, workingCapital: 1500000, opexMonthly: 30000, postDistributionReserve: 360000 });
const row = { ID: 'demo', Nome: 'Apartamento fictício', Cidade: 'Rio de Janeiro', UF: 'RJ', Preço: '', Link: 'https://example.org/demo', Tipo: 'Apartamento' };

test('prévia perde validade ao editar entrada ou alterar base, sem reaproveitar confirmação antiga', () => {
  const plan = prepareIntake([row], 'ficticio.csv');
  const review = { plan, inputVersion: 3, baseVersion: 'base-a' };
  assert.equal(intakeReviewCurrent(review, 3, 'base-a'), true);
  assert.equal(intakeReviewCurrent(review, 4, 'base-a'), false);
  assert.equal(intakeReviewCurrent(review, 3, 'base-b'), false);
  assert.equal(intakeReviewCurrent(null, 3, 'base-a'), false);
  assert.ok(Number.isNaN(plan.rows[0].observedBid));
});

test('prévia de impacto distingue catálogo, registro manual e reimportação preservável', () => {
  const plan = prepareIntake([row], 'ficticio.csv');
  const item = { id: plan.rows[0].id, url: row.Link, pipelineOrigin: 'file-import' };
  assert.deepEqual(intakeImpact(plan, [item]), { created: 0, updated: 1 });
  assert.deepEqual(intakeImpact(plan, [{ ...item, pipelineOrigin: 'manual' }]), { created: 1, updated: 0 });
  assert.deepEqual(intakeImpact(plan, [{ ...item, pipelineOrigin: 'verified-catalog' }]), { created: 1, updated: 0 });
  assert.equal(importedItemIndex([{ ...item, id: 'previous-id' }], plan.rows[0]), 0);
  assert.equal(importedItemIndex([{ ...item, url: 'https://example.org/other' }], plan.rows[0]), -1);
});

test('orientação financeira cobre todas as premissas e mantém as regras existentes', () => {
  const keys = financeGroups.flatMap(group => group.fields.map(field => field.key));
  assert.equal(new Set(keys).size, financeFields.length);
  assert.deepEqual([...keys].sort(), [...financeFields].sort());
  assert.equal(firstFinanceIssue(finance()), null);
  assert.equal(calculate(finance()).pass, true);
  assert.deepEqual(firstFinanceIssue({ ...finance(), arv: NaN }), { group: 0, key: 'arv' });
  assert.deepEqual(firstFinanceIssue({ ...finance(), taxes: NaN }), { group: 1, key: 'taxes' });
  assert.deepEqual(firstFinanceIssue({ ...finance(), workingCapital: NaN }), { group: 2, key: 'workingCapital' });
  for (const [key, value] of [['arv', 0], ['margin', 29], ['margin', 100], ['bid', 0], ['commissionPct', 101], ['months', 10], ['capital', 0], ['opexMonthly', 0], ['taxes', -1]]) {
    assert.ok(financeIssue(key, value), key);
    assert.equal(calculate({ ...finance(), [key]: value }).pass, false, key);
  }
  assert.equal(financeIssue('taxes', 0), '');
  assert.match(financeIssue('taxes', NaN), /Desconhecido não significa zero/);
});

function dossier() {
  const check = { id: 'check', title: 'Comparáveis', blocking: true, kind: 'Parecer', status: 'aprovado', evidenceId: 'doc', locator: 'página 1', reviewer: 'Ana Teste' };
  const item = { id: 'demo', name: 'Apartamento fictício', city: 'Rio de Janeiro', propertyType: 'Apartamento', source: 'DEMO FICTÍCIA', url: row.Link, stage: 'Triagem', pipelineOrigin: 'file-import', observedBid: 85000, finance: finance(), history: [], checks: [check], evidence: [{ id: 'doc', name: 'Ficticio.pdf', date: '2026-10-11', blobKey: 'demo/doc', kind: 'Parecer', source: 'Fonte sintética', integrity: 'verificado', quarantine: 'Revisado', expiry: '2027-01-01', confidence: 'Alta', reviewer: 'Ana Teste', hash: 'a'.repeat(64) }] };
  check.reviewedSnapshot = checkReviewSnapshot(item, check);
  return { item, check };
}

test('revisão é vinculada ao imóvel, premissas, requisito e versão documental', () => {
  const { item, check } = dossier();
  const approved = (i, c = check) => checkApproved(i, c, '2026-10-11', Date.parse('2026-10-11T13:00:00Z'));
  assert.equal(approved(item), true);
  assert.equal(approved({ ...item, favorite: true, history: ['Favoritado'] }), true);
  for (const patch of [{ id: 'other' }, { name: 'Outro imóvel' }, { city: 'Outra cidade' }, { observedBid: 90000 }, { source: 'Outra fonte' }, { finance: { ...item.finance, bid: 90000 } }, { evidence: [{ ...item.evidence[0], hash: 'b'.repeat(64) }] }, { evidence: [{ ...item.evidence[0], expiry: '2027-02-01' }] }]) assert.equal(approved({ ...item, ...patch }), false);
  for (const patch of [{ id: 'other-check' }, { locator: 'página 2' }, { reviewer: 'Bruno Teste' }, { title: 'Débitos' }, { reviewedSnapshot: undefined }]) assert.equal(approved(item, { ...check, ...patch }), false);
});

test('revisão sobrevive ao JSON com pendências, mas invalida alteração financeira após retomada', () => {
  const { item, check } = dossier();
  item.finance.taxes = NaN;
  check.reviewedSnapshot = checkReviewSnapshot(item, check);
  const restored = readLocalSnapshot(JSON.stringify({ items: [item], selectedId: item.id, activeTab: 'Financeiro' }));
  assert.equal(restored.activeTab, 'Financeiro');
  assert.equal(checkReviewSnapshot(restored.items[0], restored.items[0].checks[0]), check.reviewedSnapshot);
  restored.items[0].finance.taxes = 0;
  assert.notEqual(checkReviewSnapshot(restored.items[0], restored.items[0].checks[0]), check.reviewedSnapshot);
  assert.throws(() => readLocalSnapshot(JSON.stringify({ items: [], activeTab: ['Pipeline'] })), /Área/);
});

test('reverter um valor alterado não ressuscita a aprovação anterior', () => {
  const { item, check } = dossier();
  assert.equal(checkApproved(item, check, '2026-10-11', Date.now()), true);
  const invalidated = invalidateChecklist(item.checks);
  assert.equal(invalidated[0].status, 'em revisão');
  assert.equal(checkApproved(item, invalidated[0], '2026-10-11', Date.now()), false);
  assert.equal(check.status, 'aprovado');
});
