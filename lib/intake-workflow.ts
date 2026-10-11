import type { IntakePlan, IntakeRow } from './intake.ts';

type ImportedItem = { id: string; url: string; pipelineOrigin?: string };
export function importedItemIndex(items: ImportedItem[], row: IntakeRow) {
  return items.findIndex(item => item.pipelineOrigin === 'file-import' &&
    ((item.id === row.id && (!row.url || !item.url || row.url === item.url)) || (!!row.url && item.url === row.url)));
}

export type IntakeReview = { plan: IntakePlan; inputVersion: number; baseVersion: string };
/** A preview is usable only for the input AND local base that were reviewed. */
export function intakeReviewCurrent(review: IntakeReview | null, inputVersion: number, baseVersion: string) {
  return !!review && review.inputVersion === inputVersion && review.baseVersion === baseVersion;
}

export function intakeImpact(plan: IntakePlan, items: ImportedItem[]) {
  const updated = plan.rows.filter(row => importedItemIndex(items, row) >= 0).length;
  return { created: plan.rows.length - updated, updated };
}
