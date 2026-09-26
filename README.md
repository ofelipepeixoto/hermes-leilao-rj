# Hermes Leilão RJ

Aplicação de triagem e análise de apartamentos no município do Rio de Janeiro. Ajuda a encontrar oportunidades, organizar evidências e calcular viabilidade antes da revisão humana. Versão local, em modo sombra: não autoriza investimentos nem executa lances.

## O que funciona

- Catálogo parcial de páginas públicas Zuk e Mega Leilões, atualizado sob demanda, com identidade do lote, preço, data e link de origem.
- Filtros por texto sem acentos, fonte, cidade, tipo e teto de preço; ordenação por data, preço ou nome; paginação.
- Importação CSV/XLS/XLSX com cabeçalho após preâmbulo, leitura de moeda brasileira e deduplicação por origem. Reimportação preserva análise e anexos.
- Dossiê, checklist, arquivos em IndexedDB, hash SHA-256 e verificação da presença e integridade dos anexos.
- Cálculo determinístico de custos, MAO com comissão, margem direta, margem após OPEX e ROI. Valores desconhecidos permanecem pendentes.
- Atualização de catálogo sem apagar dossiês; ausência na consulta marca revalidação pendente. Catálogo precisa de evento futuro e consulta recente para pré-requisitos de comitê.
- Exportação de memo JSON com premissas e cálculo. A aprovação final permanece bloqueada: uma sessão local não autentica dois revisores independentes.

## Executar e testar

Node >=22.13, npm, Linux/WSL e utilitários GNU (`bash`, `timeout`, `flock`).

```sh
npm ci
npm run dev
npm run typecheck
npm test
```

`npm test` compila a aplicação e executa os testes de domínio e de componentes. `npm run test:unit` executa apenas o domínio. A implantação usa Worker via vinext/Vite; o arquivo público `.openai/hosting.json` não contém projeto nem credenciais. Não use este repositório como evidência de autorização para publicar dados de usuários.

## Limites atuais

A persistência está no navegador e na origem em que ele foi aberto; não há sincronização entre dispositivos. IDs de organização são rótulos locais, não isolamento multiempresa. O sistema não tem integração operacional com Supabase, identidade de revisores ou trilha imutável.

Os conectores implementados extraem HTML público: não são APIs oficiais contratadas. A coleta é parcial, limitada a uma página e até 20 verificações de detalhes por fonte. Mudanças de HTML, indisponibilidade ou bloqueios podem impedir atualização. CAIXA usa arquivo baixado pelo usuário; Santander/Itaú permanecem pendentes; TJRJ é referência, não catálogo de lotes.

O teto de R$245 mil para descoberta deriva apenas do limite de saída de R$350 mil e custo de 70%. Não estima valor de mercado, desconto real, liquidez ou lucro. Todas as demais despesas reduzem o lance viável.

## Documentação

- [Auditoria e verificação](docs/AUDITORIA.md)
- [Concorrentes e alternativas](docs/COMPETIDORES.md)
- [Roadmap e critérios de aceite](docs/ROADMAP.md)

Documentos originais, dados de usuários, credenciais e histórico privado não integram este repositório. Os testes usam casos sintéticos. A licença do projeto ainda não foi escolhida; a disponibilidade pública não concede automaticamente uma licença de uso. Avisos de terceiros permanecem nos respectivos arquivos.
