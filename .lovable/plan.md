# Prova online do Processo Seletivo

## Resumo
Criar um sistema de prova dentro da plataforma onde:
- O **presidente** monta o questionário (similar aos quizzes dos diretores) com tempo, opção de e-mail, código de reentrada e controle de presença.
- O **inscrito que pagou a taxa E está marcado como presente** acessa a prova pelo "Painel do Inscrito" quando liberada.
- Anti-cola: detecção de troca de aba/janela pausa a prova e exige código fornecido pelo presidente.
- Embaralhamento por inscrito; nota e ordem de entrega alimentam o ranking existente (`grade` + `delivery_position`).

---

## 1. Banco de dados (migração)

**Nova tabela `league_selection_exams`** (1 prova por liga):
- `league_id` (único), `time_limit_minutes`, `shuffle` (default true), `send_answers_email` (bool), `published` (bool), `reentry_code` (text, 4 dígitos), `created_at`, `updated_at`.

**Nova tabela `league_selection_exam_questions`**:
- `exam_id`, `question` (text), `options` (jsonb array), `correct_answer` (int index), `display_order`.

**Nova tabela `league_selection_exam_attempts`** (1 tentativa por inscrito):
- `exam_id`, `registration_id` (único), `user_id`, `question_order` (jsonb), `option_orders` (jsonb), `started_at`, `paused_at`, `time_used_ms`, `submitted_at`, `score`, `total`, `answers` (jsonb), `delivery_position`.

Campo `present` já existe em `league_selection_registrations` — será usado como pré-requisito.

**RLS + GRANTs**:
- `exams`/`questions`: gerenciados por presidente/admin; leitura só via serverFn (sem expor `correct_answer`).
- `attempts`: somente o próprio user (insert/update da sua linha) + presidente (select).
- `reentry_code` lido apenas por serverFn restrito ao presidente.

---

## 2. Server functions (`src/lib/exam.functions.ts`)

- `upsertExam` / `addExamQuestion` / `updateExamQuestion` / `deleteExamQuestion` / `listExamQuestions` — presidente.
- `regenerateReentryCode` / `getReentryCode` — presidente.
- **`startExamAttempt({ league_id })`** — valida:
  1. inscrito tem `registration.status === 'paid'`
  2. **`registration.present === true`** (caso contrário, retorna erro "Você precisa ser marcado como presente pelo presidente para iniciar a prova")
  3. exame existe e está publicado
  
  Cria attempt com ordem embaralhada, retorna questões sanitizadas (sem `correct_answer`) e `time_remaining_ms`.
- `resumeExamAttempt({ league_id, reentry_code })` — valida código + presença + retorna estado.
- `pauseExamAttempt` — chamado quando o front detecta saída de aba.
- `saveExamAnswer` — salva resposta parcial.
- `submitExamAttempt` — calcula `score`, define `delivery_position` sequencial, grava `grade` e `delivery_position` em `league_selection_registrations`, envia e-mail se configurado.
- Auto-submit server-side se tempo expirar.

**Anti-bypass**: cliente nunca recebe `correct_answer`. Tempo é autoritativo do servidor.

---

## 3. UI — Presidente

Em `SelectionManagerDialog` (aba "Processo Seletivo"), nova sub-aba **"Prova"** com `<ExamBuilder>`:
- Campo **Tempo de prova** (minutos)
- Switch **Embaralhar questões e alternativas** (default ligado)
- Switch **Enviar respostas no e-mail ao final**
- Lista de questões (UI espelhada de `QuizTab` do diretor, sem justificativa)
- Checkbox **"Criar e Publicar"**
- Switch separado **"Publicada"** (liga/desliga sem recriar)
- Seção **Código de reentrada**: botão **"Mostrar código"** + botão **"Gerar novo código"**

Na sub-aba existente de presença/classificação, o presidente continua marcando `present` — esse é o gating de quem pode iniciar a prova.

---

## 4. UI — Inscrito (Painel do Inscrito)

Em `selection-public.tsx` (`SelectionAccessDialog`), quando `registration.status === 'paid'`:
- Botão **"Acessar Prova"** com três estados:
  - **Desabilitado (cinza) + texto "Aguardando publicação"** — se exame não publicado.
  - **Desabilitado (cinza) + texto "Aguardando confirmação de presença"** — se publicado mas `registration.present === false`.
  - **Habilitado** — se publicado E presente.
- Ao clicar, abre `<ExamRunner>` em modal full-screen.

**ExamRunner** (`src/components/exam-runner.tsx`):
- Chama `startExamAttempt` (ou `resumeExamAttempt` se já existir attempt pausado).
- **Timer regressivo** sincronizado com servidor (heartbeat a cada 30s).
- Renderiza questões na ordem retornada; cada resposta dispara `saveExamAnswer`.
- **Anti-cola**:
  - `visibilitychange` + `window.blur` + `pagehide` → `pauseExamAttempt` + overlay **"Prova pausada — peça o código ao presidente"** com input 4 dígitos → `resumeExamAttempt`.
  - `contextmenu` desabilitado, `user-select: none` no enunciado.
- Botão **"Finalizar"** → `submitExamAttempt` → tela de confirmação.
- Auto-submit se tempo expirar.

---

## 5. Integração com classificação

`submitExamAttempt` grava em `league_selection_registrations`:
- `grade` = acertos
- `delivery_position` = posição sequencial entre submissões da liga

`generateRanking` em `selection.functions.ts` já usa esses campos como critério (nota desc, depois delivery_position asc) — sem mudanças.

---

## Detalhes técnicos

- **Pré-requisito de presença**: validado em `startExamAttempt` e `resumeExamAttempt`. Se o presidente desmarcar `present` no meio da prova, o `resume` falha — mas o `submit` continua permitido para não perder respostas já enviadas (decisão a confirmar na implementação).
- **Embaralhamento determinístico**: ordem gerada uma vez em `startExamAttempt` e persistida em `question_order` + `option_orders`.
- **Timer autoritativo**: `time_remaining = limite - time_used_ms - (now - started_at se não pausado)`.
- **Pausa**: `pause` acumula tempo em `time_used_ms`; `resume` valida código e zera `paused_at`.
- **Código 4 dígitos**: `crypto.randomInt(1000, 10000)`. Regenerar invalida sessões pausadas.
- **E-mail de respostas**: usa `gmail.server.ts` existente; lista pergunta → alternativa marcada → se acertou.
- **`delivery_position`**: `coalesce(max,0)+1` dentro do `submit` com lock simples.
- **Segurança do gabarito**: questões lidas via `supabaseAdmin` em serverFn; RLS nega SELECT direto ao inscrito.
- **Detecção de aba**: `visibilitychange` (`document.hidden`) + `blur` + `pagehide` cobrem troca, minimizar e Alt+Tab.

---

## Arquivos novos
- `src/lib/exam.functions.ts`
- `src/components/exam-builder.tsx`
- `src/components/exam-runner.tsx`
- Migração SQL (3 tabelas + RLS + GRANTs)

## Arquivos modificados
- `src/components/selection-manager.tsx` — sub-aba "Prova" + botão "Mostrar código"
- `src/components/selection-public.tsx` — botão "Acessar Prova" com estados (publicação + presença)
- `src/lib/gmail.server.ts` — template `sendExamAnswersEmail`
