# Roadmap orientado a evidências

Revisado em **26 de setembro de 2026**. Este documento apresenta prioridades e critérios propostos; não certifica que os recursos estejam implementados ou aprovados. O estado de execução deve ser acompanhado nas issues e nos resultados de teste do repositório.

## Objetivo

Permitir que uma equipe transforme oportunidades públicas de apartamentos no RJ e municípios aprovados em dossiês revisáveis. A ferramenta organiza e analisa; lances, propostas, contratos, pagamentos e demais transações permanecem fora do sistema.

## Prioridades

| Prioridade | Entrega | Critério proposto de aceite |
| --- | --- | --- |
| **P0 — catálogo rastreável** | Adaptadores específicos por fonte, atualização sob demanda, URL direta, ID, tipo, município, modalidade, valor anunciado, datas e situação. Exibir consultas completas, parciais, bloqueadas ou com falha. | Conferência manual de 100 listagens públicas: pelo menos 95% de exatidão nos campos essenciais; 100% com fonte e data; nenhum dado demonstrativo na base real. Cobertura calculada apenas quando houver denominador conhecido. |
| **P0 — dados preservados** | Atualização não destrutiva, deduplicação, importação com prévia e rejeições por linha, exportação e restauração. Falha temporária marca a consulta como não revalidada, preservando dossiês. | Nenhuma perda de anexos ou decisões nos testes de atualização, timeout, importação repetida e restauração. Todas as linhas importadas têm resultado explicável. |
| **P0 — financeiro reproduzível** | Distinguir lance mínimo, avaliação do leiloeiro e saída conservadora. Versionar fórmulas e premissas; incluir custos de aquisição, manutenção, reforma e venda. Dados críticos ausentes geram pendência. | Todos os casos de referência aprovados conciliados com a versão correspondente do modelo financeiro. Testes distinguem margem sobre venda de ROI sobre investimento e impedem que ausência vire zero. |
| **P1 — dossiê e revisão humana** | Evidências com origem, hash, validade, página/trecho; diferenças entre versões; checklist derivado dos dados; memo e revisões identificadas. | 3–5 dossiês completos revisados por duas pessoas. Todo campo crítico possui evidência ou pendência; pendências críticas bloqueiam avanço. Identidade e trilha local são descritas sem promessas de autenticação ou imutabilidade. |
| **P2 — operação e escala comprovadas** | Comparar custo/prazo previsto com realizado; medir esforço por dossiê. Ampliar fontes e automatizações apenas depois de avaliação. Preparar versão compartilhada em escopo separado. | Qualidade por fonte e custo por dossiê aceito medidos. Antes de dados compartilhados: testes entre organizações/contas, permissões, backups e recuperação. |

## Plano de validação

- **Conectores:** usar respostas de teste para listagem, paginação, lote encerrado, cancelamento, página genérica, 403, timeout e conteúdo incompleto. Complementar com pequena amostra pública conferida manualmente, com data. Não contornar login, CAPTCHA ou outros controles de acesso.
- **Qualidade:** separar a taxa de acerto dos campos da cobertura de coleta. Uma consulta parcial não significa ausência de oportunidades. Classificar o motivo de exclusão e permitir inspeção do link de origem.
- **Modelo financeiro:** manter casos sintéticos reproduzíveis com resultado esperado, versão das fórmulas e tolerância de arredondamento. Evidenciar premissas desconhecidas e cenários; uma faixa de saída não é o preço de lance.
- **Fluxo:** verificar cadastro, edição, exclusão permitida, importação, consulta, dossiê, bloqueio de comitê e restauração no navegador. Não usar documentos pessoais ou dados privados em testes públicos.
- **Utilidade:** medir o tempo mediano até memo aceito e correções críticas por dossiê. Meta inicial proposta: reduzir esse tempo em pelo menos 30% sem elevar erros críticos, comparando com o processo atual documentado.

## Regras de interpretação

- Fonte, comitente, leiloeiro, evento, lote e imóvel são entidades distintas. O mesmo lote pode aparecer em mais de um portal.
- Hash demonstra integridade comparável do arquivo; não comprova autenticidade jurídica ou atualidade.
- Armazenamento no navegador e nomes digitados não equivalem a auditoria imutável ou dupla aprovação autenticada.
- Papéis e filas não equivalem a agentes autônomos. Um agente só deve ser apresentado como funcional quando houver tarefa, ferramentas, limites, saída e avaliação executados.
- A validação operacional depende de documentos primários e revisão humana. Contagens e testes de software, isoladamente, não concluem esse gate.

## Contribuições públicas

Manter no repositório código, documentação, contratos de adaptadores e casos sintéticos. Documentos originais, dados privados de portfólio, credenciais e arquivos de usuários ficam fora dele. Recursos planejados devem ser separados dos implementados no README e nas issues.

Ver também [Concorrentes e alternativas](COMPETIDORES.md).
