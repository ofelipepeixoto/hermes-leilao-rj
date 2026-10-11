import { financeFields } from './domain.ts';

export type FinanceKey = typeof financeFields[number];
type Field = { key: FinanceKey; label: string; help: string };
export const financeGroups: { title: string; fields: Field[] }[] = [
  { title: 'Compra e revenda', fields: [
    { key: 'arv', label: 'Saída conservadora (R$)', help: 'Preço de revenda sustentado por comparáveis. Não use a avaliação do banco como revenda confirmada.' },
    { key: 'margin', label: 'Margem alvo (%)', help: '30% é o mínimo da política Holding V1.1, não uma previsão de lucro.' },
    { key: 'bid', label: 'Lance proposto (R$)', help: 'Premissa de simulação. O preço anunciado pode ser diferente; nenhum lance é enviado.' },
    { key: 'commissionPct', label: 'Comissão do leiloeiro (%)', help: 'Confira o percentual no edital. Não há comissão presumida.' },
  ] },
  { title: 'Custos e prazo do imóvel', fields: [
    { key: 'taxes', label: 'Tributos da venda (R$)', help: 'Valor a validar com a análise tributária.' },
    { key: 'debts', label: 'Débitos assumidos (R$)', help: 'Confira dívidas e responsabilidades nos documentos.' },
    { key: 'dispossession', label: 'Desocupação (R$)', help: 'Custo estimado conforme ocupação e parecer jurídico.' },
    { key: 'marketing', label: 'Comercialização adicional (R$)', help: 'Despesas adicionais à corretagem, sem contá-las duas vezes.' },
    { key: 'opexAllocated', label: 'OPEX rateado ao ativo (R$)', help: 'Despesa operacional atribuída a este imóvel. Exibida separadamente da margem direta.' },
    { key: 'itbi', label: 'ITBI (R$)', help: 'Valor estimado a validar; o sistema não presume alíquota ou base.' },
    { key: 'registry', label: 'Registro e certidões (R$)', help: 'Inclua os custos documentais previstos.' },
    { key: 'capex', label: 'Reforma com reserva de obra (R$)', help: 'Orçamento de obras, incluindo sua reserva.' },
    { key: 'carry', label: 'Condomínio, IPTU e contas até vender (R$)', help: 'Total estimado durante a permanência do imóvel.' },
    { key: 'selling', label: 'Venda e corretagem (R$)', help: 'Custo de venda estimado; não um percentual.' },
    { key: 'legal', label: 'Jurídico e regularização (R$)', help: 'Custos previstos na avaliação jurídica.' },
    { key: 'contingency', label: 'Contingência (R$)', help: 'Reserva para imprevistos não incluída nos demais custos.' },
    { key: 'months', label: 'Prazo (meses)', help: 'Ciclo completo previsto, da aquisição à saída.' },
  ] },
  { title: 'Caixa e reservas da operação', fields: [
    { key: 'capital', label: 'Capital imobiliário (R$)', help: 'Base para o limite de concentração de 20% por ativo.' },
    { key: 'committed', label: 'Giro já comprometido (R$)', help: 'Capital comprometido com outros ativos.' },
    { key: 'workingCapital', label: 'Caixa livre antes da aquisição (R$)', help: 'Disponibilidade antes desta compra, limitada ao capital imobiliário.' },
    { key: 'opexMonthly', label: 'OPEX mensal (R$)', help: 'Despesa operacional mensal da operação.' },
    { key: 'postDistributionReserve', label: 'Reserva pós-distribuição (R$)', help: 'Deve cobrir pelo menos 12 meses do OPEX mensal informado.' },
  ] },
];

/** Field guidance mirrors existing input constraints; calculate() remains the policy gate. */
export function financeIssue(key: FinanceKey, value: number) {
  if (!Number.isFinite(value)) return 'Pendente: informe um valor sustentado por evidência. Desconhecido não significa zero.';
  if (value < 0) return 'Informe zero ou um valor positivo; valores negativos são inválidos.';
  if (['bid', 'capital', 'arv', 'months', 'opexMonthly'].includes(key) && value === 0) return 'Este campo precisa ser maior que zero.';
  if (key === 'arv' && (value < 180000 || value > 350000)) return 'Fora da política: saída entre R$180 mil e R$350 mil. Revise a evidência; não ajuste só para passar.';
  if (key === 'margin' && (value < 30 || value >= 100)) return 'Use margem de 30% a menos de 100%.';
  if (key === 'commissionPct' && value > 100) return 'Comissão acima de 100% é inválida. Confira o edital.';
  if (key === 'months' && value > 9) return 'Ciclo acima de 9 meses: fora da política atual.';
  return '';
}

export function firstFinanceIssue(finance: Record<FinanceKey, number>) {
  for (let group = 0; group < financeGroups.length; group++) {
    const field = financeGroups[group].fields.find(({ key }) => financeIssue(key, finance[key]));
    if (field) return { group, key: field.key };
  }
  return null;
}
