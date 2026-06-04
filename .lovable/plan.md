# Plano

## 1. Construtor de questões mais bonito + edição (`src/components/exam-builder.tsx`)

**Card de cada questão (lista existente):**
- Layout em card com fundo sutil, numeração destacada (badge "Q1"), enunciado em destaque.
- Alternativas com indicador visual da correta (ícone Check verde em vez de só cor).
- Barra de ações com botões **Editar** (lápis) e **Excluir** (lixeira).

**Modo edição inline:**
- Clicar em "Editar" transforma o card em formulário pré-preenchido (mesmo layout do "Adicionar nova questão").
- Botões **Salvar alteração** e **Cancelar**.
- Usa nova server function `updateExamQuestion` em `src/lib/exam.functions.ts` (atualiza `question`, `options`, `correct_answer` via `supabaseAdmin`, validando que o presidente é dono da liga). Já existe um stub `update/addExamQuestion` mencionado no histórico — verificar e adicionar se faltar.

**Card "Adicionar nova questão":**
- Manter, mas com visual mais polido (header com ícone Plus, alternativas com letras A/B/C/D em badges arredondados, radio estilizado).

## 2. Remover pagamento por cartão na inscrição da prova (`src/components/selection-public.tsx`)

- No `SelectionRegisterDialog`, remover totalmente o seletor de método (cartão/PIX) e o state `method`.
- Exibir apenas um aviso visual de que o pagamento é via **Pix**.
- No submit, enviar `payment_method: "pix"` (ou remover do payload — backend já força `pixOnly: true` em `selection.functions.ts:81`).
- Mantém intacto o fluxo de cartão da assinatura mensal dos presidentes (outro componente, não afetado).

## Arquivos afetados
- `src/components/exam-builder.tsx` — redesign + edição
- `src/lib/exam.functions.ts` — adicionar `updateExamQuestion` se não existir
- `src/components/selection-public.tsx` — remover UI de cartão
