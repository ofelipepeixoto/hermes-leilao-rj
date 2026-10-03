"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { catalogCurrent, calculate, evidenceValid, financeFields, invalidateDecision, normalize, rowsFromMatrix, safeUrl } from "@/lib/domain";
import { prepareIntake, type IntakePlan } from "@/lib/intake";
import { announcedPrice, selectionStatus, selectOpportunities } from "@/lib/selection";
import { readLocalSnapshot } from "@/lib/local-state";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Landmark,
  LockKeyhole,
  ShieldCheck,
  Upload,
} from "lucide-react";

type Kind = "Edital" | "Matrícula" | "Certidão" | "Foto" | "Parecer" | "Outro";
type CheckState =
  "aguardando evidência" | "em revisão" | "aprovado" | "bloqueado" | "vencido";
type Evidence = {
  id: string;
  name: string;
  kind: Kind;
  source: string;
  date: string;
  expiry: string;
  reviewer: string;
  confidence: "Alta" | "Média" | "Baixa";
  quarantine: "Em quarentena" | "Revisado" | "Recusado";
  hash: string;
  blobKey: string;
  integrity?: "pendente" | "verificado" | "ausente";
};
type Check = {
  id: string;
  title: string;
  blocking: boolean;
  kind?: Kind;
  status: CheckState;
  reviewer: string;
  why?: string;
  officialSource?: string;
};
type Finance = {
  commissionPct: number;
  taxes: number;
  debts: number;
  dispossession: number;
  marketing: number;
  opexAllocated: number;
  arv: number;
  margin: number;
  bid: number;
  itbi: number;
  registry: number;
  capex: number;
  carry: number;
  selling: number;
  legal: number;
  contingency: number;
  months: number;
  capital: number;
  committed: number;
  workingCapital: number;
  opexMonthly: number;
  postDistributionReserve: number;
};
type Decision = {
  memo: boolean;
  audit: "PENDENTE" | "CONFORME" | "DIVERGÊNCIA";
  approval1: boolean;
  approval2: boolean;
};
type PipelineOrigin = "verified-catalog" | "file-import" | "manual";
type ImportBatch = {
  id: string;
  fileName: string;
  importedAt: string;
  rows: number;
  created: number;
  updated: number;
};
type SourceCheck = {
  name: string;
  url: string;
  mode: string;
  checkedAt: string;
  status: "consultada" | "bloqueado" | "indisponível" | "pendente";
  message: string;
};
type CatalogCandidate = {
  externalId: string;
  name: string;
  city: string;
  source: string;
  url: string;
  bid: number;
  auctionAt: string;
  snapshotHash?: string;
  capturedAt: string;
  note: string;
};
type Opportunity = {
  id: string;
  name: string;
  city: string;
  source: string;
  url: string;
  propertyType?: string;
  favorite?: boolean;
  stage: string;
  history: string[];
  evidence: Evidence[];
  checks: Check[];
  finance: Finance;
  decision: Decision;
  pipelineOrigin: PipelineOrigin;
  catalogStatus?: string;
  observedBid?: number;
  auctionAt?: string;
  snapshotHash?: string;
  capturedAt?: string;
  updated: string;
  tenantId: string;
  organizationId: string;
};

const STORE = "hermes-leilao-rj-v4";
const now = () => new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo"}).format(new Date());
const uid = () =>
  String(Date.now()) + "-" + Math.random().toString(36).slice(2);
const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 2,
});
const caixaSnapshotUrl =
  "https://venda-imoveis.caixa.gov.br/sistema/download-lista.asp";
const newChecks = (): Check[] => [
  {
    id: uid(),
    title: "Fonte oficial, URL e captura",
    blocking: true,
    status: "aguardando evidência",
    reviewer: "Executivo",
    why: "Preserva rastreabilidade da oportunidade.",
    officialSource: "Portal oficial ou upload manual homologado",
  },
  {
    id: uid(),
    title: "Edital vigente e identificação do lote",
    blocking: true,
    kind: "Edital",
    status: "aguardando evidência",
    reviewer: "Revisão humana",
    why: "Confirma modalidade, regras e responsabilidades.",
    officialSource: "Leiloeiro ou credor oficial",
  },
  {
    id: uid(),
    title: "Matrícula atualizada, ônus e cadeia dominial",
    blocking: true,
    kind: "Matrícula",
    status: "aguardando evidência",
    reviewer: "Jurídico",
    why: "Apura titularidade, gravames e riscos registrais.",
    officialSource: "Cartório competente / documento público anexado",
  },
  {
    id: uid(),
    title: "Comparáveis, ARV e liquidez",
    kind: "Parecer",
    blocking: true,
    status: "aguardando evidência",
    reviewer: "Mercado",
    why: "Sustenta a faixa conservadora de saída.",
    officialSource: "Comparáveis documentados e revisão humana",
  },
  {
    id: uid(),
    title: "Débitos, ocupação e estratégia jurídica",
    kind: "Parecer",
    blocking: true,
    status: "aguardando evidência",
    reviewer: "Jurídico",
    why: "Define custo, prazo e risco de regularização.",
    officialSource: "Órgãos oficiais e parecer jurídico",
  },
];
const newFinance = (): Finance => Object.fromEntries(financeFields.map(k => [k, k === "margin" ? 30 : NaN])) as Finance;
const fmt = (value: number) => Number.isFinite(value) ? brl.format(value) : "Pendente";
const pct = (value: number) => Number.isFinite(value) ? (value * 100).toFixed(1) + "%" : "Pendente";
const make = (data: Partial<Opportunity> = {}): Opportunity => ({
  id: uid(),
  name: "Novo ativo",
  city: "RJ",
  source: "Manual",
  url: "",
  propertyType: "Pendente",
  stage: "Triagem inicial",
  history: ["Registro criado localmente"],
  evidence: [],
  checks: newChecks(),
  finance: newFinance(),
  decision: {
    memo: false,
    audit: "PENDENTE",
    approval1: false,
    approval2: false,
  },
  pipelineOrigin: "manual",
  updated: now(),
  tenantId: "local-owner",
  organizationId: "hermes-leiloes-rj-local",
  ...data,
});
const stages = [
  "Mandato e política",
  "Originação e captura",
  "Normalização e deduplicação",
  "Documentos e edital",
  "Triagem inicial",
  "Mercado e comparáveis",
  "Underwriting e MAO",
  "Due diligence",
  "Memo de investimento",
  "Auditoria independente",
  "Comitê e limite",
  "Sessão humana de leilão",
  "Pós-arrematação",
  "CAPEX e cronograma",
  "Comercial e saída",
  "Conciliação e lições",
];
const initial = (): Opportunity[] => [];
async function hash(file: Blob) {
  const bytes = await file.arrayBuffer();
  const h = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(h))
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
}
function openFiles() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open("hermes-leilao-files", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("files");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function storeFiles(files: { key: string; file: File }[]) {
  const d = await openFiles();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = d.transaction("files", "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error("Gravação de anexos cancelada"));
      try {
        for (const { key, file } of files) tx.objectStore("files").put(file, key);
      } catch (error) {
        tx.abort();
        reject(error);
      }
    });
  } finally {
    d.close();
  }
}
async function readStoredFile(key: string): Promise<Blob> {
  const database = await openFiles();
  try {
    return await new Promise<Blob>((resolve, reject) => {
      const request = database.transaction("files").objectStore("files").get(key);
      request.onsuccess = () => request.result instanceof Blob
        ? resolve(request.result)
        : reject(new Error("Arquivo ausente neste navegador"));
      request.onerror = () => reject(request.error);
    });
  } finally {
    database.close();
  }
}
function badge(s: CheckState) {
  return s === "aprovado"
    ? "bg-emerald-100 text-emerald-800"
    : s === "bloqueado" || s === "vencido"
      ? "bg-rose-100 text-rose-800"
      : "bg-amber-100 text-amber-800";
}

