# Fontes e dados do Sistema Leilão

Revisão em 26/09/2026. O produto auxilia a seleção e análise de imóveis; não executa investimentos. Descoberta, avaliação financeira, evidência jurídica e aprovação são etapas distintas.

| Fonte | Acesso confirmado na documentação | Uso correto | Situação nesta versão |
| --- | --- | --- | --- |
| CAIXA | [Download oficial de lista](https://venda-imoveis.caixa.gov.br/sistema/download-lista.asp) | Originação por arquivo, preservando ID e link | Importação local com prévia; nenhum endpoint privado ou CAPTCHA é contornado |
| Zuk e Mega | Páginas públicas dos portais | Descoberta parcial com consulta do detalhe | Adaptadores HTML existentes; falhas de detalhe contabilizadas. Não são APIs oficiais |
| IBGE Localidades | [API oficial](https://servicodados.ibge.gov.br/api/docs/localidades) | Padronizar códigos de municípios e identificar regiões | Documentação verificada; integração futura, não determina preço, disponibilidade ou aprovação |
| CNJ DataJud | [API pública de metadados](https://datajud-wiki.cnj.jus.br/api-publica/), [acesso](https://datajud-wiki.cnj.jus.br/api-publica/acesso/) | Apoio à consulta processual com chave pública e regras de acesso vigentes | Não integrado. Não substitui autos completos, certidões, matrícula ou parecer jurídico |
| Banco Central SGS | [Dados oficiais da Selic](https://dadosabertos.bcb.gov.br/dataset/11-taxa-de-juros---selic) | Contexto de custo de oportunidade, com unidade e periodicidade corretas | Não integrado; não aplicar automaticamente como taxa de financiamento |
| Santander, Itaú e TJRJ | Referências oficiais já listadas no catálogo | Homologação individual de acesso e direitos | Sem adaptador de coleta homologado |

Não foi identificada nesta revisão uma API pública única que entregue catálogo completo, preço de revenda, situação jurídica e disponibilidade. Ausência de confirmação não é prova de inexistência. Bases de metadados e geografia não tornam um imóvel juridicamente apto.

## Regras da informação

- IDs são texto. Valores monetários passam por validação de formato, sem substituir ausências por zero.
- UF acompanha a cidade. O mandato atual da interface é município do Rio; demais municípios continuam visíveis, rotulados fora do perfil. A visão RJ e Região Metropolitana do projeto maior ainda exige homologação territorial.
- Preço anunciado, lance proposto, avaliação do credor e saída conservadora são informações diferentes. Importação não promove avaliação bancária a preço de revenda.
- Cada importação começa com prévia. Linhas sem identidade estável ou com URL inválida são recusadas com motivo; repetições idênticas são contadas; conflitos pelo mesmo link são retirados do lote para revisão.
- A mesma identidade reaproveita o registro e preserva financeiro, favoritos e anexos. Um preço que desaparece na nova lista volta a pendente, sem reaproveitar um mínimo antigo.
- O registro da importação comprova recebimento, não publicação nem disponibilidade atual. Registros importados/manuais não satisfazem automaticamente a checagem de vigência do catálogo.
- Fonte, estado e pendências ficam visíveis na lista. Favoritos e comparação são preferências, não aprovação.
- Armazenamento continua local ao navegador. Não representa banco compartilhado, isolamento por organização ou trilha imutável.

## Reconciliação financeira

Holding V1.1, abas `04_Underwriting` e `05_MAO`: margem direta = (saída − custos diretos) / saída. OPEX corporativo rateado é exibido à parte. A Investment Machine inclui OPEX no all-in; não se deve comparar os dois resultados como se fossem a mesma métrica.

MAO = máximo entre zero e (saída × (1 − margem alvo) − custos não-lance) / (1 + comissão). O teto é truncado para centavos, nunca arredondado para cima. Custos, tributos e bases continuam dependentes das premissas validadas para cada ativo. Taxas das planilhas são modelagem, não confirmação tributária atual.

O sistema bloqueia lance zero, valores inválidos, comissão superior a 100%, capital/giro inconsistente e ausência de informações. Os limites financeiros existentes permanecem; não houve alteração da política aprovada nem liberação transacional.

## Escopo ainda pendente

OCR e extração por página, cenários completos, TIR, waterfall, conciliação real, restauração integral de anexos e dupla revisão autenticada não estão implementados neste painel. A auditoria desta versão não transforma o histórico G4 em GO. Uma futura implantação Supabase exige projeto próprio e testes de autenticação, RLS, Storage e restauração; os projetos Radar existentes não devem ser reutilizados.
