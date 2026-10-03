import { financeFields } from './domain.ts';

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const strings = (value: Record<string, unknown>, keys: string[]) =>
  keys.every(key => typeof value[key] === 'string');
const arrayOf = (value: unknown, check: (item: unknown) => boolean) =>
  Array.isArray(value) && value.every(check);

/** Reject malformed snapshots before the caller can overwrite the stored bytes. */
export function readLocalSnapshot(raw: string | null): Record<string, unknown> {
  if (raw === null) return { items: [] };
  const value: unknown = JSON.parse(raw);
  if (!record(value) || !arrayOf(value.items, item => {
    if (!record(item) || !strings(item, ['id', 'name', 'city', 'source', 'url', 'stage']) || !item.id) return false;
    const finance = item.finance;
    if (!record(finance) || !financeFields.every(key => finance[key] === undefined || finance[key] === null || typeof finance[key] === 'number')) return false;
    if (!arrayOf(item.history, entry => typeof entry === 'string')) return false;
    if (!arrayOf(item.evidence, entry => record(entry) && strings(entry, ['id', 'name', 'kind', 'source', 'date', 'expiry', 'reviewer', 'hash', 'blobKey']))) return false;
    if (!arrayOf(item.checks, entry => record(entry) && strings(entry, ['id', 'title', 'status', 'reviewer']) && typeof entry.blocking === 'boolean' && ['evidenceId','locator'].every(key => entry[key] === undefined || typeof entry[key] === 'string'))) return false;
    if (item.manualVerification !== undefined) {
      const v = item.manualVerification;
      if (!record(v) || !strings(v, ['url','source','checkedAt','validUntil','reviewer','evidenceId','evidenceHash','locator','auctionAt']) || typeof v.observedBid !== 'number' || !Number.isFinite(v.observedBid)) return false;
    }
    for (const key of ['evidence', 'checks']) {
      const ids = (item[key] as Record<string, unknown>[]).map(entry => entry.id);
      if (ids.some(id => !id) || new Set(ids).size !== ids.length) return false;
    }
    return item.pipelineOrigin === undefined || ['manual', 'file-import', 'verified-catalog'].includes(String(item.pipelineOrigin));
  })) throw new Error('Estrutura da base local inválida');
  const ids = (value.items as Record<string, unknown>[]).map(item => item.id);
  if (new Set(ids).size !== ids.length) throw new Error('IDs repetidos na base local');
  if (value.selectedId !== undefined && typeof value.selectedId !== 'string') throw new Error('Seleção inválida');
  if (value.importBatches !== undefined && !arrayOf(value.importBatches, entry => record(entry) && strings(entry, ['id', 'fileName', 'importedAt']) && ['rows', 'created', 'updated'].every(key => typeof entry[key] === 'number' && Number.isFinite(entry[key]) && Number(entry[key]) >= 0))) throw new Error('Histórico de importações inválido');
  if (value.sourceChecks !== undefined && !arrayOf(value.sourceChecks, entry => record(entry) && strings(entry, ['name', 'url', 'mode', 'checkedAt', 'status', 'message']))) throw new Error('Diagnóstico de fontes inválido');
  return value;
}
