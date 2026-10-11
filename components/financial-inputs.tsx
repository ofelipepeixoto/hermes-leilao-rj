"use client";

import { useState } from 'react';
import { financeGroups, financeIssue, firstFinanceIssue, type FinanceKey } from '@/lib/finance-guidance';

export function FinancialInputs({ finance, onChange, name, observedBid }: {
  finance: Record<FinanceKey, number>;
  onChange: (key: FinanceKey, value: number) => void;
  name: string;
  observedBid?: number;
}) {
  const first = firstFinanceIssue(finance);
  const [step, setStep] = useState(() => first?.group ?? 0);
  const pending = financeGroups.map(group => group.fields.filter(({ key }) => financeIssue(key, finance[key])).length);
  function go(group: number, field?: FinanceKey) {
    setStep(group);
    requestAnimationFrame(() => document.getElementById(field ? 'finance-' + field : 'finance-step-title')?.focus());
  }
  return <>
    <p className="text-sm"><strong>{name}</strong> · premissas salvas neste navegador. Ao retomar, abrimos a primeira etapa com pendências. Edições exigem nova revisão do checklist.</p>
    <p className="mt-2 text-sm">Use zero somente quando o custo for comprovadamente inexistente. Um campo vazio continua pendente.</p>
    <nav aria-label="Etapas das premissas financeiras" className="my-4 grid gap-2 sm:grid-cols-3">
      {financeGroups.map((group, index) => <button key={group.title} className={'btn text-left ' + (step === index ? 'primary' : '')} aria-current={step === index ? 'step' : undefined} onClick={() => go(index)}>
        {index + 1}. {group.title}<span className="mt-1 block text-xs">{pending[index] ? `${pending[index]} campo(s) para revisar` : 'Campos preenchidos · validar resultado'}</span>
      </button>)}
    </nav>
    {first && <button className="btn mb-4" onClick={() => go(first.group, first.key)}>Ir à primeira pendência</button>}
    <h3 id="finance-step-title" tabIndex={-1} className="mb-3 font-bold">Etapa {step + 1} de 3 · {financeGroups[step].title}</h3>
    {step === 0 && <p className="mb-4 rounded-lg bg-[#f4f7f5] p-3 text-sm">Preço anunciado na fonte: <strong>{Number.isFinite(observedBid) ? observedBid!.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'pendente'}</strong>. Este valor é separado do lance simulado e da saída conservadora.</p>}
    <div className="grid gap-4 sm:grid-cols-2">
      {financeGroups[step].fields.map(field => {
        const value = finance[field.key];
        const issue = financeIssue(field.key, value);
        const id = 'finance-' + field.key;
        return <div key={field.key}>
          <label htmlFor={id} className="mb-1 block text-sm font-bold">{field.label}</label>
          <input id={id} className="input" type="number" inputMode="decimal" min="0" step="any" value={Number.isFinite(value) ? value : ''} placeholder="Pendente" aria-invalid={!!issue && Number.isFinite(value)} aria-describedby={id + '-help' + (issue ? ' ' + id + '-issue' : '')} onChange={event => onChange(field.key, event.target.value === '' ? NaN : Number(event.target.value))} />
          <p id={id + '-help'} className="mt-1 text-xs text-[#526b5d]">{field.help}</p>
          {issue && <p id={id + '-issue'} className={'mt-1 text-xs ' + (Number.isFinite(value) ? 'text-rose-800' : 'text-[#526b5d]')}>{issue}</p>}
        </div>;
      })}
    </div>
    <div className="mt-5 flex flex-wrap justify-between gap-3">
      <button className="btn" disabled={step === 0} onClick={() => go(step - 1)}>Etapa anterior</button>
      {step < 2 && <button className="btn primary" onClick={() => go(step + 1)}>Continuar para {step === 0 ? 'custos e prazo' : 'caixa e reservas'}</button>}
    </div>
  </>;
}
