# Correção local de braces — identificada, não uma versão upstream

Derivado de `braces@3.0.3` (https://github.com/micromatch/braces/tree/3.0.3), sob MIT. O copyright e a licença originais estão em LICENSE. Nome local: `@hermes/braces-bounded@1.0.0`; não publicado no npm e não apresentado como versão corrigida pelos mantenedores.

Motivo: GHSA-vfj7-8cjw-p6xm / CVE-2026-93687. Em 3/10/2026 o advisory oficial e o registro npm não ofereciam versão corrigida. Os walkers recursivos compile/expand/stringify podem esgotar a pilha com padrões profundamente aninhados.

Alterações locais:

- O parser rejeita mais de 32 níveis de chaves/parênteses, incluindo padrões incompletos.
- Os três walkers rejeitam profundidade de AST acima de 64, inclusive AST fornecida diretamente.
- Erro controlado SyntaxError; as opções não permitem desativar os limites.
- `fill-range` fixado em 7.1.1.

O override npm abrange consumidores transitivos. A auditoria npm não avalia este código local como release do pacote upstream; por isso os testes `dependency-security.test.mjs` são parte obrigatória do CI e verificam tanto resolução quanto comportamento. Não é mera exclusão de advisory ou alteração cosmética de versão. As demais verificações npm continuam habilitadas.

Reavaliar e remover o override quando existir uma correção upstream compatível, após executar estes testes e build/lint. Esta correção trata o esgotamento de pilha descrito no advisory, não certifica a biblioteca contra todas as formas de consumo excessivo de recursos.
