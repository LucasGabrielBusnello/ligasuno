
# Plano de implementação

Vou implementar as 9 demandas em blocos coesos. Tudo usa o template de e-mail da liga (`emailLayout`) já existente — com a cor de cada liga — e o conector Gmail já conectado.

---

## 1. Botão "+ Ligante" na classificação não funciona
- **Bug**: ao gerar ranking, classificados são adicionados automaticamente como `ligante`, mas o toggle manual depende de buscar o `user_id`. Vou revisar `toggleLigante` e o componente `selection-manager.tsx` para garantir que:
  - O botão exibe estado correto (já é Ligante ou não)
  - Insere/remove a membership corretamente
  - Mostra toast de feedback

## 2. E-mail de boas-vindas ao registrar no site
- Disparar e-mail decorado quando um novo perfil é criado.
- Como o `handle_new_user` é um trigger SQL, vou criar um servidor function `sendWelcomeEmail` chamado do client (auth.tsx) logo após signup bem-sucedido.
- Template: agradecimento + funcionalidades (entrar em ligas, prova de seleção, eventos, minicursos, pagamento de semestralidade). Cor: verde Ligasuno padrão (`#1f5132`).

## 3. E-mail no momento da inscrição em evento/minicurso
- No webhook `mp-webhook.ts` (após pagamento aprovado) E também para eventos gratuitos: disparar e-mail com todos os dados (título, data, horário, local, descrição, preço pago) no template da liga.

## 4. Lembretes automáticos de evento (7 dias, 1 dia, dia do evento + minicursos)
- Criar rota `/api/public/cron/event-reminders` que:
  - Busca eventos com `event_date` em `today + 7`, `today + 1`, `today`
  - Para cada um, envia e-mail a todos os `event_registrations` com status `paid`
  - No dia, também envia e-mails dos minicursos do evento aos inscritos
- Idempotência: tabela nova `event_email_log (event_id, kind, sent_at)` para não duplicar.
- Cron diário às 8h via pg_cron.

## 5. E-mail ao ser definido como Ligante (botão na aba classificados)
- Em `toggleLigante` (quando passa para `isLigante: true`), buscar perfil + liga e enviar e-mail "Você foi classificado!" no template da liga, com botão para acessar painel do ligante.

## 6. Desistência de liga (painel do ligante)
- **DB**: nova tabela `league_leave_requests (id, league_id, user_id, status: pending/approved/rejected, created_at, processed_at)`.
- **Painel do ligante**: substituir card de semestralidade por aviso quando houver `pending`. Botão "Desistir da Liga" abre confirmação → cria request → envia e-mail para o presidente no template da liga com nome, CPF e matrícula.
- **Painel do presidente**: nova seção para aprovar/rejeitar pedidos. Aprovar = remove `league_memberships` + marca request como `approved`.

## 7. CAMED — alerta de membros em 3+ ligas
- Na rota `camed.tsx`: query agregada `user_id, count(*) from league_memberships where role='ligante' group by user_id having count>3`.
- Mostrar banner amarelo "Existem membros em mais de 3 ligas" + botão "Verificar" que abre modal com a lista (nome, CPF, matrícula, ligas).

## 8. Matrícula
- **DB**: adicionar `registration_number text` em `profiles` e em `league_selection_registrations`.
- **Cadastro de usuário** (auth.tsx): campo opcional "Matrícula (deixe em branco caso não tenha)".
- **Inscrição em liga** (`selection-public.tsx`): campo obrigatório.
- **Painel admin master**: mostrar matrícula nos cards/lista de usuários.
- **Painel da liga (presidente)**: aba membros mostra matrícula.

## 9. Limite de vagas (8–12) no processo seletivo
- No formulário de definir `selection_total_seats`: validação client + server. Toast: "A quantidade de membros não é permitida pelo regulamento do CAMED".

## 10. CPF único globalmente
- **DB**: 
  - `profiles`: adicionar coluna `cpf` (nullable). Unique index (case-insensitive, normalizado).
  - Adicionar `UNIQUE` em `league_selection_registrations.cpf`, `event_registrations.cpf`.
- **Validação**: helper `assertCpfUnique(cpf, currentUserId?)` chamado nos pontos de inscrição. Mostrar: "Este CPF já está cadastrado".
- Migrar dados: pegar CPF da primeira registration de cada user e popular `profiles.cpf` quando único.

---

## Ordem de execução

1. **Migração DB** (matrícula, CPF em profiles, tabela leave_requests, tabela event_email_log, cron) — single migration
2. **E-mails** (welcome, evento, minicurso, classificação, lembretes, desistência) em `gmail.server.ts` como templates reutilizáveis
3. **Backend** (server functions: leave-request, welcome, reminders cron, validações)
4. **Frontend** (auth.tsx matrícula, selection-public.tsx matrícula+cpf-único, semester-card desistência, presidente painel, camed alerta, selection-manager limite 8-12 + botão ligante)

---

## Notas técnicas

- Todos os e-mails passam pelo `sendGmail`/`sendGmailBulk` existente, já com encoding base64 corrigido.
- Templates reutilizam `emailLayout({ brandColor: league.theme_color, leagueName: league.name })`.
- O cron diário (`mark-overdue` 03h e `event-reminders` 08h) usa `pg_cron + pg_net + apikey` conforme padrão já usado.
- Toda nova tabela terá `GRANT` + RLS conforme regras do projeto.
- Vou validar CPF normalizado (apenas dígitos) para a unique constraint funcionar de forma consistente.

Posso prosseguir?
