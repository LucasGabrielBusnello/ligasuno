
# Plano de implementação — entrega única

## 1. Migrações de banco (uma única migration)

### Eventos / Minicursos — vagas
- `league_events.max_seats integer` (nullable; null = ilimitado).
- `league_minicourses` já tem `max_registrations`; passa a ser respeitado também como teto rígido.
- Helpers (views/funções): contar `event_registrations.status='paid'` e `minicourse_registrations.status='paid'` por id.

### Prova de seleção da liga
- `leagues`:
  - `selection_open boolean default false`
  - `selection_deadline date null` (data final de inscrição)
  - `selection_exam_date date null`
  - `selection_exam_time time null`
  - `selection_exam_description text null`
  - `selection_total_seats integer default 0`
- `league_selection_quotas` (cotas por semestre):
  - `league_id uuid`, `semester int (1,3,5,7,9,11)`, `seats int`
  - UNIQUE(league_id, semester)
- `league_selection_registrations`:
  - `id`, `league_id`, `user_id`, `full_name`, `cpf`, `email`, `phone`, `semester int`
  - `paid_price numeric`, `status text` (pending/paid)
  - `stripe_session_id text`
  - `grade numeric null`, `delivery_position int null`, `present boolean default false`
  - `ranked_position int null`, `ranked_via text null` ('quota'|'general'|'waitlist'|'eliminated')
  - UNIQUE(league_id, user_id); UNIQUE(league_id, delivery_position) `WHERE delivery_position IS NOT NULL`
- `league_selection_ranking_history` (para "Desfazer"):
  - `id`, `league_id`, `snapshot jsonb`, `created_at`

### CAMED
- `camed_info` recebe novas colunas opcionais ou nova tabela:
  - `camed_presidents` (`id`, `email text unique`, `created_at`)
  - `camed_settings` (linha única id=1): `league_registration_fee numeric default 0`, `semestrality_fee numeric default 0`
- Grants + RLS:
  - `camed_presidents`: leitura pública para a página inicial detectar; gestão por admin_master ou pelo próprio user via função `is_camed_president(auth.uid())` (security definer comparando email do profile com a lista).
  - `camed_settings`: select público, update por admin_master ou camed_president.
  - `camed_members` / `camed_info`: passa a permitir update/insert/delete também para `is_camed_president()`.

### RLS adicional
- `league_selection_registrations`: insert própria, select próprio + presidente da liga + admin.
- `league_selection_quotas`: select público; manage presidente da liga + admin.
- Política `leagues_update` continua para presidente — basta atualizar o app para gravar os novos campos.

## 2. Server functions

### `src/lib/selection.functions.ts`
- `createSelectionCheckout({ leagueId, full_name, cpf, email, phone, semester })`:
  - valida CPF, valida semestre ∈ {1,3,5,7,9,11}, busca `camed_settings.league_registration_fee`.
  - cria registro `pending`, abre Stripe Checkout (Pix+Cartão) — reaproveita padrão de `events.functions.ts`.
  - metadata: `selection_registration_id`.
- `generateRanking(leagueId)`:
  - Carrega `selection_total_seats`, cotas, e inscritos `present=true` com `grade` e `delivery_position` preenchidos.
  - Verifica: se algum presente está sem nota OU sem posição → retorna erro listando faltantes.
  - **Algoritmo "Cotas primeiro, depois geral":**
    1. Para cada cota (semestre S, N vagas): ordena candidatos do semestre S por (grade desc, delivery_position asc), pega top N, marca `ranked_via='quota'`. Sobras de cota voltam para o pool.
    2. Vagas restantes = `total_seats - somaCotasPreenchidas`.
    3. Demais candidatos (não-classificados) ordenados por (grade desc, delivery_position asc) preenchem geral, marca `ranked_via='general'`.
    4. Resto vai para `ranked_via='waitlist'`, ordenado por (grade desc, delivery_position asc).
  - Salva snapshot em `league_selection_ranking_history` antes de atualizar.
- `removeFromRanking(registrationId)`:
  - Salva snapshot, remove o classificado, e chama próximo seguindo critério (se era vaga de cota S, chama próximo da waitlist do semestre S; se não houver, próximo geral).
  - Remove membership 'ligante' caso exista.
- `undoLastRankingAction(leagueId)`: restaura snapshot mais recente.
- `setAsLigante(registrationId)`: insere `league_memberships` com role='ligante' para `user_id` da inscrição.

