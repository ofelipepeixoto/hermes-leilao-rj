import { readLocalSnapshot } from './local-state.ts';
import { invalidateDecision } from './domain.ts';

export const BACKUP_MAX_BYTES = 96 * 1024 * 1024;
const MAX_FILES_BYTES = 64 * 1024 * 1024;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
type SavedFile = { key: string; name: string; type: string; size: number; hash: string; base64: string };
type Backup = { format: 'hermes-leilao-backup'; version: 1; createdAt: string; snapshot: Record<string, unknown>; files: SavedFile[] };
type Document = { id: string; name: string; hash: string; blobKey: string };
type Item = Record<string, unknown> & { id: string; evidence: Document[]; history: string[]; checks: Record<string, unknown>[] };
export type VerifiedBackup = { snapshot: Record<string, unknown>; files: { key: string; blob: Blob }[]; createdAt: string; itemCount: number };

export async function sha256(blob: Blob) {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), v => v.toString(16).padStart(2, '0')).join('');
}
function encode(bytes: Uint8Array) {
  let binary = '';
  for (let at = 0; at < bytes.length; at += 8192) binary += String.fromCharCode(...bytes.subarray(at, at + 8192));
  return btoa(binary);
}
function decode(value: string) {
  if (value.length > Math.ceil(MAX_FILE_BYTES / 3) * 4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) throw new Error('Conteúdo de anexo inválido');
  return Uint8Array.from(atob(value), c => c.charCodeAt(0));
}
function documents(snapshot: Record<string, unknown>) {
  const items = snapshot.items as Item[];
  if (items.length > 10000) throw new Error('Backup excede 10.000 oportunidades');
  const docs = items.flatMap(item => item.evidence);
  if (docs.length > 1000) throw new Error('Backup excede 1.000 anexos');
  if (new Set(docs.map(doc => doc.blobKey)).size !== docs.length || docs.some(doc => !doc.blobKey || !/^[a-f0-9]{64}$/.test(doc.hash))) throw new Error('Referências de anexos inválidas ou repetidas');
  return docs;
}
export async function createBackup(snapshot: Record<string, unknown>, read: (key: string) => Promise<Blob>): Promise<string> {
  const safeSnapshot = readLocalSnapshot(JSON.stringify(snapshot));
  const files: SavedFile[] = [];
  let total = 0;
  for (const doc of documents(safeSnapshot)) {
    const blob = await read(doc.blobKey);
    total += blob.size;
    if (blob.size > MAX_FILE_BYTES || total > MAX_FILES_BYTES) throw new Error('Limite de backup: 20 MB por anexo e 64 MB no total');
    if (await sha256(blob) !== doc.hash) throw new Error('Anexo ausente ou divergente: ' + doc.name);
    files.push({ key: doc.blobKey, name: doc.name, type: blob.type, size: blob.size, hash: doc.hash, base64: encode(new Uint8Array(await blob.arrayBuffer())) });
  }
  const payload: Backup = { format: 'hermes-leilao-backup', version: 1, createdAt: new Date().toISOString(), snapshot: safeSnapshot, files };
  const serialized = JSON.stringify(payload);
  const output = JSON.stringify({ payload, checksum: await sha256(new Blob([serialized])) });
  if (new Blob([output]).size > BACKUP_MAX_BYTES) throw new Error('Backup excede 96 MB');
  return output;
}
/** Verify the entire archive before any storage mutation. Checksums detect corruption, not authorship. */
export async function verifyBackup(text: string): Promise<VerifiedBackup> {
  if (new Blob([text]).size > BACKUP_MAX_BYTES) throw new Error('Backup excede 96 MB');
  const envelope = JSON.parse(text);
  const payload = envelope?.payload;
  if (!payload || payload.format !== 'hermes-leilao-backup' || payload.version !== 1 || typeof payload.createdAt !== 'string' || !Number.isFinite(Date.parse(payload.createdAt)) || !Array.isArray(payload.files)) throw new Error('Formato ou versão do backup inválido');
  if (await sha256(new Blob([JSON.stringify(payload)])) !== envelope.checksum) throw new Error('Backup corrompido: checksum divergente');
  const snapshot = readLocalSnapshot(JSON.stringify(payload.snapshot));
  const docs = documents(snapshot);
  if (payload.files.length !== docs.length) throw new Error('Backup incompleto: quantidade de anexos divergente');
  const expected = new Map(docs.map(doc => [doc.blobKey, doc]));
  const files: VerifiedBackup['files'] = [];
  let total = 0;
  for (const file of payload.files as SavedFile[]) {
    const doc = expected.get(file.key);
    if (!doc || file.name !== doc.name || file.hash !== doc.hash || typeof file.type !== 'string' || typeof file.base64 !== 'string' || !Number.isInteger(file.size) || file.size < 0 || file.size > MAX_FILE_BYTES) throw new Error('Manifesto de anexos inválido');
    total += file.size;
    if (total > MAX_FILES_BYTES) throw new Error('Anexos excedem 64 MB');
    const blob = new Blob([decode(file.base64)], { type: file.type });
    if (blob.size !== file.size || await sha256(blob) !== doc.hash) throw new Error('Integridade divergente: ' + doc.name);
    expected.delete(file.key);
    files.push({ key: file.key, blob });
  }
  return { snapshot, files, createdAt: payload.createdAt, itemCount: (snapshot.items as Item[]).length };
}
/** Add independent copies, never overwrite an existing dossier or its attachments. */
export function prepareRecovery(current: Record<string, unknown>, backup: VerifiedBackup, token: string) {
  const base = readLocalSnapshot(JSON.stringify(current));
  const existing = base.items as Item[];
  const prefix = 'recovery-' + token + '-';
  const keyMap = new Map(backup.files.map(file => [file.key, prefix + file.key]));
  const restored = (backup.snapshot.items as Item[]).map(item => ({
    ...item, id: prefix + item.id, decision: invalidateDecision(),
    catalogStatus: 'Revalidação pendente', manualVerification: undefined,
    history: [...item.history, 'Restaurado como cópia em ' + new Date().toISOString() + '; revisão e confirmação da fonte pendentes.'],
    evidence: item.evidence.map(doc => ({ ...doc, blobKey: keyMap.get(doc.blobKey)!, integrity: 'verificado' })),
    checks: item.checks.map(check => ({ ...check, status: check.status === 'aprovado' ? 'em revisão' : check.status })),
  }));
  const ids = new Set(existing.map(item => item.id));
  if (restored.some(item => ids.has(item.id))) throw new Error('Identificador de recuperação já utilizado');
  const snapshot = readLocalSnapshot(JSON.stringify({ ...base, items: [...restored, ...existing], selectedId: restored[0]?.id || base.selectedId || '',
    importBatches: [...((backup.snapshot.importBatches || []) as Record<string, unknown>[]).map(batch => ({ ...batch, id: prefix + batch.id })), ...((base.importBatches || []) as Record<string, unknown>[])],
    sourceChecks: [...((base.sourceChecks || []) as Record<string, unknown>[]), ...((backup.snapshot.sourceChecks || []) as Record<string, unknown>[]).map(source => ({ ...source, status: 'pendente', message: 'Diagnóstico restaurado; consulte a fonte novamente.' }))],
    savedAt: new Date().toISOString() }));
  return { snapshot, files: backup.files.map(file => ({ key: keyMap.get(file.key)!, blob: file.blob })) };
}
export async function commitRecovery(plan: ReturnType<typeof prepareRecovery>, storage: {
  stage: (files: { key: string; blob: Blob }[]) => Promise<void>;
  save: (snapshot: Record<string, unknown>) => void;
  discard: (keys: string[]) => Promise<void>;
}) {
  await storage.stage(plan.files);
  try { storage.save(plan.snapshot); }
  catch (error) {
    // Fresh keys only: a failed metadata save cannot delete the existing base.
    await storage.discard(plan.files.map(file => file.key)).catch(() => {});
    throw error;
  }
}
