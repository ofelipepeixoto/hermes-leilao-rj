import { catalogCurrent, evidenceValid, financeFields, safeUrl } from './domain.ts';

export type ReviewEvidence = { id: string; kind: string; integrity?: string; quarantine?: string; expiry?: string; confidence?: string; reviewer?: string; hash?: string; source?: string };
export type ReviewCheck = { id?: string; title?: string; blocking?: boolean; kind?: string; status: string; evidenceId?: string; locator?: string; reviewer: string; reviewedSnapshot?: string };
type ReviewItem = Omit<Parameters<typeof catalogCurrent>[0], 'evidence'> & {
  id?: string; name?: string; city?: string; propertyType?: string;
  snapshotHash?: string; finance?: Record<string, number | null>; evidence: ReviewEvidence[];
};
export type ManualVerification = { url: string; source: string; checkedAt: string; validUntil: string; reviewer: string; evidenceId: string; evidenceHash: string; locator: string; auctionAt: string; observedBid: number };
export function invalidateChecklist<T extends ReviewCheck>(checks: T[]): T[] {
  return checks.map(check => ({ ...check, status: check.status === 'aprovado' ? 'em revisão' : check.status, reviewedSnapshot: undefined, reviewedAt: undefined }));
}
const identified = (name: string) => !!name.trim() && !/^(revis[aã]o humana|executivo|jur[ií]dico|mercado)$/i.test(name.trim());
export function checkEvidenceValid(item: { evidence: ReviewEvidence[] }, check: ReviewCheck, today: string) {
  const evidence = item.evidence.find(doc => doc.id === check.evidenceId);
  return !!evidence && (!check.kind || evidence.kind === check.kind) && evidence.integrity === 'verificado' && evidenceValid(evidence, today) && !!check.locator?.trim() && identified(check.reviewer);
}
/** Exact local content version, not a signature or authenticated approval. Stable across JSON reloads. */
export function checkReviewSnapshot(item: ReviewItem, check: ReviewCheck) {
  const doc = item.evidence.find(evidence => evidence.id === check.evidenceId);
  return JSON.stringify({
    version: 1, destination: 'local-shadow-checklist', consequence: 'preliminary-review-only',
    asset: [item.id, item.name, item.city, item.propertyType, item.url, item.source, item.pipelineOrigin],
    source: [item.observedBid, item.auctionAt, item.snapshotHash, item.capturedAt],
    finance: financeFields.map(key => item.finance?.[key] ?? null),
    evidence: doc ? [doc.id, doc.hash, doc.kind, doc.source, doc.expiry, doc.reviewer, doc.confidence, doc.quarantine] : null,
    requirement: [check.id, check.title, check.blocking, check.kind, check.evidenceId, check.locator, check.reviewer],
  });
}
export function checkApproved(item: ReviewItem, check: ReviewCheck, today: string, at: number) {
  return check.status === 'aprovado' && check.reviewedSnapshot === checkReviewSnapshot(item, check) &&
    checkEvidenceValid(item, check, today) && (!!check.kind || catalogCurrent(item, at));
}
export function prepareManualVerification(item: { url: string; source: string; evidence: ReviewEvidence[] }, input: { evidenceId: string; locator: string; reviewer: string; auctionAt: string; observedBid: number }, today: string, at = Date.now()): ManualVerification {
  const doc = item.evidence.find(e => e.id === input.evidenceId);
  if (!safeUrl(item.url) || !item.source.trim() || !doc || doc.integrity !== 'verificado' || !evidenceValid(doc, today) || !identified(input.reviewer) || !input.locator.trim()) throw new Error('Informe fonte HTTPS, comprovante revisado, página/trecho e responsável identificado');
  if (!Number.isFinite(input.observedBid) || input.observedBid <= 0 || !Number.isFinite(Date.parse(input.auctionAt)) || Date.parse(input.auctionAt) <= at) throw new Error('Confirme o lance anunciado e uma data futura do certame');
  return { ...input, url: safeUrl(item.url), source: item.source, checkedAt: new Date(at).toISOString(), validUntil: new Date(at + 86400000).toISOString(), evidenceHash: doc.hash! };
}
