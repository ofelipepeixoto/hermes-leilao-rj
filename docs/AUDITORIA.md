# Auditoria técnica e de produto — 26/09/2026

## Escopo e autoridade das fontes

Revisados os seis materiais fornecidos pelo proprietário: projeto principal revisado, modelo Holding V1.1, Investment Machine, estudo de viabilidade, esqueleto de software e protocolo de benchmark. Os documentos originais não são publicados. Também foi confrontado o código da aplicação existente com o plano.

O projeto revisado e o modelo Holding V1.1 orientam o mandato. O cockpit Investment Machine usa convenções diferentes e não substitui esse modelo. Margem direta antes do OPEX, margem após rateio e ROI têm denominadores distintos. O gate documental histórico G4 continuava NO-GO: aprovação antiga de segurança ou contagem de testes do esqueleto não certifica esta aplicação.

## Correções implementadas

| Problema | Correção |
| --- | --- |
| Catálogo baseado em exemplos fixos | Descoberta de listagens públicas com verificações de tipo, cidade, data, preço e estado da página de detalhe |
| Atualização apagava análise local | Mesclagem por identidade; preserva financeiro, evidências e histórico; ausência marca não revalidado |
| Nome do arquivo e ID genérico confundiam fornecedores | Identidade de origem/host/arquivo; URLs divergentes não são fundidas somente pelo ID |
| Reimportação ignorava tipo e preço | Atualiza tipo e mínimo observado, preservando lance proposto e dossiê |
| Leilão passado/cancelado poderia parecer atual | Verificação do estado fora do título; consulta recente e evento futuro exigidos no catálogo |
| Campos ausentes interpretados como zero | Valores pendentes explícitos, inclusive após salvar e reabrir |
| MAO ignorava comissão | MAO = (saída × (1 − margem) − custos não-lance) / (1 + comissão) |
| Concentração confundia exposição do ativo com toda carteira | Custo deste ativo / capital; compromissos tratados separadamente no giro |
| Evidência apenas cadastrada parecia suficiente | Revisor, confiança alta, validade, hash e bytes presentes exigidos para checklist |
| Aprovações locais pareciam dupla revisão | Aprovação final bloqueada até revisão independente autenticada |
| Corrupção/quota/outra aba podia sobrescrever dados | Salvamento bloqueado com mensagem; comparação com última versão lida |
| Primeiro contato tinha excesso de controles | Pipeline como entrada, filtros e resultados antes da importação; diagnóstico das fontes recolhido |

Mandato inicial: apartamento no município do Rio, saída conservadora R$180–350 mil, margem direta ≥30%, custo/saída ≤70%, prazo ≤9 meses, concentração ≤20%, folga de giro ≥25% do capital e reserva ≥12 meses de OPEX. Capital e despesas do usuário não são presumidos. Expansão territorial exige homologação.

## Verificação executada

- Checagem TypeScript e build passaram.
- 21 testes automatizados passaram: 16 de domínio/conectores e cinco de componentes/renderização.
- Casos de domínio cobrem MAO e comissão, reconciliação sintética, ausência/negativos, giro, concentração, moeda brasileira, cabeçalho CAIXA, URL insegura, evidência, cancelamento, redirecionamento, limite de resposta, identidade por fonte e vigência.
- Consulta direta dos adaptadores às páginas públicas encontrou 23 candidatos (4 Zuk e 19 Mega) em 26/09/2026, 06:52 UTC. Isso comprova uma execução datada, não disponibilidade contínua ou cobertura completa.
- Na prévia, o runtime não conseguiu consultar os portais. A falha é apresentada sem apagar o histórico; não foi contornada com técnicas de evasão.
- Navegação no navegador: abertura, novo ativo, edição cadastral e campos financeiros pendentes conferidos.
- Teste de upload no navegador não concluído: a revisão de permissões recusou o envio do arquivo. Testes locais do leitor não substituem essa verificação de ponta a ponta.

## Pendências e limites

- Coleta sem paginação completa, sem garantia de abrangência, preço atualizado ou disponibilidade. Falhas de fonte não significam ausência de oportunidades.
- Restauração integral dos anexos, prévia de importação e relatório de rejeições por linha ainda precisam de implementação.
- Controle entre abas detecta base alterada antes de gravar, mas não é transação distribuída nem colaboração multiusuário.
- Hash de listagem e hash de anexo não demonstram autenticidade jurídica nem extração auditada por página/trecho.
- TIR, waterfall, cenários de portfólio, conciliação de realizados e agentes autônomos não estão implementados.
- Supabase: não há conexão no código nem banco remoto implantado nesta entrega. A fase compartilhada requer identidade, autorização por organização, RLS, políticas de Storage e testes de isolamento e recuperação; seleção do conector não implica migração dos dados locais.
- Não houve validação jurídica de títulos, dívidas, editais, tributos ou decisões de investimento. O gate operacional permanece aberto.

## Dependências

A varredura inicial `npm audit` identificou 25 alertas agregados (um crítico, 17 altos, seis moderados e um baixo), incluindo dependências de build. A contagem não equivale à demonstração de exploração na aplicação. O resultado final e as atualizações aplicadas são registrados na seção seguinte.

### Resultado da correção de dependências

Atualizados Next para 16.3.6, React/React DOM/RSC para 19.2.8, Vite para 8.0.16 e SheetJS para 0.20.3 pela distribuição oficial, com lockfile. Aplicadas atualizações transitivas compatíveis e overrides específicos de image-size, ws, undici, sharp e esbuild do runtime de desenvolvimento, sem migrar o runtime para versão alfa.

Varredura final: **zero críticos, zero altos e quatro moderados**, todos no caminho de desenvolvimento `drizzle-kit → @esbuild-kit → esbuild`. Não foi aplicado o downgrade incompatível sugerido automaticamente pelo npm. Essas dependências de geração de schema não são usadas pelo aplicativo implantado; sua remoção/substituição exige revisar o fluxo futuro de migrações. A auditoria não certifica ausência de vulnerabilidades desconhecidas.

O novo teste de importação encontrou coerção incorreta de moeda brasileira pelo leitor CSV. A leitura passou a preservar texto bruto antes da normalização monetária; o caso regressivo verifica CSV e XLSX.

Fontes das correções: [SheetJS oficial](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/), [advisory React](https://github.com/advisories/GHSA-wx67-qw84-cm4g), [advisory Next](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4) e relatório do registro npm.
