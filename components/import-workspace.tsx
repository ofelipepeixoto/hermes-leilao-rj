"use client";

import { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { rowsFromMatrix } from '@/lib/domain';
import { prepareIntake, type IntakePlan } from '@/lib/intake';
import { intakeImpact, intakeReviewCurrent, type IntakeReview } from '@/lib/intake-workflow';

const DRAFT = 'hermes-intake-text-v1';
const MAX_DRAFT = 1024 * 1024;
const price = (n: number) => Number.isFinite(n) ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Preço pendente';

export function ImportWorkspace({ items, baseVersion, onConfirm, onContinue }: {
  items: { id: string; url: string; pipelineOrigin?: string }[];
  baseVersion: string;
  onConfirm: (plan: IntakePlan, baseVersion: string) => { message: string; firstId: string };
  onContinue: (importedId: string) => void;
}) {
  const [mode, setMode] = useState<'file' | 'text'>('file');
  const [text, setText] = useState('');
  const [draftReady, setDraftReady] = useState(false);
  const [draftStatus, setDraftStatus] = useState('');
  const [inputVersion, setInputVersion] = useState(1);
  const [review, setReview] = useState<IntakeReview | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [completedId, setCompletedId] = useState<string | null>(null);
  const generation = useRef(0);
  const mounted = useRef(false);
  const feedback = useRef<HTMLDivElement>(null);
  const previewHeading = useRef<HTMLHeadingElement>(null);
  const current = intakeReviewCurrent(review, inputVersion, baseVersion);
  const plan = current ? review!.plan : null;
  const impact = plan ? intakeImpact(plan, items) : null;

  useEffect(() => {
    mounted.current = true;
    queueMicrotask(() => {
      if (!mounted.current) return;
      try {
        const saved = sessionStorage.getItem(DRAFT);
        if (saved) { setText(saved); setMode('text'); setMessage('Rascunho de texto retomado. Gere uma nova prévia antes de importar.'); }
      } catch { setDraftStatus('Rascunho indisponível neste navegador. Guarde uma cópia do texto.'); }
      setDraftReady(true);
    });
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!draftReady) return;
    try {
      if (new TextEncoder().encode(text).length > MAX_DRAFT) {
        sessionStorage.removeItem(DRAFT);
        queueMicrotask(() => setDraftStatus('Texto acima de 1 MB: não guardado para retomada. Mantenha a planilha original.'));
      } else {
        if (text) sessionStorage.setItem(DRAFT, text); else sessionStorage.removeItem(DRAFT);
        queueMicrotask(() => setDraftStatus(text ? 'Texto guardado nesta aba para recarregar a página. Fechar a aba encerra esta retomada.' : ''));
      }
    } catch { queueMicrotask(() => setDraftStatus('Não foi possível guardar o rascunho. Copie o texto antes de sair.')); }
  }, [text, draftReady]);

  function changed() {
    setCompletedId(null);
    generation.current++;
    setInputVersion(version => version + 1);
    setReview(null); setAccepted(false); setError(''); setMessage('Entrada alterada. Gere uma nova prévia.');
  }
  function fail(reason: unknown) {
    setReview(null); setAccepted(false);
    setError((reason instanceof Error ? reason.message : 'Arquivo não reconhecido') + '. Corrija a entrada e gere a prévia novamente. Nenhum registro foi importado.');
    requestAnimationFrame(() => feedback.current?.focus());
  }
  function parse(input: string | ArrayBuffer, fileName: string, version: number) {
    const book = XLSX.read(input, { type: typeof input === 'string' ? 'string' : 'array', raw: true });
    const sheet = book.Sheets[book.SheetNames[0]];
    if (!sheet) throw new Error('A planilha não contém uma primeira aba');
    const rows = rowsFromMatrix(XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' }));
    if (!rows.length) throw new Error('Há cabeçalho, mas nenhuma linha de imóvel');
    setReview({ plan: prepareIntake(rows, fileName), inputVersion: version, baseVersion });
    setError(''); setMessage('Prévia pronta. Confira os registros e as pendências antes de confirmar.'); setAccepted(false);
    requestAnimationFrame(() => previewHeading.current?.focus());
  }
  async function readFile(file?: File) {
    if (!file) return;
    changed();
    const ticket = generation.current;
    const version = inputVersion + 1;
    setBusy(true);
    try {
      const extension = file.name.split('.').pop()?.toLowerCase();
      if (!extension || !['csv', 'xls', 'xlsx'].includes(extension)) throw new Error('Use arquivo CSV, XLS ou XLSX');
      if (file.size > 10 * 1024 * 1024) throw new Error('O arquivo excede 10 MB');
      const bytes = await file.arrayBuffer();
      if (!mounted.current || ticket !== generation.current) return;
      let input: string | ArrayBuffer = bytes;
      if (extension === 'csv') {
        input = new TextDecoder('utf-8').decode(bytes);
        if (input.includes('\uFFFD')) input = new TextDecoder('windows-1252').decode(bytes);
      }
      parse(input, file.name, version);
    } catch (reason) { if (mounted.current && ticket === generation.current) fail(reason); }
    finally { if (mounted.current && ticket === generation.current) setBusy(false); }
  }
  function previewText() {
    changed();
    try {
      if (new TextEncoder().encode(text).length > 10 * 1024 * 1024) throw new Error('O texto excede 10 MB');
      parse(text, 'lista-colada.csv', inputVersion + 1);
    } catch (reason) { fail(reason); }
  }
  function confirm() {
    if (!plan || !accepted || busy) return;
    try {
      const outcome = onConfirm(plan, review!.baseVersion);
      setReview(null); setText(''); setAccepted(false); setMessage(outcome.message); setError('');
      setCompletedId(outcome.firstId);
      requestAnimationFrame(() => feedback.current?.focus());
    } catch (reason) { fail(reason); }
  }
  function continueImport() {
    if (!completedId) return;
    try { onContinue(completedId); }
    catch (reason) {
      setCompletedId(null);
      setError(reason instanceof Error ? reason.message : 'Não foi possível abrir o imóvel importado. Confira os registros no Pipeline.');
      requestAnimationFrame(() => feedback.current?.focus());
    }
  }
  function report() {
    if (!plan) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify({ inputVersion, ...plan }, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'relatorio-importacao.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <section aria-labelledby="import-heading" className="rounded-2xl border border-[#d7e3db] bg-white p-5 shadow-sm">
    <h2 id="import-heading" tabIndex={-1} className="font-bold">1. Traga sua lista de oportunidades</h2>
    <p className="mt-2 text-sm">O arquivo é lido neste navegador. A prévia não grava imóveis nem consulta fontes externas.</p>
    <fieldset disabled={busy} className="mt-4 min-w-0">
      <legend className="text-sm font-bold">Como você quer trazer a lista?</legend>
      <div className="my-3 flex flex-wrap gap-3">
        {(['file', 'text'] as const).map(value => <label key={value} className="choice"><input type="radio" name="intake-mode" checked={mode === value} onChange={() => { changed(); setMode(value); }} /> {value === 'file' ? 'Selecionar arquivo' : 'Colar da planilha'}</label>)}
      </div>
      <p id="import-format" className="mb-3 text-sm text-[#526b5d]">Use ID ou link estável e cabeçalho reconhecido. Preço, cidade ou tipo ausentes serão marcados como pendentes. Limites: 10 MB, 10.000 linhas, primeira aba.</p>
      {mode === 'file' ? <>
        <label htmlFor="intake-file" className="block text-sm font-bold">Lista CSV ou Excel</label>
        <input id="intake-file" className="input mt-2" type="file" accept=".csv,.xls,.xlsx" aria-describedby="import-format file-resume" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void readFile(file); }} />
        <p id="file-resume" className="mt-2 text-xs">Para retomar após recarregar, selecione o arquivo novamente. Dossiês já importados continuam salvos.</p>
      </> : <>
        <label htmlFor="intake-text" className="text-sm font-bold">Dados da lista</label>
        <textarea id="intake-text" className="input mt-2 min-h-40" value={text} aria-describedby="import-format draft-status" onChange={event => { changed(); setText(event.target.value); }} placeholder="ID;Nome;Cidade;UF;Preço;Link" />
        <p id="draft-status" className="mt-2 text-xs">{draftStatus}</p>
        <button className="btn primary mt-3" disabled={!text.trim()} onClick={previewText}>Gerar prévia da lista</button>
      </>}
      <details className="mt-4 text-sm"><summary>Ver exemplo de cabeçalho e linha fictícia</summary>
        <pre className="mt-2 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-[#f4f7f5] p-3">{'ID;Nome;Cidade;UF;Preço;Tipo;Fonte;Link\nDEMO-001;Apartamento fictício;Rio de Janeiro;RJ;;Apartamento;DEMO FICTÍCIA;https://example.org/imovel-demo'}</pre>
        <p className="mt-2">Exemplo de formato, não uma oportunidade real. Mantenha demonstrações em um perfil de navegador separado dos seus dossiês.</p>
      </details>
    </fieldset>
    <div ref={feedback} tabIndex={-1} className="mt-4" role={error ? 'alert' : 'status'} aria-live={error ? 'assertive' : 'polite'}>
      {busy ? 'Lendo a primeira aba… aguarde a prévia.' : error || message}
    </div>
    {completedId && <button className="btn primary mt-3" onClick={continueImport}>Analisar primeiro imóvel importado</button>}
    {review && !current && <p role="alert" className="mt-3 text-sm text-rose-800">A base mudou após a prévia. Gere outra prévia para conferir quais registros serão atualizados.</p>}
    {plan && impact && <div className="mt-5 border-t border-[#d7e3db] pt-5">
      <h3 ref={previewHeading} tabIndex={-1} className="font-bold">2. Confira antes de importar · versão {inputVersion}</h3>
      <p className="mt-2 break-words text-sm">{plan.fileName}: {plan.total} linha(s). {impact.created} novo(s), {impact.updated} atualização(ões), {plan.rejected.length} recusada(s), {plan.duplicates} repetida(s).</p>
      <p className="mt-2 text-sm">Destino: base local deste navegador. Atualizações preservam financeiro e anexos; preço anunciado e cadastro são substituídos. A revisão anterior perde validade se os dados mudarem.</p>
      <p className="mt-2 text-sm">Preço pendente não é zero. A avaliação do banco não preenche a revenda. Toda linha exige conferência de fonte, data e disponibilidade.</p>
      <div className="mt-4 max-h-96 space-y-3 overflow-auto rounded-lg border p-3" role="region" aria-label="Linhas da prévia" tabIndex={0}>
        {plan.rows.slice(0, 100).map(row => <article key={row.row} className="break-words border-b border-[#d7e3db] pb-3 text-sm">
          <h4 className="font-bold">Linha {row.row} · {row.name}</h4><p>{row.city} · {row.propertyType} · {price(row.observedBid)}</p>
          <ul className="mt-1 list-disc pl-5">{row.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>
        </article>)}
        {plan.rejected.slice(0, 100).map(row => <p key={row.row} className="text-sm text-rose-800"><strong>Recusada · linha {row.row}:</strong> {row.reason}</p>)}
      </div>
      <p className="my-3 text-xs">Exibidas até 100 linhas por grupo. Baixe o relatório para conferir todas.</p>
      {plan.rows.length > 0 ? <label className="choice text-sm"><input type="checkbox" checked={accepted} onChange={event => setAccepted(event.target.checked)} /> Revisei esta versão e suas pendências. Quero importar {plan.rows.length} linha(s) na base local.</label> : <p className="text-sm font-bold text-rose-800">Nenhuma linha pode ser importada. Corrija os motivos acima e gere outra prévia.</p>}
      <div className="mt-4 flex flex-wrap gap-3">
        <button className="btn primary" disabled={!accepted || !plan.rows.length} onClick={confirm}>Importar {plan.rows.length} linha(s) revisada(s)</button>
        <button className="btn" onClick={report}>Baixar relatório completo</button>
        <button className="btn" onClick={() => { changed(); setMessage('Prévia descartada. A entrada foi preservada para correção.'); }}>Voltar à entrada</button>
      </div>
    </div>}
  </section>;
}
