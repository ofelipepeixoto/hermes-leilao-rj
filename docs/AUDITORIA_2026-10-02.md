# Auditoria complementar — 02/10/2026

Repositório: `ofelipepeixoto/hermes-leilao-rj`, baseline `f608d45`.
Data no fuso America/Sao_Paulo. Revisão do código, execução no ambiente de nuvem
e testes com dados sintéticos. O repositório já estava público. A revisão não
depende dos documentos privados citados na auditoria histórica.

## Defeitos reproduzidos e corrigidos

| Área | Comportamento anterior | Correção |
| --- | --- | --- |
| Financeiro | Entradas finitas extremas podiam produzir custo infinito com `pass: true` | Resultados não finitos bloqueiam a viabilidade e explicam a premissa inválida |
| Evidências | Data inexistente ou texto como validade podia passar na comparação textual | Validação de data ISO e calendário; mesma regra no registro de revisão |
| Importação | Repetição do segundo lote com mesmo código e outra URL era tratada como conflito e removia o lote válido | Duplicatas reconhecidas após desambiguação da identidade |
| Planilhas | Colunas repetidas sobrescreviam valores silenciosamente | Cabeçalhos equivalentes são recusados antes de importar |
| Filtros | Desmarcar preços pendentes só funcionava com teto de preço preenchido | O filtro funciona com ou sem teto |
| Persistência | JSON válido com estrutura inválida podia virar base vazia ou provocar erro de interface | Estrutura e IDs validados antes da carga; base anterior preservada e gravação bloqueada |
| Anexos | Leitura com erro podia deixar conexão IndexedDB aberta; download não rechecava os bytes | Fechamento em `finally` e SHA-256 conferido antes de baixar; divergência volta à quarentena |
| React/CI | Lint falhava em inicialização, efeitos e paginação | Hidratação e tratamento de armazenamento sincronizados; paginação reajustada sem efeito extra; CI executa lint |
| Dependências | Novo alerta alto em `undici` 7.29.0 | Patch 7.29.1 com integridade no lockfile; CI bloqueia alertas altos/críticos |

Foram adicionados sete testes de regressão, incluídos em `npm test` e
`npm run test:unit`. As mudanças mantêm os cálculos determinísticos, os dados
no navegador e a aprovação final bloqueada nesta versão local.

## Verificações

- Instalação repetida pelo helper com `npm ci`, preflight e verificação de integridade.
- TypeScript, lint, build Worker e 38 testes automatizados aprovados, sem skips.
- Chromium: upload de CSV, prévia, moeda brasileira, preço pendente, favorito,
  upload de PDF sintético, hash, revisão, download com os mesmos bytes,
  reabertura do dossiê/anexo, rejeição de download adulterado e preservação de base inválida.
- Página inicial servida por HTTP com HTML Hermes; endpoint real `/api/catalog`
  exercitado tanto no Vite/Worker local quanto no servidor Node com proxy.
- `npm audit`: zero críticos, zero altos e quatro moderados, todos na cadeia
  `drizzle-kit → @esbuild-kit → esbuild`, usada para geração de schema.
  Não foi aplicado downgrade incompatível para ocultar esses alertas.
- Verificação dos 110 arquivos versionados do baseline: nenhum `.env`, chave
  privada ou padrão de credencial identificado. É uma checagem de padrões,
  não uma certificação de ausência de segredos.

## Integrações e rede

| Integração | Resultado nesta execução | Limite |
| --- | --- | --- |
| Zuk | Cinco candidatos e cinco detalhes acessíveis pelo adaptador e endpoint Node | Uma página, consulta parcial e condições sujeitas a mudança |
| Mega Leilões | 16 candidatos e 16 detalhes acessíveis pelo adaptador e endpoint Node | Uma página, máximo 20 detalhes por fonte |
| Vite/Worker local | Página e importação funcionam; portais ficaram indisponíveis no endpoint | Worker local não usou a rota de proxy da máquina; o histórico é preservado |
| CAIXA | Importador CSV/XLS/XLSX testado com dados sintéticos | Download e importação manual; sem API automática |
| Santander/Itaú | Adaptadores ausentes, apresentados como pendentes | Não há integração implementada |
| TJRJ | Link de referência | Não é catálogo de lotes |
| Supabase/D1/R2 | Sem uso operacional pelo MVP; D1/R2 locais sem bindings | Não há persistência remota nem isolamento por organização |
| GitHub | Checkout e página pública confirmados | Publicação do commit deve ser conferida pelo resultado de push, não pelo acesso de leitura |

Os 21 resultados são candidatos de triagem obtidos nesta consulta. Não demonstram
cobertura completa, disponibilidade futura ou elegibilidade de investimento.
O suporte ao proxy foi validado em Node 24 com `NODE_USE_ENV_PROXY=1`; não foram
desabilitadas verificações TLS nem contornados controles dos fornecedores.

## Limites restantes

O projeto Sites citado pelo proprietário não tem ferramentas de leitura ou
publicação disponíveis nesta sessão. Esta auditoria verifica o checkout e os
servidores locais; não certifica a versão publicada em Sites nem sua rede.

Persistência continua vinculada ao navegador e à origem. Bytes dos anexos e
metadados ficam em armazenamentos separados; não há transação única entre
IndexedDB e localStorage, restauração integral de backup, colaboração ou
autenticação de dois revisores. Não há lances, pagamentos, assinaturas ou
agentes autônomos operacionais. Esses pontos exigem evolução de produto própria.

Fontes: [advisories de undici](https://github.com/nodejs/undici/security/advisories),
relatório `npm audit` desta execução e as respostas reais dos portais.
