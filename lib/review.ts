import { catalogCurrent, evidenceValid, safeUrl } from './domain.ts';

export type ReviewEvidence = { id: string; kind: string; integrity?: string; quarantine?: string; expiry?: string; confidence?: string; reviewer?: string; hash?: string; source?: string };
export type ReviewCheck = { kind?: string; status: string; evidenceId?: string; locator?: string; reviewer: string };
export type ManualVerification = { url: string; source: string; checkedAt: string; validUntil: string; reviewer: string; evidenceId: string; evidenceHash: string; locator: string; auctionAt: string; observedBid: number };
const identified = (name: string) => !!name.trim() && !/^(revis[aã]o humana|executivo|jur[ií]dico|mercado)$/i.test(name.trim());
export function checkEvidenceValid(item: { evidence: ReviewEvidence[] }, check: ReviewCheck, today: string) {
  const evidence = item.evidence.find(doc => doc.id === check.evidenceId);
  return !!evidence && (!check.kind || evidence.kind === check.kind) && evidence.integrity === 'verificado' && evidenceValid(evidence, today) && !!check.locator?.trim() && identified(check.reviewer);
}
export function checkApproved(item: Parameters<typeof checkEvidenceValid>[0] & Parameters<typeof catalogCurrent>[0], check: ReviewCheck, today: string, at: number) {
  return check.status === 'aprovado' && checkEvidenceValid(item, check, today) && (!!check.kind || catalogCurrent(item, at));
}
export function prepareManualVerification(item: { url: string; source: string; evidence: ReviewEvidence[] }, input: { evidenceId: string; locator: string; reviewer: string; auctionAt: string; observedBid: number }, today: string, at = Date.now()): ManualVerification {
  const doc = item.evidence.find(e => e.id === input.evidenceId);
  if (!safeUrl(item.url) || !item.source.trim() || !doc || doc.integrity !== 'verificado' || !evidenceValid(doc, today) || !identified(input.reviewer) || !input.locator.trim()) throw new Error('Informe fonte HTTPS, comprovante revisado, página/trecho e responsável identificado');
  if (!Number.isFinite(input.observedBid) || input.observedBid <= 0 || !Number.isFinite(Date.parse(input.auctionAt)) || Date.parse(input.auctionAt) <= at) throw new Error('Confirme o lance anunciado e uma data futura do certame');
  return { ...input, url: safeUrl(item.url), source: item.source, checkedAt: new Date(at).toISOString(), validUntil: new Date(at + 86400000).toISOString(), evidenceHash: doc.hash! };
}
