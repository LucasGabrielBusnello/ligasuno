
# Fase 4 — Grid semanal + editor da coordenação

Recebi os dois anexos e usei-os como referência visual. A Fase 1 já está entregue; este plano cobre a Fase 4 (a Fase 2 e a Fase 3 continuam na ordem original antes desta). Confirme se quer que eu execute **direto a Fase 4** agora ou mantenha a ordem 2 → 3 → 4.

## Visual do grid (baseado nos anexos)

Layout de tabela semanal, uma linha por turno, uma coluna por dia:

```text
┌──────────┬──────────┬──────────┬──────────┬──────────┬──────────┬──────────┐
│ Turno /  │ Segunda  │ Terça    │ Quarta   │ Quinta   │ Sexta    │ Sábado   │
│ Horário  │ 09/02/26 │ 10/02/26 │ 11/02/26 │ 12/02/26 │ 13/02/26 │ 14/02/26 │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ Manhã    │ Genética │ (verde)  │ Farmaco  │ Patologia│ Imuno    │ FERIADO  │
│ 08–12    │ Cássia   │          │ Lilian   │ Mauro    │ Carine   │          │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ Tarde    │ (verde)  │ Hab.Prof │ (verde)  │ Psic.Méd │ Micro    │ FERIADO  │
│ 13:30–17 │          │ Odila    │          │ Lucinda  │ Adriana  │          │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ Noite    │ (verde)  │ (verde)  │ (verde)  │ (verde)  │ (verde)  │ FERIADO  │
│ 19–22    │          │          │          │          │          │          │
└──────────┴──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘
```

Cores das células (fixas no design system, tema verde MEDUNO):
- **Aula normal**: fundo branco/tema, texto escuro
- **Prática**: amarelo
- **Avaliação/prova**: vermelho
- **Zona verde (livre)**: verde-limão
- **Feriado**: ciano
- **Remarcada — origem**: hachurado cinza + label "Remarcada para DD/MM"
- **Remarcada — destino**: azul-claro + label "Remarcada de DD/MM"

Legenda fixa acima do grid. Turno mostra até 2 itens empilhados; se houver mais, badge "+N".

## Modelo de dados

Novas tabelas (com GRANT + RLS):

- `academic_terms` — `id`, `name`, `start_date`, `end_date`, `is_current bool`. Edição: coordenação.
- `holidays` — `id`, `term_id`, `date`, `label`. Renderiza célula ciano em todos os turnos do dia.
- `schedule_entries`:
  - `id`, `term_id`, `subject_id`, `class_code atm_class`, `subdivision text` (default 'A')
  - `date`, `shift` enum('morning','afternoon','night'), `start_time`, `end_time`
  - `kind` enum('class','practice','exam','green_zone','abex')
  - `rescheduled_from_entry_id` (nullable, aponta para entrada de origem)
  - `rescheduled_to_date` (nullable, na entrada de origem)
  - `notes`
- `personal_schedule_items` (se ainda não veio da Fase 3) — itens pessoais do aluno.

RLS:
- `schedule_entries`, `academic_terms`, `holidays`: SELECT para authenticated; INSERT/UPDATE/DELETE só `coordination_staff` ou admin master (função `has_role`).
- `personal_schedule_items`: `auth.uid() = user_id`.

## Regra "janela verde automática"

Ao renderizar o grid **do aluno**: para cada turno sem `schedule_entries` da turma dele, se existir entrada de outra turma no mesmo turno → renderiza célula verde-limão com label "Janela verde". No grid **da coordenação**, mostra as entradas reais sem essa substituição.

## Aba Coordenação

Botão "Coordenação" no canto superior direito do `/aluno` (só visível para `coordination_staff` / admin master). Abre `/coordenacao/cronograma`:

1. **Seletor de turma ATM** (ATM31…ATM26) + seletor de semana.
2. **Grid** idêntico ao do aluno, mas editável.
3. **Clique em turno** → painel lateral direito com lista de entradas + botões:
   - `+ Adicionar` → escolhe matéria (filtradas por `class_codes` que contêm a turma selecionada). Se a matéria tem várias turmas, pergunta subdivisão. Horário default do turno pré-preenchido.
   - `Zona verde` → cria entrada `kind='green_zone'` no turno inteiro sem perguntar mais nada.
   - `⋮` por entrada → **Editar** / **Remarcar** / **Excluir**.
4. **Remarcar**: modal com date/turno destino → cria nova entrada em destino com `rescheduled_from_entry_id = origem.id`, e marca origem com `rescheduled_to_date`. Ambas renderizam com cores/labels específicas.
5. **Marcar em lote**: botão acima do grid → modal (matéria, subdivisão, turno, tipo) + calendário com multi-seleção de dias → cria em massa via server fn.
6. **Feriados**: aba separada dentro de Coordenação para CRUD de `holidays` do term atual.

## Server functions (todas com `requireSupabaseAuth` + checagem `coordination_staff`)

- `listScheduleWeek({ classCode, weekStart })` → entries + holidays + expansão de janela verde (opcional, ou faz no cliente).
- `createScheduleEntry`, `updateScheduleEntry`, `deleteScheduleEntry`
- `rescheduleEntry({ entryId, newDate, newShift, newStartTime, newEndTime })`
- `bulkCreateScheduleEntries({ subjectId, subdivision, shift, kind, dates[] })`
- `setGreenZone({ classCode, date, shift })`
- `listHolidays`, `createHoliday`, `deleteHoliday`
- `listAcademicTerms`, `upsertAcademicTerm`, `setCurrentTerm`

## Aluno v2 (dentro desta fase)

Substitui a "faixa do dia" da Fase 3 por:
- Toggle **Dia** / **Semana** no topo.
- **Semana**: grid completo com regra de janela verde automática, sobreposto com `personal_schedule_items` (cor customizada por item).
- **Dia**: coluna vertical mostrando o dia atual + itens pessoais + próxima aula.
- Sem edição de entradas oficiais; só CRUD dos itens pessoais.

## Arquivos previstos

- **Migration**: `academic_terms`, `holidays`, `schedule_entries`, enums, GRANT, RLS + `has_role` já existente.
- **Server fns**: `src/lib/schedule.functions.ts`, `src/lib/schedule.server.ts`.
- **Rotas**:
  - `src/routes/coordenacao.cronograma.tsx` (grid coordenação)
  - `src/routes/coordenacao.feriados.tsx`
  - `src/routes/coordenacao.termos.tsx`
  - Atualiza `src/routes/aluno.tsx` (grid semanal + toggle)
- **Componentes**: `ScheduleGrid`, `ScheduleCell`, `ShiftSidePanel`, `BulkCreateDialog`, `RescheduleDialog`, `HolidayManager`.
- **Header**: adiciona link "Coordenação" condicional em `__root.tsx` para `coordination_staff`.

## Confirmações antes de executar

1. Seguir **ordem original** (Fase 2 → 3 → 4) ou pular direto para Fase 4 agora?
2. Confirma horários padrão dos turnos: **manhã 08:00–12:00, tarde 13:30–17:30, noite 19:00–22:00**?
3. Tipo `abex` (Prática ABEX aparece no anexo 2) — trato como subtipo de `practice` com label diferente, ou como `kind` próprio?
