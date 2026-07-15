
# Reformulação MEDUNO — Plano em 5 fases

Escopo enorme. Vou entregar fase por fase; você aprova cada entrega antes da próxima. Tema verde atual preservado; painel do Aluno ganha tema medicina Unochapecó (variante do verde).

**Aguardando anexo**: documento com o exemplo de divisão manhã/tarde/noite seg-sáb. Ele é necessário para calibrar a Fase 4 (grid do cronograma). Fases 1–3 seguem sem o anexo. Se demorar, começo a Fase 4 com o padrão (08–12 / 13:30–17:30 / 19–22, seg-sáb) e ajusto depois.

---

## Fase 1 — Identidade + navegação + subURLs + cadastro atualizado

- Renomear "Ligasuno" → "MEDUNO" em toda a UI (títulos, `<head>`, meta OG, textos, e-mails). URLs/domínio ficam como estão.
- Nova barra de topo global (em `__root.tsx`), suave, com:
  - Esquerda: logo MEDUNO + links **Aluno**, **AAAMD**, **Ligas**, **CAMED**.
  - Direita: ícone de usuário → **/perfil** (menu com sair).
  - Remover dali os atalhos Admin/Coordenação/Presidente. Admin master continua acessando `/admin` direto pela URL.
- Novas rotas (cada uma com `head()` próprio, tema/paleta próprios sobre o verde base):
  - `/` — home decorada (herda atual, sem os painéis privados no topo).
  - `/aluno` — painel do aluno (só estudantes Unochapecó; não-alunos veem CTA para atualizar cadastro).
  - `/aaamd` — hoje `/atletica`; mantenho `/atletica` como redirect.
  - `/ligas` — hub de ligas (hoje na home).
  - `/camed` — já existe; painéis de gestão (diretor/presidente CAMED) passam a viver **dentro** dessa página, não no header global.
  - `/perfil` — hoje `/painel`; mantenho `/painel` como redirect.
- Cadastro (signup) e edição de perfil:
  - Remover campo "semestre (1–20)".
  - Se marcar "aluno(a) da Unochapecó" → passar a exigir **Matrícula (9 dígitos)** + **Turma ATM** (dropdown: ATM31, ATM30, ATM29, ATM28, ATM27, ATM26).
  - Migração de dados: cria coluna `class_code` em `profiles`, mantém `current_semester` só como legado (deprecado, sem uso na UI).
- Modal "Atualizar cadastro" no primeiro login pós-mudança:
  - Aparece 1x para qualquer usuário logado com campos obrigatórios em falta (matrícula/turma se for aluno Unochapecó) OU sem `profile_reviewed_at`.
  - Ao confirmar, grava `profile_reviewed_at = now()`. Só reaparece se algo obrigatório voltar a faltar.

## Fase 2 — Componentes curriculares (CRUD coordenação)

Base de dados para o cronograma. Sem UI de aluno ainda.

- Tabela `subjects_v2` (não mexo na `subjects` antiga para não quebrar `/painel`):
  - `name`, `class_codes text[]` (turmas ATM que têm o componente), `professor`, `professor_contact` (opcional), `subdivisions text[]` (default `['A']`).
- Nova aba **Componentes** dentro de `/admin` (visível a admin master **e** coordenadores):
  - CRUD completo. Botão para adicionar letras de subdivisão (A, B, C…).
  - Deixar `subdivisions` vazio = automaticamente `['A']`.
- Nova tabela `coordination_staff` (já criada em rodada anterior) ganha UI de gestão em `/admin` se ainda não tiver.
- RLS: leitura autenticada; escrita só admin master + coordenadores.

## Fase 3 — Semestre letivo + itens pessoais + Aluno v1 (leitura)

- Tabela `academic_terms`: `start_date`, `end_date`, `is_current`. Editável pela coordenação em `/admin` → aba **Semestre**.
- Tabela `personal_schedule_items`: itens que o próprio aluno cria (`title`, `date`, `start_time`, `end_time`, `color`). RLS `auth.uid() = user_id`.
- `/aluno` reformulado, rolável, tema medicina (verde variante):
  - Topo: faixa horizontal com **atividades do dia** (aulas + práticas + provas + eventos do usuário + itens pessoais + zonas verdes + atividades de liga do usuário).
  - Abaixo: **lista de matérias do semestre** com carga horária, professor(es), e-mail, e badge de turma editável por matéria (default "A"). Botão para trocar a letra por componente. Isso filtra o cronograma.
  - Ainda **sem** o grid completo — só a lista do dia. O grid vem na Fase 4.

