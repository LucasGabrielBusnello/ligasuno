
## ⚠️ Confirmar antes de implementar

Você escreveu que o semestre vai **"de janeiro até o último dia de julho"** e **"de 1° de julho até 31 de dezembro"** — há sobreposição em julho. Vou assumir o padrão acadêmico:
- **1º semestre:** 1º de janeiro a 30 de junho
- **2º semestre:** 1º de julho a 31 de dezembro

Se for outro recorte, me avise antes de eu começar.

---

## Etapa 1 — Conectar Gmail pessoal

Vou abrir o conector Gmail. Você clica em "Autorizar com Google", escolhe a conta que será o remetente oficial da liga (ex: seu Gmail pessoal ou um Gmail dedicado da presidência), e pronto. Os e-mails sairão de `nomedaconta@gmail.com`.

## Etapa 2 — Modelo de dados (Semestralidade)

Duas novas tabelas:

**`semester_cycles`** — ciclos semestrais
- `semester` (1 ou 2), `year`, `start_date`, `end_date`
- `amount_cents` (valor da semestralidade definido pelo presidente)
- `due_date` (data limite de pagamento)
- `late_fee_cents` (acréscimo único após o vencimento)
- `is_current` (boolean — apenas um ciclo ativo por vez)
- Histórico permanente: ciclos antigos nunca são deletados

**`semester_payments`** — pagamentos por ligante por ciclo
- `cycle_id`, `user_id`
- `status` (`pending` | `paid` | `overdue`)
- `paid_at`, `mp_payment_id`, `amount_paid_cents`
- Único por (cycle_id, user_id)

**Quem paga:** apenas ligantes ativos que ainda não têm registro `paid` no ciclo corrente (conforme você decidiu).

## Etapa 3 — Painel do Presidente / Aba Membros

Na lista de ligantes, cada nome ganha um **badge de status do ciclo atual**:
- 🟢 **Pago**
- 🟡 **Pendente** (dentro do prazo)
- 🔴 **Fora do prazo** (após `due_date`)

Botão novo **"Semestralidade"** abre um modal/drawer com:
1. **Ciclo atual** — valor, data de vencimento, taxa de atraso, % de pagamento
2. **Editar ciclo atual** — alterar valor, vencimento, taxa de atraso
3. **Encerrar ciclo / iniciar novo** — botão que arquiva o ciclo atual e cria o próximo
4. **Histórico de ciclos anteriores** — lista navegável; clicar abre detalhes (quem pagou, quem ficou inadimplente, valores totais)
5. **Exportar CSV** do ciclo (opcional, fácil de adicionar)

## Etapa 4 — Pagamento (apenas Pix)

Botão **"Pagar semestralidade"** na conta do ligante:
- Abre checkout Mercado Pago **somente Pix** (já usamos esse padrão nos minicursos/eventos)
- Valor = `amount_cents` + `late_fee_cents` se vencido
- Taxas da plataforma seguem a regra que você já definiu

Webhook do Mercado Pago atualiza `semester_payments.status = 'paid'` automaticamente.

## Etapa 5 — Job diário "fora do prazo"

Função agendada (cron, 1x/dia) que marca como `overdue` os pagamentos `pending` cuja data de vencimento já passou. Atualiza os badges automaticamente.

## Etapa 6 — E-mails via Gmail

Helper único `sendGmail({ to, subject, html })` usando o conector Gmail.

E-mails do Bloco 1:
- **Abertura de ciclo:** quando o presidente cria/edita o ciclo → notifica todos os ligantes ativos (valor, vencimento)
- **Lembrete de vencimento:** 3 dias antes do `due_date` para quem está `pending`
- **Confirmação de pagamento:** ao receber pagamento aprovado
- **Aviso de atraso:** quando passa a `overdue`

Todos enviados de `nomedaconta@gmail.com`.

## Etapa 7 — Permissões (RLS)

- Ligante: vê apenas o próprio `semester_payments` e pode pagar o seu
- Presidente: CRUD completo em `semester_cycles` e leitura de todos os `semester_payments`
- Admin master: acesso total

---

## Detalhes técnicos

- Tabelas com `GRANT` adequados e RLS
- Server functions (`createServerFn`) para todas as ações do presidente e do pagamento
- Helper `sendGmail` em `src/lib/gmail.server.ts` usando o gateway Lovable + `GOOGLE_MAIL_API_KEY`
- Cron diário via pg_cron chamando endpoint `/api/public/cron/mark-overdue` com secret
- Webhook MP existente estendido para identificar pagamentos do tipo `semestralidade` pelo `external_reference`
- Badges no painel: componente reutilizável `<SemesterStatusBadge status={...} />` usando os tokens semânticos do design system

---

## Fora deste bloco (próximos blocos)

- E-mails de boas-vindas, classificação do processo seletivo, evento, minicurso
- Sistema de desistência + CAMED (Bloco 3)
- Matrícula + CPF único + limite 8-12 ligantes (Bloco 4)

Quando você aprovar este plano:
1. Eu abro o conector Gmail
2. Você autoriza com a conta desejada
3. Eu sigo direto na implementação do Bloco 1

Posso prosseguir?