export default function Home() {
  const [items, setItems] = useState<Opportunity[]>([]);
  const [importBatches, setImportBatches] = useState<ImportBatch[]>([]);
  const [sourceChecks, setSourceChecks] = useState<SourceCheck[]>([]);
  const [refreshingCatalog, setRefreshingCatalog] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [tab, setTab] = useState("Pipeline");
  const [operationBusy,setOperationBusy] = useState(false);
  const storedSnapshot = useRef<string | null>(null);
  const [pendingImport,setPendingImport]=useState<IntakePlan|null>(null);
  const [importText,setImportText]=useState("");
  const [includeUnknown,setIncludeUnknown]=useState(true);
  const [statusFilter,setStatusFilter]=useState("");
  const [favoritesOnly,setFavoritesOnly]=useState(false);
  const [compareIds,setCompareIds]=useState<string[]>([]);
  const [sortBy,setSortBy] = useState("date");
  const [typeFilter,setTypeFilter] = useState("");
  const [sourceFilter,setSourceFilter] = useState("");
  const [cityFilter,setCityFilter] = useState("");
  const [maxBidFilter,setMaxBidFilter] = useState("");
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState(
    "Base local em modo sombra. Consultas públicas somente quando você solicita.",
  );
  const [kind, setKind] = useState<Kind>("Edital");
  const [source, setSource] = useState("Origem oficial informada pelo usuário");
  const [expiry, setExpiry] = useState("");
  const [reviewer, setReviewer] = useState("");
  const [storageBlocked, setStorageBlocked] = useState(false);
  const [confidence, setConfidence] = useState<Evidence["confidence"]>("Média");
  const [pipelineQuery, setPipelineQuery] = useState("");
  const selected = items.find((i) => i.id === selectedId) || items[0];
  const f = selected ? selected.finance : newFinance();
  const result = calculate(f);
  const { costs, mao, projected, concentration } = result;
  const validCheck = (check: Check) => check.status === "aprovado" && (check.kind
    ? !!selected?.evidence.some(e=>e.kind===check.kind && e.integrity==="verificado" && evidenceValid(e, now()))
    : !!safeUrl(selected?.url));
  const blockers = selected ? selected.checks.filter(c=>c.blocking && !validCheck(c)).length : 0;
  const expired = selected ? selected.evidence.some(e=>!!e.expiry && e.expiry<now()) : false;
  const financePass = result.pass && (!selected?.observedBid || f.bid >= selected.observedBid);
  const mandatePass = selected?.propertyType === "Apartamento" && ["riodejaneiro","riodejaneirorj"].includes(normalize(selected.city));
  const [clock,setClock]=useState(0);
  useEffect(()=>{const update=()=>setClock(Date.now());const first=setTimeout(update,0);const tick=setInterval(update,60000);return ()=>{clearTimeout(first);clearInterval(tick);};},[]);
  const committeeReady = !!selected && catalogCurrent(selected,clock) && mandatePass && blockers===0 && !expired && financePass;
  // Owner-only local storage cannot authenticate two independent approvers.
  const finalCommitteeReady = false;
  const filteredItems = useMemo(() => selectOpportunities(items,{query:pipelineQuery,source:sourceFilter,city:cityFilter,type:typeFilter,maxPrice:maxBidFilter,includeUnknown,status:statusFilter,favoritesOnly,sort:sortBy},clock),[items,pipelineQuery,sourceFilter,cityFilter,typeFilter,maxBidFilter,includeUnknown,statusFilter,favoritesOnly,sortBy,clock]);
  const comparison=items.filter(i=>compareIds.includes(i.id));
  const toggleFavorite=(id:string)=>setItems(all=>all.map(i=>i.id===id?{...i,favorite:!i.favorite}:i));
  const toggleCompare=(id:string)=>setCompareIds(ids=>ids.includes(id)?ids.filter(x=>x!==id):ids.length<3?[...ids,id]:ids);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
    if (!active) return;
    try {
      const raw = localStorage.getItem(STORE);
      storedSnapshot.current=raw;
      const data = readLocalSnapshot(raw) as {
            items?: Opportunity[];
            selectedId?: string;
            importBatches?: ImportBatch[];
            sourceChecks?: SourceCheck[];
          };
      const rawItems = Array.isArray(data.items)
        ? data.items.map((item) => ({
            ...make(item),
            finance: Object.fromEntries(financeFields.map(k=>[k, typeof item.finance?.[k] === "number" ? item.finance[k] : NaN])) as Finance,
            decision: invalidateDecision(),
            catalogStatus: item.pipelineOrigin === "verified-catalog" ? "Revalidação pendente" : item.catalogStatus,
            evidence: (item.evidence || []).map((e) => ({
              ...e,
              confidence: e.confidence || "Média",
              quarantine: e.quarantine || "Em quarentena",
              integrity: "pendente" as const,
            })),
            tenantId: item.tenantId || "local-owner",
            organizationId: item.organizationId || "hermes-leiloes-rj-local",
            pipelineOrigin:
              item.pipelineOrigin ||
              (item.source?.toLowerCase().includes("carga manual") ||
              item.source?.toLowerCase().includes("importa")
                ? "file-import"
                : "manual"),
          }))
        : initial();
      const loaded = rawItems;
      setItems(loaded);
      setImportBatches(data.importBatches || []);
      setSourceChecks(data.sourceChecks || []);
      setSelectedId(
        data.selectedId && loaded.some((i) => i.id === data.selectedId)
          ? data.selectedId
          : loaded[0]?.id || "",
      );
    } catch {
      setStorageBlocked(true);
      setItems([]);
      setSelectedId("");
      setNotice(
        "A base anterior não pôde ser lida. Ela foi preservada; salvamento bloqueado para evitar perda.",
      );
    }
    setReady(true);
    });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (ready && !storageBlocked) {
      try {
        if(localStorage.getItem(STORE)!==storedSnapshot.current) { queueMicrotask(()=>{setStorageBlocked(true);setNotice("Outra aba alterou esta base. Recarregue a página para continuar sem sobrescrever os dados.");});return; }
        const snapshot=JSON.stringify({
          items,
          selectedId,
          importBatches,
          sourceChecks,
          savedAt: new Date().toISOString(),
        });
        localStorage.setItem(STORE,snapshot);storedSnapshot.current=snapshot;
      } catch { queueMicrotask(()=>{setStorageBlocked(true);setNotice("Falha ao salvar: armazenamento indisponível ou cheio. Dados da sessão não estão garantidos.");}); }
    }
  }, [items, selectedId, importBatches, sourceChecks, ready, storageBlocked]);
  const evidenceId = selected?.id;
  const evidenceKeys = JSON.stringify(selected?.evidence.map(({id,blobKey,hash})=>({id,blobKey,hash})) || []);
  useEffect(()=> {
    const docs = JSON.parse(evidenceKeys) as Pick<Evidence, "id" | "blobKey" | "hash">[];
    if(!evidenceId || !docs.length)return;
    let active=true;const id=evidenceId;
    void (async()=>{
      const checked = await Promise.all(docs.map(async e=>{
        try {const blob=await readStoredFile(e.blobKey);return {id:e.id,integrity:await hash(blob)===e.hash?"verificado" as const:"ausente" as const};} catch{return {id:e.id,integrity:"ausente" as const};}
      }));
      if(active)setItems(all=>all.map(item=>item.id===id?{...item,evidence:item.evidence.map(e=>({...e,integrity:checked.find(c=>c.id===e.id)?.integrity || "ausente"}))}:item));
    })();return ()=>{active=false;};
  // Revalidate the stored bytes whenever the selected dossier or its blob/hash set changes.
  },[evidenceId,evidenceKeys]);
  const mutate = (fn: (i: Opportunity) => Opportunity, msg?: string) => {
    if (!selected) return;
    setItems((all) =>
      all.map((i) => (i.id === selected.id ? { ...fn(i), updated: now() } : i)),
    );
    if (msg) setNotice(msg);
  };
  const create = () => {
    const item = make();
    setItems((all) => [item, ...all]);
    setSelectedId(item.id);
    setTab("Dossiê");
    setNotice("Novo ativo criado. Anexe e revise evidências antes de avançar.");
  };
  const deleteManual = async (id: string) => {
    const item = items.find((candidate) => candidate.id === id);
    if (!item || item.pipelineOrigin !== "manual") return;
    if (!window.confirm("Excluir este registro manual e seus anexos locais?"))
      return;
    if(operationBusy)return;
    setOperationBusy(true);
    const next = items.filter((candidate) => candidate.id !== id);
    try {
      const database = await openFiles();
      const transaction = database.transaction("files", "readwrite");
      item.evidence.forEach((evidence) => transaction.objectStore("files").delete(evidence.blobKey));
      await new Promise<void>((resolve,reject)=>{transaction.oncomplete=()=>resolve();transaction.onerror=()=>reject(transaction.error);transaction.onabort=()=>reject(transaction.error);});
      database.close();
    } catch {
      setOperationBusy(false);setNotice("Exclusão não concluída: falha no armazenamento. Registro preservado.");return;
    }
    const replacement = next;
    setItems(all=>all.filter(candidate=>candidate.id!==id));
    setSelectedId(replacement[0]?.id || "");
    setNotice("Registro manual excluído deste navegador.");setOperationBusy(false);
  };
  const refreshCatalog = async () => {
    if(operationBusy)return;
    setOperationBusy(true);
    setRefreshingCatalog(true);
    try {
      const response = await fetch("/api/catalog", { cache: "no-store" });
      if (!response.ok) throw new Error("A atualização não respondeu");
      const payload = (await response.json()) as {
        sources: SourceCheck[];
        catalog: CatalogCandidate[];
      };
      setSourceChecks(payload.sources);
      const refreshed = payload.catalog.map((candidate) =>
        make({
          id: "catalog-" + candidate.externalId,
          name: candidate.name,
          city: candidate.city,
          source: candidate.source,
          url: candidate.url,
          propertyType: "Apartamento",
          stage: "Triagem inicial",
          pipelineOrigin: "verified-catalog",
          finance: { ...newFinance(), bid: candidate.bid },
          catalogStatus: "Triagem · consulta atual",
          capturedAt: candidate.capturedAt,
          observedBid: candidate.bid, auctionAt:candidate.auctionAt, snapshotHash:candidate.snapshotHash,
          history: [
            "Página pública consultada em " + candidate.capturedAt.slice(0, 10),
            "Lance observado: " + fmt(candidate.bid),
            candidate.note,
            "Triagem preliminar: ARV, MAO, edital, matrícula e revisão humana pendentes.",
          ],
        }),
      );
      setItems((all) => {
        const found = new Map(refreshed.map(i=>[i.id,i]));
        const merged = all.map(old=> {
          if(old.pipelineOrigin!=="verified-catalog") return old;
          const fresh=found.get(old.id);
          if(!fresh) return {...old,catalogStatus:"Não revalidado nesta consulta",decision:invalidateDecision()};
          found.delete(old.id);
          return {...old,name:fresh.name,city:fresh.city,url:fresh.url,capturedAt:fresh.capturedAt,catalogStatus:fresh.catalogStatus,observedBid:fresh.observedBid,auctionAt:fresh.auctionAt,snapshotHash:fresh.snapshotHash,
            history:[...old.history,"Fonte reconsultada em "+new Date().toISOString()+"; lance anunciado "+fmt(fresh.finance.bid)],decision:invalidateDecision()};
        });
        return [...found.values(),...merged];
      });
      const available = payload.sources.filter(
        (source) => source.status === "consultada",
      ).length;
      setNotice(
        String(available) +
          " fonte(s) pública(s) consultada(s) e " +
          String(refreshed.length) +
          " lote(s) em triagem com link direto foram atualizados no catálogo. Eles ainda exigem underwriting e revisão humana.",
      );
    } catch {
      setNotice("Atualização não concluída. Nenhum dado local foi alterado.");
    } finally {
      setRefreshingCatalog(false);
      setOperationBusy(false);
    }
  };
  const updateFinance = (field: keyof Finance, value: number) =>
    mutate((i) => ({
      ...i,
      finance: { ...i.finance, [field]: value },
      decision: invalidateDecision(),
      history: [
        ...i.history,
        "Premissa financeira atualizada: " + String(field),
      ],
    }));
  const updateCheck = (checkId: string, status: CheckState) => {
    const check=selected?.checks.find(c=>c.id===checkId);
    if(status==="aprovado" && check && (check.kind ? !selected?.evidence.some(e=>e.kind===check.kind && e.integrity==="verificado" && evidenceValid(e,now())) : !safeUrl(selected?.url))) {
      setNotice("Bloqueado: registre URL HTTPS válida e evidência revisada, de alta confiança, com validade e revisor identificado."); return;
    }
    mutate(i=>({...i,decision:invalidateDecision(),checks:i.checks.map(c=>c.id===checkId?{...c,status}:c),history:[...i.history,"Checklist atualizado: "+status]}));
  };
  const updateDetails = (
    field: "name" | "city" | "source" | "url" | "propertyType",
    value: string,
  ) =>
    mutate(
      (i) => ({
        ...i,
        [field]: value,
        decision: invalidateDecision(),
        history: [...i.history, "Cadastro alterado: "+field+" em "+new Date().toISOString()],
      }),
      "Cadastro do ativo atualizado localmente.",
    );

  async function importList(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || operationBusy) return;
    setOperationBusy(true);
    try {
      const extension = file.name.split(".").pop()?.toLowerCase();
      if (!extension || !["csv", "xls", "xlsx"].includes(extension)) {
        throw new Error("Formato não permitido");
      }
      if (file.size > 10 * 1024 * 1024) throw new Error("Limite de 10 MB por lista");
      const bytes = await file.arrayBuffer();
      let csv = new TextDecoder("utf-8").decode(bytes);
      if(csv.includes("\uFFFD")) csv=new TextDecoder("windows-1252").decode(bytes);
      const input = extension === "csv" ? csv : bytes;
      const book = XLSX.read(input, {
        type: extension === "csv" ? "string" : "array",
        raw: true,
      });
      const sheet = book.Sheets[book.SheetNames[0]];
      const rows = rowsFromMatrix(XLSX.utils.sheet_to_json<unknown[]>(sheet, {header:1,defval:""}));
      if (!rows.length) throw new Error("A primeira aba não contém linhas");
      setPendingImport(prepareIntake(rows,file.name));
      setNotice("Confira a prévia antes de importar. Sua base ainda não foi alterada.");
    } catch (error) {
      setNotice(
        "Importação não concluída: " +
          (error instanceof Error ? error.message : "arquivo não reconhecido") +
          ". Use CSV, XLS ou XLSX com cabeçalho.",
      );
    }
    event.target.value = "";
    setOperationBusy(false);
  }
  function previewPastedList() {
    try {
      if(new TextEncoder().encode(importText).length>10*1024*1024)throw new Error("Limite de 10 MB");
      const book=XLSX.read(importText,{type:"string",raw:true});
      const rows=rowsFromMatrix(XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[book.SheetNames[0]],{header:1,defval:""}));
      setPendingImport(prepareIntake(rows,"lista-colada.csv"));
      setNotice("Prévia pronta. Confira os avisos e confirme as linhas válidas.");
    } catch(error) {setNotice("Lista não reconhecida: "+(error instanceof Error?error.message:"revise o cabeçalho"));}
  }
  function confirmImport() {
    if(!pendingImport || storageBlocked || operationBusy)return;
    const next=[...items];let created=0,updated=0;
    for(const row of pendingImport.rows) {
      const existing=next.findIndex(i=>i.pipelineOrigin==="file-import" && ((i.id===row.id && (!row.url||!i.url||row.url===i.url)) || (!!row.url && i.url===row.url)));
      const stamp=new Date().toISOString();
      const patch={name:row.name,city:row.city,source:row.source,url:row.url,propertyType:row.propertyType,observedBid:row.observedBid,capturedAt:stamp,catalogStatus:"Revalidação manual pendente",updated:now()};
      if(existing>=0) {next[existing]={...next[existing],...patch,decision:invalidateDecision(),history:[...next[existing].history,`Arquivo ${pendingImport.fileName}, linha ${row.row}, recebido em ${stamp}. `+row.warnings.join("; ")]};updated++;}
      else {const id=next.some(i=>i.id===row.id)?row.id+"-"+encodeURIComponent(row.url||uid()):row.id;next.push(make({...patch,id,pipelineOrigin:"file-import",finance:{...newFinance(),bid:row.observedBid},history:[`Importado de ${pendingImport.fileName}, linha ${row.row}. `+row.warnings.join("; ")]}));created++;}
    }
    setItems(next);
    setImportBatches(batches=>[{id:uid(),fileName:pendingImport.fileName,importedAt:new Date().toISOString(),rows:pendingImport.total,created,updated},...batches]);
    setNotice(`${created} criado(s), ${updated} atualizado(s), ${pendingImport.rejected.length} linha(s) recusada(s) e ${pendingImport.duplicates} repetição(ões) ignorada(s). Análises e anexos anteriores foram preservados.`);
    setPendingImport(null);setImportText("");
  }
  function downloadImportReport() {
    if(!pendingImport)return;
    const blob=new Blob([JSON.stringify(pendingImport,null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="relatorio-importacao.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async function attach(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    if (!selected || !files.length || operationBusy) return;
    setOperationBusy(true);
    try {
    if(files.some(file=>file.size>20*1024*1024 || !/\.(pdf|png|jpe?g|docx?)$/i.test(file.name))) throw new Error("Use PDF, imagens ou Word até 20 MB por arquivo");
    const documents = await Promise.all(
      files.map(async (file) => {
        const key = selected.id + "/" + uid();
        return {
          id: uid(),
          name: file.name,
          kind,
          source,
          date: now(),
          expiry,
          reviewer,
          confidence,
          quarantine: "Em quarentena" as const,
          integrity: "pendente" as const,
          hash: await hash(file),
          blobKey: key,
        };
      }),
    );
    await storeFiles(documents.map((doc, index) => ({ key: doc.blobKey, file: files[index] })));
    mutate(
      (i) => ({
        ...i,
        evidence: [...i.evidence, ...documents],
        decision: invalidateDecision(),
        history: [
          ...i.history,
          documents.length + " documento(s) anexado(s) em quarentena local",
        ],
      }),
      documents.length +
        " documento(s) em quarentena. A revisão humana é obrigatória antes do uso no checklist.",
    );
    } catch(error) { setNotice("Anexo não salvo: "+(error instanceof Error?error.message:"erro de armazenamento")); }
    event.target.value = "";
    setOperationBusy(false);
  }
  async function downloadEvidence(e: Evidence) {
    try { const blob=await readStoredFile(e.blobKey);
    if(await hash(blob)!==e.hash)throw new Error("Integridade divergente");
    const u=URL.createObjectURL(blob);const a=document.createElement("a");a.href=u;a.download=e.name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000); } catch {mutate(i=>({...i,decision:invalidateDecision(),evidence:i.evidence.map(doc=>doc.id===e.id?{...doc,integrity:"ausente",quarantine:"Em quarentena"}:doc)}));setNotice("Arquivo ausente ou com integridade divergente. Reanexe a evidência; o metadado sozinho não comprova o documento.");}
  }
  if (!ready)
    return (
      <main className="grid min-h-screen place-items-center bg-[#f4f7f5]">
        Preparando ambiente local…
      </main>
    );
  const tabs = [
    "Pipeline",
    "Resumo do ativo",
    "Fluxo",
    "Dossiê",
    "Financeiro",
    "Comitê",
  ];
  return (
    <main className="min-h-screen bg-[#f4f7f5] text-[#173129]">
      <header className="border-b border-[#d7e3db] bg-[#103b2b] text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#d9f56f] text-[#103b2b]">
              <Landmark size={21} />
            </div>
            <div>
              <p className="font-bold">HERMES LEILÃO RJ</p>
              <p className="text-xs text-[#c6dacf]">
                MVP privado · modo sombra
              </p>
            </div>
          </div>
          <p className="flex items-center gap-2 text-xs text-[#d8e9de]">
            <LockKeyhole size={14} /> Dados persistem neste navegador
          </p>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-5 py-6">
        {operationBusy && <p role="status" className="mb-4 rounded-lg bg-amber-100 p-3">Processando… aguarde para editar os registros.</p>}
        {storageBlocked && <p role="alert" className="mb-4 rounded-lg bg-rose-100 p-3">{notice}</p>}
        <fieldset disabled={operationBusy || storageBlocked} className={operationBusy || storageBlocked ? "pointer-events-none opacity-70" : ""}>
        <div className="mb-5 flex flex-wrap gap-2">
          {tabs.map((item) => (
            <button
              key={item}
              onClick={() => setTab(item)}
              className={
                tab === item
                  ? "rounded-lg bg-[#103b2b] px-3 py-2 text-sm font-bold text-white"
                  : "rounded-lg bg-white px-3 py-2 text-sm font-bold text-[#466257] ring-1 ring-[#d7e3db]"
              }
            >
              {item}
            </button>
          ))}
          <button
            onClick={create}
            className="ml-auto rounded-lg bg-[#236746] px-3 py-2 text-sm font-bold text-white"
          >
            Novo ativo
          </button>
        </div>
        <div role="status" aria-live="polite" className="mb-5 flex gap-3 rounded-xl border border-[#bdd9c8] bg-[#e8f5eb] p-4 text-sm text-[#24523a]">
          <ShieldCheck className="shrink-0" size={18} />
          <p>
            <strong>Atualização.</strong> {notice}
          </p>
        </div>
        {!selected && tab !== "Pipeline" && <Card title="Comece uma análise" note="Nenhum imóvel cadastrado. Crie um ativo ou importe uma lista pelo Pipeline."><button className="btn" onClick={create}>Criar primeiro ativo</button></Card>}
        {selected && tab === "Resumo do ativo" && (
          <section className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
            <Card
              title="Resumo do ativo selecionado"
              note="Informações calculadas a partir do dossiê local; não representa decisão automática."
            >
              <div className="rounded-2xl bg-[#103b2b] p-5 text-white">
                <p className="text-xs font-bold uppercase tracking-[.16em] text-[#d9f56f]">
                  Status de análise
                </p>
                <h1 className="mt-2 text-2xl font-bold">{selected.name}</h1>
                <p className="mt-2 text-sm text-[#c6dacf]">
                  Etapa: {selected.stage} · MAO calculado: {fmt(mao)}
                </p>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <Info label="Bloqueios críticos" value={String(blockers)} />
                <Info
                  label="Validade documental"
                  value={
                    expired
                      ? "Há documento vencido"
                      : "Sem vencimento registrado"
                  }
                />
                <Info
                  label="Comitê"
                  value={
                    committeeReady
                      ? "Pré-requisitos financeiros e checklist atendidos"
                      : "Bloqueado"
                  }
                />
              </div>
            </Card>
            <Card
              title="Próximas ações obrigatórias"
              note="Derivadas diretamente do checklist; a revisão é sempre humana."
            >
              <div className="space-y-2">
                {selected.checks
                  .filter((check) => !validCheck(check))
                  .slice(0, 5)
                  .map((check) => (
                    <div
                      key={check.id}
                      className="rounded-lg bg-[#f4f7f5] p-3 text-sm"
                    >
                      <strong>{check.title}</strong>
                      <p className="mt-1 text-xs text-[#61786c]">
                        {check.reviewer} · {check.status} ·{" "}
                        {check.officialSource ||
                          "fonte oficial definida no checklist"}
                      </p>
                    </div>
                  ))}
              </div>
              <button className="btn mt-4" onClick={() => setTab("Dossiê")}>
                Abrir dossiê e checklist
              </button>
            </Card>
          </section>
        )}
        {selected && tab === "Painel" && (
          <section className="space-y-5">
            <div className="grid gap-4 md:grid-cols-3">
              <Stat
                label="Registros locais"
                value={String(items.length) + " ativo(s)"}
                note="Quantidade não equivale a aprovação."
              />
              <Metric
                label="Bloqueios do dossiê"
                value={String(blockers)}
                ok={blockers === 0}
              />
              <Metric
                label="Comitê"
                value={committeeReady ? "Submissão possível" : "Bloqueado"}
                ok={committeeReady}
              />
            </div>
            <Card
              title="Próxima ação recomendada"
              note={"Ativo selecionado: " + selected.name}
            >
              <button onClick={() => setTab("Dossiê")} className="btn">
                Abrir dossiê e checklist
              </button>
            </Card>
          </section>
        )}
        {tab === "Pipeline" && (
          <section className="space-y-5">
            <Card title="Escolha os imóveis que vale a pena analisar" note="1. Traga as oportunidades → 2. Filtre e compare → 3. Complete a análise. O perfil inicial é apartamento no município do Rio; outros municípios ficam visíveis como fora do perfil.">
              <button className="btn" onClick={refreshCatalog} disabled={refreshingCatalog}>{refreshingCatalog ? "Consultando fontes…" : "Atualizar catálogo"}</button>
              <p className="mt-3 text-xs text-[#61786c]">Zuk e Mega Leilões: consulta parcial de páginas públicas. CAIXA: importação de lista. Preço anunciado não é valor de revenda.</p>
              <details className="mt-3"><summary className="cursor-pointer text-sm font-bold">Status das fontes ({sourceChecks.filter(s=>s.status==="consultada").length} consultadas)</summary>
                <div className="mt-3 grid gap-2 md:grid-cols-2">{sourceChecks.map(source=><div key={source.name} className="rounded-lg bg-[#f4f7f5] p-3 text-sm"><a href={source.url} target="_blank" rel="noreferrer" className="font-bold underline">{source.name}</a><span className="ml-2 text-xs">{source.status}</span><p className="mt-1 text-xs">{source.message}</p><p className="mt-1 text-xs">{new Date(source.checkedAt).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"})}</p></div>)}</div>
              </details>
            </Card>
            <Card
              title="Filtrar oportunidades"
              note={
                String(filteredItems.length) +
                " de " +
                String(items.length) +
                " registro(s) exibidos."
              }
            >
              <input
                className="input mb-4"
                value={pipelineQuery}
                onChange={(e) => setPipelineQuery(e.target.value)}
                placeholder="Buscar por ID, imóvel, cidade, fonte, etapa ou URL"
                aria-label="Buscar no pipeline local"
              />
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Fonte"><select className="input" value={sourceFilter} onChange={e=>setSourceFilter(e.target.value)}><option value="">Todas</option>{[...new Set(items.map(i=>i.source))].sort().map(v=><option key={v}>{v}</option>)}</select></Field>
                <Field label="Cidade"><select className="input" value={cityFilter} onChange={e=>setCityFilter(e.target.value)}><option value="">Todas as cidades</option>{[...new Set(items.map(i=>i.city))].sort().map(city=><option key={city}>{city}</option>)}</select></Field>
                <Field label="Preço anunciado máximo"><input type="number" min="0" className="input" value={maxBidFilter} onChange={e=>setMaxBidFilter(e.target.value)} placeholder="Sem limite" /></Field>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field label="Tipo de imóvel"><select className="input" value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}><option value="">Todos</option><option>Apartamento</option><option>Casa</option><option>Outro</option><option>Pendente</option></select></Field>
                <Field label="Ordenar por"><select className="input" value={sortBy} onChange={e=>setSortBy(e.target.value)}><option value="date">Data do leilão</option><option value="price">Menor preço anunciado</option><option value="name">Nome do imóvel</option></select></Field>
              </div>
              <div className="mt-4 flex flex-wrap gap-3 text-sm">
                <label><input type="checkbox" checked={includeUnknown} onChange={e=>setIncludeUnknown(e.target.checked)} /> Incluir imóveis sem preço informado</label>
                <label><input type="checkbox" checked={favoritesOnly} onChange={e=>setFavoritesOnly(e.target.checked)} /> Só meus favoritos</label>
                <Field label="Situação"><select className="input" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="">Todas as situações</option>{["Completar análise","Rever viabilidade","Revisar documentos","Revalidar fonte","Evento passado","Fora do perfil"].map(v=><option key={v}>{v}</option>)}</select></Field>
              </div>
              <button className="btn mt-3" onClick={()=>{setStatusFilter("");setFavoritesOnly(false);setIncludeUnknown(true);setPipelineQuery("");setSourceFilter("");setCityFilter("");setMaxBidFilter("");setTypeFilter("");setSortBy("date");}}>Limpar filtros</button>
            </Card>
            {comparison.length>0 && <Card title={`Comparar ${comparison.length} de até 3 imóveis`} note="Compare preço, custo total, retorno e pendências. Favoritar ou comparar não aprova uma compra.">
              <div className="grid gap-4 md:grid-cols-3">{comparison.map(item=>{const r=calculate(item.finance);return <article key={item.id} className="rounded-xl border p-4"><h3 className="font-bold">{item.name}</h3><p className="text-sm">{item.city}</p><dl className="my-3 space-y-2 text-sm"><dt>Preço anunciado</dt><dd className="font-bold">{fmt(announcedPrice(item))}</dd><dt>Custo total estimado</dt><dd>{fmt(r.costs)}</dd><dt>Saída conservadora</dt><dd>{fmt(item.finance.arv)}</dd><dt>Margem direta / teto calculado</dt><dd>{pct(r.projected)} / {fmt(r.mao)}</dd><dt>Situação</dt><dd>{selectionStatus(item,clock)}</dd></dl><button className="btn" onClick={()=>{setSelectedId(item.id);setTab("Resumo do ativo");}}>Analisar</button><button className="ml-3 underline" onClick={()=>toggleCompare(item.id)}>Remover</button></article>;})}</div>
            </Card>}
            <Card title="Oportunidades para analisar" note={`${filteredItems.length} resultado(s). Nenhum resultado desta lista é aprovação de investimento. Selecione até três para comparar.`}>
              <PipelineTable items={filteredItems} empty={items.length?"Nenhum resultado com estes filtros. Limpe os filtros ou inclua os preços pendentes.":"Sua lista está vazia. Atualize o catálogo ou importe a lista CAIXA abaixo."} onOpen={id=>{setSelectedId(id);setTab("Resumo do ativo");}} onFavorite={toggleFavorite} onCompare={toggleCompare} compareIds={compareIds} at={clock} onDelete={deleteManual}/>
            </Card>
            <details><summary className="cursor-pointer rounded-xl bg-white p-4 font-bold">Importar lista CSV ou Excel</summary>
            <Card
              title="Traga sua lista de oportunidades"
              note="CSV, XLS e XLSX são processados no navegador e ficam separados do catálogo público em triagem."
            >
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#b6cfc0] bg-[#f8fbf8] p-7 text-sm font-bold text-[#236746]">
                <Upload size={18} /> Selecionar lista de oportunidades
                <input
                  className="hidden"
                  type="file"
                  accept=".csv,.xls,.xlsx"
                  onChange={importList}
                />
              </label>
              <p className="mt-3 text-xs text-[#61786c]">
                Cabeçalhos reconhecidos: ID, URL/Link, Nome/Imóvel/Endereço,
                Cidade, UF, Preço, Fonte/Origem e Descrição. Confira a prévia: reimportações preservam o financeiro e os anexos.
              </p>
              <p className="mt-2 text-xs text-[#61786c]">
                O download público da CAIXA pode ser usado como arquivo de
                entrada; o envio não pesquisa nem altera fontes externas.{" "}
                <a
                  className="font-bold text-[#236746] underline"
                  href={caixaSnapshotUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Abrir página oficial de download da lista CAIXA
                </a>
              </p>
              <details className="mt-4"><summary className="cursor-pointer font-bold">Prefere colar os dados da planilha?</summary><p className="my-2 text-sm">Copie as células com cabeçalho e cole aqui. Funciona também com texto CSV.</p><textarea className="input min-h-32" aria-label="Dados da lista" value={importText} onChange={e=>setImportText(e.target.value)} placeholder="ID;Nome;Cidade;UF;Preço;Link"/><button className="btn mt-2" disabled={!importText.trim()} onClick={previewPastedList}>Conferir lista colada</button></details>
              {importBatches.length>0 && <details className="mt-4"><summary>Últimas importações</summary>{importBatches.slice(0,5).map(b=><p className="mt-2 text-xs" key={b.id}>{b.fileName}: {b.created} novos, {b.updated} atualizados · {b.importedAt.slice(0,10)}</p>)}</details>}
            </Card>
            </details>
          </section>
        )}
        {pendingImport && tab === "Pipeline" && <Card title="Confira antes de importar" note={`${pendingImport.fileName}: ${pendingImport.total} linha(s), ${pendingImport.rows.length} válida(s), ${pendingImport.rejected.length} recusada(s), ${pendingImport.duplicates} repetida(s).`}>
          <p className="mb-3 text-sm">Preços desconhecidos ficam pendentes. Avaliação do banco não é usada como preço de revenda. Datas e disponibilidade exigem conferência.</p>
          <div className="max-h-80 overflow-auto"><table className="w-full text-left text-sm"><thead><tr><th>Linha</th><th>Imóvel / cidade</th><th>Preço</th><th>Avisos</th></tr></thead><tbody>{pendingImport.rows.slice(0,100).map(r=><tr className="border-b" key={r.row}><td>{r.row}</td><td className="p-2">{r.name}<br/>{r.city}</td><td>{fmt(r.observedBid)}</td><td className="p-2">{r.warnings.join("; ")}</td></tr>)}</tbody></table>{pendingImport.rejected.slice(0,100).map(r=><p className="mt-2 text-sm text-rose-700" key={r.row}>Linha {r.row}: {r.reason}</p>)}</div>
          <p className="my-3 text-xs">Prévia limitada a 100 linhas por grupo. O relatório inclui todas as linhas.</p>
          <div className="flex flex-wrap gap-3"><button className="btn" disabled={!pendingImport.rows.length} onClick={confirmImport}>Importar {pendingImport.rows.length} linhas válidas</button><button className="btn" onClick={downloadImportReport}>Baixar relatório completo</button><button className="underline" onClick={()=>setPendingImport(null)}>Cancelar</button></div>
        </Card>}
        {selected && tab === "Fluxo" && (
          <section className="space-y-5">
            <Card
              title="Fluxo completo do imóvel"
              note="Mapa de referência. A etapa registrada não elimina pendências nem libera avanço automático."
            >
              <div className="grid gap-3 md:grid-cols-2">
                {stages.map((stage, index) => (
                  <div
                    key={stage}
                    className={
                      selected.stage === stage
                        ? "rounded-xl border-2 border-[#236746] bg-[#e8f5eb] p-4 text-left"
                        : "rounded-xl border border-[#d7e3db] bg-white p-4 text-left"
                    }
                  >
                    <p className="text-xs font-bold text-[#61786c]">
                      {String(index + 1).padStart(2, "0")}
                    </p>
                    <p className="mt-1 font-bold">{stage}</p>
                    <p className="mt-1 text-xs text-[#71877b]">
                      {index < 11
                        ? "Análise e decisão controlada"
                        : "Execução exclusivamente humana e fora do sistema"}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
            <Card
              title="Próximo passo guiado"
              note="Use o dossiê para completar evidências e checklist. A etapa é apenas um registro de acompanhamento."
            >
              <div className="grid gap-3 sm:grid-cols-3">
                <Info label="Etapa atual" value={selected.stage} />
                <Info
                  label="Documento crítico"
                  value={
                    selected.checks.find((c) => !validCheck(c))
                      ?.title || "Checklist completo"
                  }
                />
                <Info
                  label="Fonte oficial"
                  value={selected.url || "Registrar URL de origem"}
                />
              </div>
              <button className="btn mt-4" onClick={() => setTab("Dossiê")}>
                Abrir checklist do ativo
              </button>
            </Card>
          </section>
        )}
        {selected && tab === "Dossiê" && (
          <section className="space-y-5">
            <div className="grid gap-5 lg:grid-cols-2">
              <Card
                title="Dossiê do ativo"
                note={selected.name + " · " + selected.id}
              >
                <div key={selected.id} className="grid gap-3 sm:grid-cols-2">
                  <Field label="Nome do imóvel">
                    <input
                      className="input"
                      defaultValue={selected.name}
                      onBlur={(event) =>
                        updateDetails(
                          "name",
                          event.currentTarget.value.trim() || "Novo ativo",
                        )
                      }
                    />
                  </Field>
                  <Field label="Tipo do imóvel"><select className="input" value={selected.propertyType || "Pendente"} onChange={e=>updateDetails("propertyType",e.target.value)}><option>Pendente</option><option>Apartamento</option><option>Casa</option><option>Outro</option></select></Field>
                  <Field label="Cidade / UF">
                    <input
                      className="input"
                      defaultValue={selected.city}
                      onBlur={(event) =>
                        updateDetails("city", event.currentTarget.value.trim())
                      }
                    />
                  </Field>
                  <Field label="Fonte">
                    <input
                      className="input"
                      defaultValue={selected.source}
                      onBlur={(event) =>
                        updateDetails(
                          "source",
                          event.currentTarget.value.trim() || "Manual",
                        )
                      }
                    />
                  </Field>
                  <Field label="URL da oportunidade">
                    <input
                      className="input"
                      type="url"
                      defaultValue={selected.url}
                      placeholder="https://..."
                      onBlur={(event) =>
                        updateDetails("url", event.currentTarget.value.trim())
                      }
                    />
                  </Field>
                  <Info
                    label="Histórico"
                    value={String(selected.history.length) + " evento(s)"}
                  />
                  <Info label="Atualização" value={selected.updated} />
                </div>
                <p className="mt-4 text-xs text-[#61786c]">
                  O identificador do registro é imutável para preservar
                  deduplicação e histórico local.
                </p>
              </Card>
              <Card
                title="Anexos e evidências"
                note="O arquivo e seus metadados ficam no armazenamento local deste navegador."
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Tipo">
                    <select
                      className="input"
                      value={kind}
                      onChange={(e) => setKind(e.target.value as Kind)}
                    >
                      {[
                        "Edital",
                        "Matrícula",
                        "Certidão",
                        "Foto",
                        "Parecer",
                        "Outro",
                      ].map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Origem / órgão">
                    <input
                      className="input"
                      value={source}
                      onChange={(e) => setSource(e.target.value)}
                    />
                  </Field>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <Field label="Validade">
                    <input
                      className="input"
                      type="date"
                      value={expiry}
                      onChange={(e) => setExpiry(e.target.value)}
                    />
                  </Field>
                  <Field label="Revisor responsável">
                    <input
                      className="input"
                      value={reviewer}
                      onChange={(e) => setReviewer(e.target.value)}
                    />
                  </Field>
                  <Field label="Confiança">
                    <select
                      className="input"
                      value={confidence}
                      onChange={(e) =>
                        setConfidence(e.target.value as Evidence["confidence"])
                      }
                    >
                      <option>Alta</option>
                      <option>Média</option>
                      <option>Baixa</option>
                    </select>
                  </Field>
                </div>
                <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#b6cfc0] p-5 text-sm font-bold text-[#236746]">
                  <FileText size={18} /> Anexar documentos
                  <input
                    className="hidden"
                    type="file"
                    multiple
                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                    onChange={attach}
                  />
                </label>
                <div className="mt-3 space-y-2">
                  {selected.evidence.length ? (
                    selected.evidence.map((e) => (
                      <div
                        key={e.id}
                        className="rounded-lg bg-[#f4f7f5] p-3 text-sm"
                      >
                        <strong>{e.name}</strong>
                        <p className="mt-1 text-xs text-[#61786c]">
                          {e.kind +
                            " · " +
                            e.source +
                            " · hash " +
                            e.hash.slice(0, 12) +
                            "… · validade " +
                            (e.expiry || "a informar") +
                            " · " +
                            e.reviewer +
                            " · " +
                            (e.confidence || "Média") +
                            " · " +
                            (e.quarantine || "Em quarentena") + " · integridade " + (e.integrity || "pendente")}
                        </p>
                        <div className="mt-2 flex gap-3"><button className="btn" onClick={()=>downloadEvidence(e)}>Baixar anexo</button><button className="btn" onClick={()=>{ if(e.integrity!=="verificado" || !evidenceValid({...e,reviewer,expiry,confidence,quarantine:"Revisado"},now())) {setNotice("Informe origem, revisor identificado, data de validade vigente e confiança Alta para revisar.");return;} mutate(i=>({...i,decision:invalidateDecision(),evidence:i.evidence.map(doc=>doc.id===e.id?{...doc,reviewer,expiry,confidence,quarantine:"Revisado"}:doc),history:[...i.history,"Evidência revisada: "+e.name+" por "+reviewer]})); }}>Registrar revisão documental</button></div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-[#71877b]">
                      Nenhum documento anexado.
                    </p>
                  )}
                </div>
              </Card>
            </div>
            <Card
              title="Checklist e workflow"
              note="Pendência, divergência ou evidência vencida bloqueiam o comitê."
            >
              <div className="space-y-3">
                {selected.checks.map((check) => (
                  <div
                    key={check.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e1eae3] p-3"
                  >
                    <div>
                      <p className="text-sm font-bold">
                        {check.title}
                        {check.blocking && (
                          <span className="ml-2 text-xs text-[#b84629]">
                            BLOQUEANTE
                          </span>
                        )}
                      </p>
                      <p className="mt-1 text-xs text-[#71877b]">
                        Responsável: {check.reviewer}
                        {" · Evidência: "}
                        {check.kind || "análise/revisão"}
                      </p>
                      <p className="mt-1 max-w-xl text-xs text-[#61786c]">
                        Por que: {check.why || "Confirmar pela revisão humana."}{" "}
                        · Fonte:{" "}
                        {check.officialSource ||
                          "fonte oficial definida pelo responsável"}
                      </p>
                    </div>
                    <select
                      value={check.status}
                      onChange={(e) =>
                        updateCheck(check.id, e.target.value as CheckState)
                      }
                      className={
                        "rounded-lg px-3 py-2 text-xs font-bold " +
                        badge(check.status)
                      }
                    >
                      {[
                        "aguardando evidência",
                        "em revisão",
                        "aprovado",
                        "bloqueado",
                        "vencido",
                      ].map((state) => (
                        <option key={state}>{state}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </Card>
          </section>
        )}
        {selected && tab === "Financeiro" && (
          <section className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
            <Card
              title="Cálculo financeiro preliminar"
              note="Premissas alinhadas ao modelo auditado: margem ≥ 30%, custo/saída ≤ 70%, ciclo ≤ 9 meses e concentração ≤ 20%."
            >
              <p className="mb-3 text-sm">{result.missing.length} campo(s) pendente(s). Preencha por etapa; use zero somente quando o custo for comprovadamente inexistente.</p><h3 className="mb-3 font-bold">1. Compra e revenda</h3><div className="grid gap-3 sm:grid-cols-2">
                <Num
                  label="Por quanto espera revender? (conservador)"
                  value={f.arv}
                  set={(n) => updateFinance("arv", n)}
                />
                <Num
                  label="Margem alvo (%)"
                  value={f.margin}
                  set={(n) => updateFinance("margin", n)}
                />
                <Num
                  label="Lance proposto"
                  value={f.bid}
                  set={(n) => updateFinance("bid", n)}
                />
                <Num label="Comissão leiloeiro (%)" value={f.commissionPct} set={n=>updateFinance("commissionPct",n)} />
                </div><details className="mt-5 rounded-xl border p-4"><summary className="cursor-pointer font-bold">2. Custos e prazo do imóvel</summary><div className="mt-3 grid gap-3 sm:grid-cols-2"><Num label="Tributos da venda (validar)" value={f.taxes} set={n=>updateFinance("taxes",n)} />
                <Num label="Débitos assumidos" value={f.debts} set={n=>updateFinance("debts",n)} />
                <Num label="Desocupação" value={f.dispossession} set={n=>updateFinance("dispossession",n)} />
                <Num label="Comercialização adicional" value={f.marketing} set={n=>updateFinance("marketing",n)} />
                <Num label="OPEX rateado ao ativo" value={f.opexAllocated} set={n=>updateFinance("opexAllocated",n)} />
                <Num
                  label="ITBI"
                  value={f.itbi}
                  set={(n) => updateFinance("itbi", n)}
                />
                <Num
                  label="Registro / certidões"
                  value={f.registry}
                  set={(n) => updateFinance("registry", n)}
                />
                <Num
                  label="Reforma com reserva de obra"
                  value={f.capex}
                  set={(n) => updateFinance("capex", n)}
                />
                <Num
                  label="Condomínio, IPTU e contas até vender"
                  value={f.carry}
                  set={(n) => updateFinance("carry", n)}
                />
                <Num
                  label="Venda / corretagem"
                  value={f.selling}
                  set={(n) => updateFinance("selling", n)}
                />
                <Num
                  label="Jurídico / regularização"
                  value={f.legal}
                  set={(n) => updateFinance("legal", n)}
                />
                <Num
                  label="Contingência"
                  value={f.contingency}
                  set={(n) => updateFinance("contingency", n)}
                />
                <Num
                  label="Prazo (meses)"
                  value={f.months}
                  set={(n) => updateFinance("months", n)}
                />
                </div></details><details className="mt-5 rounded-xl border p-4"><summary className="cursor-pointer font-bold">3. Caixa e reservas da operação</summary><div className="mt-3 grid gap-3 sm:grid-cols-2"><Num
                  label="Capital imobiliário"
                  value={f.capital}
                  set={(n) => updateFinance("capital", n)}
                />
                <Num
                  label="Giro já comprometido (outros ativos)"
                  value={f.committed}
                  set={(n) => updateFinance("committed", n)}
                />
                <Num
                  label="Caixa livre antes desta aquisição"
                  value={f.workingCapital}
                  set={(n) => updateFinance("workingCapital", n)}
                />
                <Num
                  label="OPEX mensal"
                  value={f.opexMonthly}
                  set={(n) => updateFinance("opexMonthly", n)}
                />
                <Num
                  label="Reserva pós-distribuição"
                  value={f.postDistributionReserve}
                  set={(n) => updateFinance("postDistributionReserve", n)}
                />
              </div></details>
            </Card>
            <Card
              title="O que os números mostram"
              note="Cálculo local; nunca autorização automática de compra."
            >
              <p className="mb-2 text-sm">{!mandatePass ? "Mandato pendente: confirme apartamento no município do Rio de Janeiro. Expansão exige homologação." : ""}</p>
              <p className="mb-2 text-sm">{selected.observedBid && f.bid < selected.observedBid ? "Bloqueado: lance proposto abaixo do preço anunciado atual." : ""}</p>
              <p className="mb-3 text-sm">{result.missing.length ? `Complete os ${result.missing.length} campos pendentes para concluir a análise.` : result.pass ? "Critérios numéricos atendidos. Confira a fonte e os documentos." : "Os números precisam de revisão antes de avançar."}</p><details className="mb-4 text-sm"><summary className="cursor-pointer font-bold">Ver motivos e campos pendentes</summary><ul className="mt-2 list-disc pl-5">{result.reasons.map(reason=><li key={reason}>{reason}</li>)}</ul></details>
              <Info label="ROI sobre custo direto" value={pct(result.roi)} />
              <Info label="Margem após OPEX rateado" value={pct(result.loadedMargin)} />
              <Metric
                label="Teto de lance calculado (MAO)"
                value={fmt(mao)}
                ok={mao >= f.bid}
              />
              <Metric
                label="Custo total do ativo"
                value={fmt(costs)}
                ok={costs / f.arv <= 0.7}
              />
              <Metric
                label="Margem direta antes do OPEX"
                value={pct(projected)}
                ok={projected >= 0.3}
              />
              <Metric
                label="Concentração de capital"
                value={pct(concentration)}
                ok={concentration <= 0.2}
              />
              <Metric
                label="Ciclo estimado"
                value={Number.isFinite(f.months) ? String(f.months) + " meses" : "Pendente"}
                ok={f.months <= 9}
              />
              <Metric
                label="Folga de capital de giro"
                value={
                  pct(result.remaining / f.capital)
                }
                ok={result.remaining >= f.capital * 0.25}
              />
              <Metric
                label="Reserva pós-distribuição"
                value={fmt(f.postDistributionReserve)}
                ok={f.postDistributionReserve >= f.opexMonthly * 12}
              />
            </Card>
            <Card title="Critérios e limites do cálculo" note="Saída conservadora de R$180–350 mil, margem direta ≥30%, ciclo ≤9 meses, concentração ≤20%, giro restante ≥25% e reserva ≥12 meses de OPEX.">
              <p className="text-sm">A margem direta segue o modelo Holding V1.1. O OPEX rateado é exibido separadamente. Tributos, dívidas, bases de ITBI e comparáveis exigem validação humana. TIR, cenários completos e waterfall ainda não estão implementados.</p>
            </Card>
          </section>
        )}
        {selected && tab === "Comitê" && (
          <section className="grid gap-5 lg:grid-cols-2">
            <Card
              title="Memo de investimento"
              note="Consolida dados locais; não cria proposta ou lance."
            >
              <button
                onClick={() => {
                  const snapshot={generatedAt:new Date().toISOString(),mode:"preliminary-local",policy:"holding-v1.1-direct-margin",opportunity:selected,calculation:result,committeeAuthorized:false};
                  const url=URL.createObjectURL(new Blob([JSON.stringify(snapshot,null,2)],{type:"application/json"}));
                  const a=document.createElement("a");a.href=url;a.download="memo-"+selected.id+".json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
                  mutate(i=>({...i,decision:{...i.decision,memo:true},history:[...i.history,"Snapshot de memo exportado em "+snapshot.generatedAt]}),"Memo preliminar exportado; não constitui autorização de compra.");
                }}
                className="btn"
              >
                Exportar memo preliminar
              </button>
              <p className="mt-4 text-sm text-[#526b5d]">
                {selected.decision.memo
                  ? "Memo: ARV " +
                    fmt(f.arv) +
                    ", MAO " +
                    fmt(mao) +
                    ", bloqueios " +
                    blockers +
                    ", margem " +
                    (projected * 100).toFixed(1) +
                    "%."
                  : "Memo ainda não gerado."}
              </p>
            </Card>
            <Card
              title="Preparação do comitê humano"
              note="Só habilitado quando a documentação, workflow e regras financeiras estiverem conformes."
            >
              <p
                className={
                  committeeReady
                    ? "mb-4 rounded-lg bg-emerald-100 p-3 text-sm font-bold text-emerald-800"
                    : "mb-4 rounded-lg bg-rose-100 p-3 text-sm font-bold text-rose-800"
                }
              >
                {committeeReady
                  ? "Apto apenas para submissão ao comitê humano."
                  : "Bloqueado: conclua o checklist, a validade documental e os gates financeiros."}
              </p>
              <p className="text-sm">Dupla aprovação autenticada indisponível nesta versão local de conta única. Registros digitados não comprovam duas pessoas independentes. Anexe os pareceres para preparar o comitê; nenhuma aprovação final será emitida pelo MVP.</p>
              <div className="mt-4 rounded-xl bg-[#f4f7f5] p-4 text-sm">
                <strong>Limite de lance proposto:</strong> {fmt(mao)}
                <p className="mt-1 text-xs text-[#61786c]">
                  Sem execução de lance, proposta, pagamento, assinatura ou
                  contratação.
                </p>
              </div>
              <div
                className={
                  finalCommitteeReady
                    ? "mt-3 rounded-xl bg-emerald-100 p-3 text-sm font-bold text-emerald-800"
                    : "mt-3 rounded-xl bg-amber-100 p-3 text-sm font-bold text-amber-800"
                }
              >
                {finalCommitteeReady
                  ? "Dossiê apto somente para deliberação humana sobre o limite; nenhuma execução é disponibilizada."
                  : "Comitê final bloqueado: é necessária revisão independente e dupla aprovação fora deste MVP local."}
              </div>
            </Card>
          </section>
        )}
        </fieldset>
      </div>
    </main>
  );
}
function Card({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#d7e3db] bg-white p-5 shadow-sm">
      <h2 className="font-bold">{title}</h2>
      <p className="mt-1 text-sm text-[#61786c]">{note}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-[#61786c]">
        {label}
      </span>
      {children}
    </label>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[#f4f7f5] p-3">
      <p className="text-xs text-[#71877b]">{label}</p>
      <p className="mt-1 break-words font-semibold">{value}</p>
    </div>
  );
}
function Num({
  label,
  value,
  set,
}: {
  label: string;
  value: number;
  set: (n: number) => void;
}) {
  return (
    <Field label={label}>
      <input
        type="number"
        min="0"
        value={Number.isFinite(value) ? value : ""}
        placeholder="Pendente"
        onChange={(e) => set(e.target.value === "" ? NaN : Number(e.target.value))}
        className="input"
      />
    </Field>
  );
}
function Metric({
  label,
  value,
  ok,
}: {
  label: string;
  value: string;
  ok: boolean;
}) {
  return (
    <article
      className={
        ok
          ? "rounded-xl border border-emerald-200 bg-emerald-50 p-4"
          : "rounded-xl border border-rose-200 bg-rose-50 p-4"
      }
    >
      <p className="text-xs font-bold text-[#61786c]">{label}</p>
      <p className="mt-2 text-xl font-bold">{value}</p>
      <p
        className={
          ok
            ? "mt-2 flex items-center gap-1 text-xs font-bold text-emerald-700"
            : "mt-2 flex items-center gap-1 text-xs font-bold text-rose-700"
        }
      >
        {ok ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
        {ok ? " Conforme" : " Revisar / bloqueia"}
      </p>
    </article>
  );
}
function Stat({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <article className="rounded-xl border border-[#d7e3db] bg-white p-4">
      <p className="text-xs font-bold text-[#61786c]">{label}</p>
      <p className="mt-2 text-xl font-bold">{value}</p>
      <p className="mt-2 text-xs font-medium text-[#61786c]">{note}</p>
    </article>
  );
}
function PipelineTable({
  items,
  empty,
  onOpen,
  onDelete, onFavorite, onCompare, compareIds, at,
}: {
  items: Opportunity[];
  empty: string;
  onOpen: (id: string) => void;
  onDelete?: (id: string) => void;
  onFavorite: (id:string)=>void;
  onCompare: (id:string)=>void;
  compareIds: string[];
  at: number;
}) {
  const filterSignature=items.map(i=>i.id).join("|");
  const [pagination,setPagination]=useState({signature:filterSignature,page:0});
  if(pagination.signature!==filterSignature)setPagination({signature:filterSignature,page:0});
  const page=pagination.signature===filterSignature?pagination.page:0;
  const setPage=(page:number)=>setPagination({signature:filterSignature,page});
  const currentPage=Math.min(page,Math.max(0,Math.ceil(items.length/50)-1));
  if (!items.length)
    return (
      <p className="rounded-lg bg-[#f4f7f5] p-4 text-sm text-[#61786c]">
        {empty}
      </p>
    );
  return (
    <div className="overflow-x-auto">
      <div className="mb-3 flex items-center gap-3 text-sm"><button className="btn" disabled={currentPage===0} onClick={()=>setPage(currentPage-1)}>Anterior</button><span>{items.length} registros · página {currentPage+1} de {Math.ceil(items.length/50)}</span><button className="btn" disabled={(currentPage+1)*50>=items.length} onClick={()=>setPage(currentPage+1)}>Próxima</button></div>
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="border-b text-left text-xs uppercase tracking-wide text-[#6a8175]">
            <th className="p-3">Ativo</th>
            <th className="p-3">Fonte</th>
            <th className="p-3">Preço / data</th>
            <th className="p-3">Etapa</th>
            <th className="p-3">Abrir</th>
            <th className="p-3">Selecionar</th>
            {onDelete && <th className="p-3">Ação</th>}
          </tr>
        </thead>
        <tbody>
          {items.slice(currentPage*50,(currentPage+1)*50).map((item) => (
            <tr
              key={item.id}
              onClick={() => onOpen(item.id)}
              className="cursor-pointer border-b border-[#edf2ee] hover:bg-[#f6faf7]"
            >
              <td className="p-3 font-bold">
                {item.name}
                <p className="mt-1 text-xs font-normal text-[#71877b]">
                  {item.city + " · " + item.id}
                </p>
              </td>
              <td className="p-3">
                {item.source}
                <p className="mt-1 text-xs text-[#71877b]">
                  {item.url ? "URL registrada" : "URL pendente"}
                </p>
              </td>
              <td className="p-3">{fmt(announcedPrice(item))}<p className="text-xs">{item.auctionAt ? new Date(item.auctionAt).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"}) : "Data / disponibilidade pendente"}</p></td>
              <td className="p-3"><strong>{selectionStatus(item,at)}</strong><p className="text-xs">{item.pipelineOrigin==="verified-catalog"?"Catálogo público":item.pipelineOrigin==="file-import"?"Lista importada":"Cadastro manual"}</p></td>
              <td className="p-3" onClick={(event) => event.stopPropagation()}>
                {safeUrl(item.url) ? (
                  <a
                    href={safeUrl(item.url)}
                    target="_blank"
                    rel="noreferrer"
                    className="font-bold text-[#236746] underline"
                  >
                    Ver oportunidade
                  </a>
                ) : (
                  <span className="text-xs text-[#b84629]">Sem URL</span>
                )}
              </td>
              <td className="p-3 space-y-2" onClick={e=>e.stopPropagation()}><button className="btn" onClick={()=>onOpen(item.id)}>Analisar imóvel</button><button className="block underline" aria-pressed={!!item.favorite} onClick={()=>onFavorite(item.id)}>{item.favorite?"★ Favorito":"☆ Favoritar"}</button><label className="block"><input type="checkbox" checked={compareIds.includes(item.id)} disabled={!compareIds.includes(item.id)&&compareIds.length>=3} onChange={()=>onCompare(item.id)} /> Comparar</label></td>
              {onDelete && (
                <td
                  className="p-3"
                  onClick={(event) => event.stopPropagation()}
                >
                  <button
                    className="text-xs font-bold text-rose-700 underline"
                    disabled={item.pipelineOrigin!=="manual"} onClick={() => onDelete(item.id)}
                  >
                    Excluir
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
