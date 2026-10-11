# Demonstração guiada — meta de 90 segundos

Objetivo: mostrar como uma lista incompleta vira um dossiê com pendências e próximo passo claro. Não demonstra retorno financeiro, decisão de investimento, integração comercial ou uso em produção. O tempo é um roteiro proposto, não um resultado medido com clientes.

Use a versão local desta branch, em perfil separado de navegador, sem dossiês reais. A fixture [demo-pendencias.csv](demo-pendencias.csv) é inteiramente fictícia; `example.org` identifica um endereço de exemplo. Não abra esse link nem atualize o catálogo durante a demonstração. Não importe a fixture em uma base de trabalho real. Não há um modo de demonstração que isole dados dentro da mesma origem; o perfil separado é necessário.

1. **0–15 s — tarefa:** “Recebi uma lista e preciso saber o que falta antes de analisar um imóvel.” Na tela vazia, escolha **Importar lista CSV ou Excel** e selecione a fixture.
2. **15–35 s — primeiro resultado útil:** mostre a prévia, **Preço pendente** e a exigência de conferir vigência/disponibilidade. Diga: “Não tratamos preço desconhecido como zero. Nenhum imóvel foi gravado ainda.”
3. **35–50 s — controle:** marque a revisão desta versão, importe a linha e escolha **Analisar primeiro imóvel importado**. Mostre a origem fictícia e as pendências do dossiê.
4. **50–75 s — próxima ação:** abra **Financeiro** e use **Ir à primeira pendência**. Mostre a distinção entre preço anunciado, lance simulado e saída conservadora. Não preencha custos desconhecidos com zero para obter um resultado.
5. **75–90 s — limite e hipótese de valor:** “O resultado é uma lista rastreável do que conferir; o comitê permanece bloqueado.” Abra **Comitê** e mostre o bloqueio. A próxima tarefa real é obter uma fonte e evidências de preço, disponibilidade e custos para revisão humana.

Para mostrar recuperação em uma segunda rodada, preencha uma premissa justificada por um exemplo fictício e recarregue: a área e os valores são retomados, na primeira etapa ainda pendente. Uma edição invalida a revisão anterior; revertê-la não recupera a aprovação.

## O que validar antes de propor um piloto

Hipótese: um analista consegue importar sua lista, identificar a lacuna prioritária e explicar o próximo passo sem orientação contínua. Protocolo sugerido: cinco sessões com dados sintéticos, três tarefas (importar, localizar pendência, corrigir e retomar). Registrar sucesso por tarefa, erro crítico, tempo até identificar a pendência e esforço percebido. Meta inicial proposta: todos distinguirem simulação de aprovação, nenhum importar uma versão antiga e pelo menos quatro concluírem o fluxo. Esses resultados ainda não foram medidos.

O MVP local permite demonstrar triagem e preparação de dossiê. Uso comercial com colaboração ou decisão operacional ainda depende de identidade/autorização dos revisores, armazenamento compartilhado com isolamento, trilha auditável, política de dados/backup, validação jurídica/financeira e homologação das fontes. A demonstração não substitui esses requisitos. Nenhum contato, publicação, cobrança, contratação ou implantação é parte deste roteiro.
