# Correções autorizadas — 03/10/2026

## Problema e resultado

O CI de segurança estava vermelho, os dossiês não tinham backup completo e importações CAIXA não podiam ter a fonte revalidada para preparação do comitê. A revisão documental vinculava evidências apenas por categoria, permitindo que um Parecer fosse considerado para requisitos distintos sem indicar onde cada assunto era comprovado.

Esta versão corrige esses caminhos, mantendo modo sombra e aprovação final bloqueada. A política financeira Holding V1.1 não foi alterada. O relatório de auditoria anterior permanece como registro histórico; não deve ser interpretado como status desta release.

## Mudanças

- `braces`: código local identificado, derivado de 3.0.3 sob MIT, com limite de 32 níveis no parser e 64 nos walkers. O advisory GHSA-vfj7-8cjw-p6xm não tinha release upstream corrigida na consulta. Origem, licença, alteração e estratégia de retirada do override estão documentadas no vendor. A auditoria npm permanece habilitada; testes específicos cobrem o código local não analisado pelo registro npm.
- esbuild transitivo antigo: override de `@esbuild-kit/core-utils` para 0.28.1; lockfile atualizado e instalação reproduzível verificada.
- Backup: inclui snapshot, histórico de importação, diagnósticos e os bytes de cada anexo, com SHA-256 por arquivo e checksum do payload. Verificação integral antes de qualquer gravação.
- Recuperação: adiciona cópias com IDs/chaves novos, sem substituir dossiês ou arquivos existentes. Aprovações/memos são invalidados e confirmações de fonte removidas. Grava anexos em transação e, em falha de metadados, descarta somente os novos arquivos. Um encerramento entre staging e gravação pode deixar arquivos órfãos, mas não apaga a base anterior.
- Exclusão manual: persiste a remoção dos metadados antes de limpar anexos, evitando que falha de cota mantenha um dossiê com seus arquivos já apagados.
- CAIXA/manual: confirmação humana com fonte HTTPS, comprovante revisado e íntegro, localização, responsável identificado, preço positivo e evento futuro. Expira em 24 horas e deixa de ser válida quando URL, fonte, preço, evento ou comprovante divergem.
- Checklist: documento, página/trecho e revisor próprios por requisito. Vínculo alterado volta para revisão. Documentos inválidos ou vencidos bloqueiam a validade da aprovação mesmo que o status salvo anteriormente seja aprovado.

## Verificação

Comandos exigidos: `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, `npm audit --audit-level=high`.

Executados nesta entrega: instalação limpa pelo lockfile, typecheck, lint e build concluídos; 54 testes passaram e `npm audit` retornou zero vulnerabilidades reportadas. Esse resultado não equivale a uma certificação de segurança do código local.

Testes novos: resolução do vendor pela cadeia real micromatch; ataque de profundidade no parser e AST externa; compatibilidade com padrões normais; round-trip de backup; valores pendentes; anexos ausentes/corrompidos; manifesto incompleto; checksum; versão desconhecida; cópias e IDs; falha de gravação/cota; expiração e alteração de confirmação manual; revisão por requisito; transações IndexedDB via fake-indexeddb, incluindo abort e preservação dos bytes anteriores.

Os testes usam casos fictícios. fake-indexeddb verifica a API transacional sem executar um navegador real. Não é evidência de sessão autenticada de produção nem da qualidade jurídica/financeira de um lote real. A skill control-browser exigida pelo caminho de QA visual do preview não estava disponível nesta sessão; não foi realizado novo teste de interação autenticada no navegador.

## Operação e reversão

- Manter os nomes `hermes-leilao-rj-v4`, `hermes-leilao-files` e object store `files`: a atualização lê a base existente.
- Fazer backup completo antes de introduzir dossiês reais ou trocar dispositivo. Backup é manual, local e não criptografado. Limites documentados no README; exportação falha explicitamente se faltar arquivo ou exceder limites.
- Não há integração Supabase, banco compartilhado, dupla aprovação autenticada ou mudança nos outros produtos Radar nesta release.
- Reverter código/publicação para a versão anterior preserva os armazenamentos do navegador. Campos adicionais não são necessários para ler os registros; entretanto, versões anteriores não oferecem estes mecanismos de backup/revalidação e não devem ser usadas para aprovar documentos segundo as regras novas.
- Usar esta versão somente em modo sombra. Não interpretar a correção de software como fechamento dos gates históricos de piloto ou como liberação para investimentos.
