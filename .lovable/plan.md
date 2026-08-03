# Importar vários arquivos (Excel + PDF) com leitura por IA

Hoje o botão "Importar Excel" aceita um único `.xlsx`. A ideia é aceitar vários arquivos de uma vez, misturando planilhas e PDFs, e deixar a IA montar o cronograma consolidado.

## Como vai funcionar

1. O botão passa a se chamar "Importar cronograma" e aceita seleção múltipla (`.xlsx`, `.xls`, `.pdf`).
2. Cada arquivo é lido no navegador:
   - Excel: o parser atual continua sendo usado (matérias, datas, turnos, células).
   - PDF: o texto é extraído página a página; como o layout do PDF não tem estrutura de planilha, esse conteúdo vai direto para a IA transformar em atividades (data, turno, texto, tipo de aula).
3. Os resultados dos arquivos são unidos em uma lista só: matérias deduplicadas por nome (mantendo professor e turmas) e atividades deduplicadas por data + turno + texto, para evitar duplicar quando dois arquivos se sobrepõem.
4. A IA roda uma vez sobre o conjunto consolidado, como já faz hoje (corrige matéria, tipo de aula, ABEX e turmas).
5. A tela de revisão passa a mostrar a lista de arquivos processados, quantas atividades vieram de cada um e avisos por arquivo (ex.: "PDF sem datas reconhecidas"), com o resto do fluxo em duas etapas igual ao atual.

## Detalhes técnicos

- `src/components/schedule-import-dialog.tsx`: input com `multiple`, laço de leitura por arquivo, estado `files: {name, entries, warning}[]`, merge de `subjects`/`entries` antes de disparar a IA.
- Novo `src/lib/schedule-pdf.ts`: extração de texto no cliente com `pdfjs-dist` (dependência nova, worker via bundle do Vite).
- Novo `src/lib/schedule-pdf-ai.functions.ts` + `schedule-pdf-ai.server.ts`: server function protegida (mesmo middleware do fluxo atual) que envia o texto do PDF ao Lovable AI Gateway (`google/gemini-3-flash-preview`, JSON obrigatório) e devolve `{subjects, entries}` no mesmo formato de `ParsedSchedule`, reaproveitando as regras de ABEX/turmas já descritas no prompt existente.
- Nova função de merge em `src/lib/schedule-xlsx.ts` (ou util separado) usada tanto por Excel quanto por PDF.
- Sem mudanças no banco: a importação final (`schedule.functions.ts` / `schedule-import.server.ts`) continua recebendo exatamente o mesmo payload.

## Limites

- PDFs escaneados (imagem, sem camada de texto) não serão lidos; nesse caso o arquivo aparece na lista com aviso para enviar o Excel.
- Texto muito longo é enviado à IA em blocos para não estourar o limite do modelo.