### `src/lib/admin-reset.functions.ts`
- `resetLeagueData({ leagueIds, scopes: { presidents, memberships, selection, events_regs, minicourses_regs, schedule, news, waitlist } })`
- Admin master only.

### Webhook
- `src/routes/api/public/payments/webhook.ts`: identificar `selection_registration_id` no metadata, marcar `paid`.

## 3. UI — frontend

### `src/routes/$slug/index.tsx` (página pública da liga)
- Se `leagues.selection_open && deadline >= hoje && usuário não inscrito/pago`: banner chamativo "Inscrições abertas — encerram em DD/MM/AAAA" + botão "Inscreva-se para realizar a prova" → modal 2 etapas (formulário → pagamento Pix/Cartão).
- Se usuário já pagou: botão "Acessar Inscrição" mostrando data/hora/descrição da prova, vagas totais, cotas por semestre, posição na lista (se já houver ranking).
- Se `selection_open=false`: nenhum botão.

### `src/routes/$slug/index.tsx` aba eventos (e Hub `/`)
- Para cada evento/minicurso com `max_seats`, calcular % ocupação e mostrar badge:
  - 100% → "Não há mais vagas" + botão desabilitado.
  - ≤10/5/4/3/2/1 vaga → "Restam menos de N vagas" (prioridade sobre %).
  - Senão: 50/60/70/80/90% → "Metade das vagas já foram preenchidas" / "X% das vagas já foram preenchidas".

### `src/routes/presidente.$slug.tsx`
- Na aba **Membros**, novo botão "Processo Seletivo" → abre Dialog grande com sub-abas:
  - **Configuração**: toggle aberto/fechado, deadline, data/hora/descrição da prova, total de vagas, lista de cotas por semestre ímpar (1–11).
  - **Prova e Classificações**: tabela de inscritos pagos com:
    - checkbox presença | nome (com botão "i" expandindo CPF/email/telefone) | semestre | input nota | input posição
    - botões topo direito: "Desfazer", "Gerar Classificação", "Lista de Espera"
    - Resultado: lista separando vagas de cota (com legenda "Vagas destinadas ao semestre X") e gerais; cada linha com botão "Definir como Ligante" e botão "X" (remover + chamar próximo).

### `src/routes/admin.tsx`
- Aba Ligas: card adicional "Resetar dados das ligas" → dialog seletivo por liga + checkboxes de categorias + confirmação dupla.
- Aba CAMED: nova sub-seção "Presidentes do CAMED" (lista + add por email + excluir).

### Novo `src/routes/camed.tsx` (painel CAMED)
- Acessível se `is_camed_president()` true.
- Header com link aparecendo em `/` (Hub) quando user é camed president.
- Abas:
  - **Informações**: edita `camed_info.description` etc.
  - **Membros**: mesmo CRUD que admin tem hoje em `camed_members`.
  - **Ligas**: inputs `league_registration_fee` e `semestrality_fee` (gravados em `camed_settings`).

### `src/routes/index.tsx` (Hub)
- Detectar `is_camed_president` (consultar `camed_presidents` por email do user) e mostrar botão "Painel CAMED" na top bar.
- Avisos de vagas em eventos.

## 4. Detalhes técnicos relevantes
- Validação CPF reusa `src/lib/cpf.ts`.
- Semestres ímpares: select com [1,3,5,7,9,11].
- Stripe: reusar `createStripeClient` via `events.functions.ts` como modelo (mesmo padrão pix + cartão + `expires_after_seconds`).
- `ranked_via='quota'` armazena também o semestre para exibir a legenda.
- "Undo": guardar snapshot por liga, manter apenas últimos 20.
- Avisos de vagas: priorizar mensagem absoluta (≤10) sobre % via early-return.

## 5. Ordem de execução
1. Migration única + GRANTs + RLS + função `is_camed_president()`.
2. Webhook + `selection.functions.ts` + `admin-reset.functions.ts`.
3. UI: presidente (config + prova/classificações) → página pública liga (banner+modal+acessar inscrição) → hub/eventos (vagas) → admin (reset + presidentes CAMED) → /camed.
4. Smoke test (`build` automático), checar logs do webhook.

Implementação grande e arriscada; aviso o usuário se algo precisar ser ajustado depois do build.