## Fase 4 — Grid do cronograma + editor visual da coordenação

Esta é a fase mais pesada. Uso o documento anexo para calibrar visual.

- Tabela `schedule_entries`:
  - `term_id`, `subject_id`, `class_code` (ATM), `subdivision` (A/B/…), `date`, `shift` (`morning`/`afternoon`/`night`), `start_time`, `end_time`, `kind` (`class`/`practice`/`exam`/`green_zone`), `original_date` (para remarcações), `notes`.
- Grid semanal (seg-sáb, 3 turnos) para o aluno em `/aluno`:
  - Só mostra dias dentro do `academic_term` corrente.
  - Cores: aula normal (tema), **prática = roxo**, **prova = vermelho**, **zona verde = verde**, **remarcada origem/destino = 2 cores distintas com legenda "Remarcada de/para DD/MM"**, itens pessoais na cor escolhida pelo aluno, eventos (liga/atlética) em cor própria.
  - Regra automática: se a turma do aluno **não** tem aula naquele turno mas outra turma tem, o turno vira "janela verde" para ele (sem permitir remarcação em cima).
  - Slots vazios exibem "Turno sem aulas ou remarcações".
  - Botão "+" no aluno → cria item pessoal (título, data, início, fim, cor).
- Aba **Coordenação** (canto superior direito, só para quem estiver em `coordination_staff`):
  - Seletor de turma ATM → renderiza o mesmo grid.
  - Clique num turno → painel lateral direito com:
    - Lista dos itens já daquele turno + `⋮` (Editar / Remarcar / Excluir).
    - Botão **+** → escolhe matéria (filtradas pelas que têm essa turma) → se a matéria tem várias turmas, pergunta qual + subdivisão → campo horário início/fim (vazio = padrão do turno).
    - Botão **Zona verde** → marca turno inteiro sem perguntar turma.
  - Botão superior **Marcar em lote**: escolhe matéria, subdivisão, turno, tipo (Aula/Prática/Prova), e um calendário multi-seleção de dias do semestre → cria em massa.
  - Remarcar: cria nova `schedule_entries` no destino com `original_date` = data original, e marca a origem como "remarcada".

## Fase 5 — Google Calendar (OAuth por usuário) + polish

- Configurar App User Connector `google_calendar` (Lovable) + tabela `app_user_connections` cifrada (padrão da knowledge).
- Botão em `/aluno` **Vincular Google Agenda**:
  - Antes de sincronizar, mostra preview: lista "Microbiologia (Turma B), Anatomia (Turma A)…" conforme escolhas do aluno + confirmação das turmas.
  - Ao confirmar, cria eventos na agenda dele (aulas + práticas + provas + itens pessoais + eventos inscritos), respeitando remarcações.
  - Botão "Desvincular" chama `disconnectAppUser` e apaga a linha.
- Ajustes finais: SEO (`head()` por rota nova), cleanup do header antigo, redirects `/atletica`→`/aaamd` e `/painel`→`/perfil`.

---

## Detalhes técnicos (referência)

- Stack: TanStack Start atual, sem mudanças. Novas rotas em `src/routes/{aluno,aaamd,ligas,perfil}.tsx` + subrotas onde couber.
- DB: novas tabelas `subjects_v2`, `academic_terms`, `personal_schedule_items`, `schedule_entries`, `app_user_connections`. Coluna `class_code` + `profile_reviewed_at` em `profiles`. Todas com RLS + GRANTs padrão.
- Server functions em `src/lib/schedule.functions.ts`, `src/lib/coordination.functions.ts`, `src/lib/google-calendar.functions.ts`. Google Calendar via `callAsAppUser` server-side (nunca do browser).
- Segurança: leitura de `schedule_entries` para autenticados; escrita só coordenação. `personal_schedule_items` escopo `auth.uid()`.
- Coordenação = quem está em `coordination_staff` (checagem via função `is_coordinator(uid)` SECURITY DEFINER).
- Painéis contextuais: CAMED (diretor/presidente) só dentro de `/camed`, Liga (presidente/diretor) já dentro de `/presidente/$slug` e `/diretor/$slug` — só removo os atalhos do header global.

**Ordem de execução**: 1 → 2 → 3 → (anexo) → 4 → 5. Cada fase é uma iteração aprovável. Quando o anexo chegar, incorporo à Fase 4 antes de começar.
