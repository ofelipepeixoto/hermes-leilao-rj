# Hermes Leilão RJ

Aplicação de triagem e análise de apartamentos no município do Rio de Janeiro. Ajuda a encontrar oportunidades, organizar evidências e calcular viabilidade antes da revisão humana. Versão local, em modo sombra: não autoriza investimentos nem executa lances.

## O que funciona

- Catálogo parcial de páginas públicas Zuk e Mega Leilões, atualizado sob demanda, com identidade do lote, preço, data e link de origem.
- Lista única com origem visível; filtros por texto sem acentos, fonte, cidade exata, tipo, situação e teto de preço; inclusão explícita de preços pendentes, favoritos, comparação de até três imóveis e paginação.
- Importação CSV/XLS/XLSX e texto colado, com prévia antes de gravar, cabeçalho após preâmbulo, moeda brasileira, rejeições por linha, conflitos e duplicatas. Reimportação preserva análise e anexos; preço ausente volta a pendente.
- Dossiê, checklist, arquivos em IndexedDB, hash SHA-256 e verificação da presença e integridade dos anexos.
- Backup completo com anexos, checksum do manifesto, prévia e restauração como cópias; registros anteriores preservados e aprovações invalidadas na recuperação.
- Conferência manual da CAIXA e de outras importações, comprovada por documento revisado, página/trecho, responsável, preço e certame futuro; validade de 24 horas.
- Checklist com vínculo explícito por documento, localização e revisor. Uma categoria de documento não aprova automaticamente vários requisitos.
- Cálculo determinístico de custos, MAO com comissão, margem direta, margem após OPEX e ROI. Valores desconhecidos permanecem pendentes.
- Atualização de catálogo sem apagar dossiês; ausência na consulta marca revalidação pendente. Catálogo precisa de evento futuro e consulta recente para pré-requisitos de comitê.
- Exportação de memo JSON com premissas e cálculo. A aprovação final permanece bloqueada: uma sessão local não autentica dois revisores independentes.

## Executar e testar

Node >=22.13, npm, Linux/WSL e utilitários GNU (`bash`, `timeout`, `flock`).

```sh
npm ci
npm run dev
npm run typecheck
npm run lint
npm test
npm audit --audit-level=high
```

`npm test` compila a aplicação e executa os testes de domínio e de componentes. `npm run test:unit` executa domínio, importação, seleção e conectores sem build. A implantação usa Worker via vinext/Vite; o arquivo público `.openai/hosting.json` não contém projeto nem credenciais. Não use este repositório como evidência de autorização para publicar dados de usuários.

Em ambientes com diretórios de usuário restritos, use `npm run install:ci` e
`bash scripts/sites-env.sh -- npm run dev -- --port 5173 --strictPort`.
O helper mantém caches e arquivos temporários em caminhos ignorados do projeto.
Em redes que exigem proxy, o Worker local do Vite pode não alcançar os portais.
Para verificar as integrações pelo servidor Node, com Node 24 e proxy já configurado:

```sh
npm run build
NODE_USE_ENV_PROXY=1 bash scripts/sites-env.sh -- npm start -- --port 5174
```

Isso habilita o suporte nativo de Node ao proxy existente. Não valida a rede do
Worker publicado em Sites/Cloudflare. Os processos precisam ser reiniciados em
cada tarefa. Nenhuma chave de API é necessária para os conectores públicos atuais.

## Limites atuais

A persistência está no navegador e na origem em que ele foi aberto; não há sincronização entre dispositivos. IDs de organização são rótulos locais, não isolamento multiempresa. O sistema não tem integração operacional com Supabase, identidade de revisores ou trilha imutável.

Os conectores implementados extraem HTML público: não são APIs oficiais contratadas. A coleta é parcial, limitada a uma página e até 20 verificações de detalhes por fonte. Mudanças de HTML, indisponibilidade ou bloqueios podem impedir atualização. CAIXA usa arquivo baixado pelo usuário; Santander/Itaú permanecem pendentes; TJRJ é referência, não catálogo de lotes.

O teto de R$245 mil para descoberta deriva apenas do limite de saída de R$350 mil e custo de 70%. Não estima valor de mercado, desconto real, liquidez ou lucro. Todas as demais despesas reduzem o lance viável.

## Documentação

- [Fontes, APIs e regras de dados](docs/FONTES_E_DADOS.md)
- [Auditoria e verificação](docs/AUDITORIA.md)
- [Auditoria complementar de 02/10/2026](docs/AUDITORIA_2026-10-02.md)
- [Concorrentes e alternativas](docs/COMPETIDORES.md)
- [Roadmap e critérios de aceite](docs/ROADMAP.md)

Documentos originais, dados de usuários, credenciais e histórico privado não integram este repositório. Os testes usam casos sintéticos. A licença do projeto ainda não foi escolhida; a disponibilidade pública não concede automaticamente uma licença de uso. Avisos de terceiros permanecem nos respectivos arquivos.

## Uso guiado

1. Em **Pipeline**, atualize o catálogo ou abra **Importar lista CSV ou Excel**. Também é possível colar células com cabeçalho. Confira a prévia antes de importar.
2. Escolha a cidade, tipo, teto de preço e situação. Marque favoritos e compare até três imóveis; dados ausentes continuam como pendentes.
3. Abra **Analisar imóvel**. Confira o resumo, reúna documentos no dossiê e preencha o financeiro em três etapas. O comitê permanece bloqueado para aprovação final nesta versão local.
4. No **Dossiê**, revise cada anexo, vincule-o ao requisito correspondente e informe página/trecho e nome do revisor. Para CAIXA/manual, use **Conferir oportunidade na fonte**, com comprovante, preço e data futura; depois revise o item da fonte no checklist.
5. Abra **Backup e recuperação dos dossiês**. Exporte o backup completo e guarde-o em local privado. Para recuperar em outro navegador na mesma aplicação, selecione o JSON, confira a prévia e escolha **Restaurar como cópias**. O arquivo contém documentos originais e não é criptografado: checksum comprova integridade, não autoria.

O backup aceita até 20 MB por anexo, 64 MB de anexos no total, 1.000 anexos, 10.000 oportunidades e 96 MB de arquivo JSON. Arquivos ausentes, divergentes ou backups acima desses limites são recusados com mensagem, sem uma exportação parcial silenciosa. A restauração exige uma base local legível e espaço disponível; uma base corrompida continua preservada, com gravação bloqueada. Isso não constitui sincronização ou backup automático no servidor.

## Correção de dependências — 03/10/2026

A cadeia de `braces` usa uma implementação local com limites de profundidade, licença e origem preservadas, descrita em [vendor/braces-bounded](vendor/braces-bounded/README.md). Não é uma versão upstream nem mera exclusão de advisory. `npm audit` não analisa código local; os testes de segurança do parser e dos walkers são obrigatórios no CI. O esbuild transitivo de `@esbuild-kit/core-utils` foi atualizado para 0.28.1 por override compatível com o build verificado.
