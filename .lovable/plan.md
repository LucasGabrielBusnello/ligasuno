
## 1. Modo Manutenção por área (Atlética e CAMED)

- **DB (migração):**
  - `athletics`: adicionar `maintenance_enabled boolean default false`.
  - `camed_settings`: adicionar `maintenance_enabled boolean default false`.
- **Backend:** server functions `setAthleticMaintenance` (só diretor/presidente) e `setCamedMaintenance` (só admin master + presidente CAMED + acesso ao painel).
- **Frontend:**
  - `atletica.tsx` → aba Diretoria › Config: switch "Modo Manutenção". Se ativado e usuário não for diretor/presidente/admin_master, renderiza tela de manutenção no lugar do conteúdo (mantém sidebar visível ou usa gate global da rota).
  - `camed-painel.tsx` › aba Info: switch equivalente.
  - `camed.tsx` (rota pública): quando `maintenance_enabled`, bloqueia acesso exceto para usuários com `camedPanelTabs.length > 0` ou `isAdminMaster/isCamedPresident`.

## 2. Vendas manuais → Histórico de Compras + autocomplete de e-mail

- **Backend:** ajustar `manualSell*` (produto/ingresso/associação) para:
  - Vincular a `user_id` do perfil cujo `email = <email digitado>` (case-insensitive) quando existir; senão criar registro "convidado" ligado só por email.
  - Garantir que o histórico do usuário (`athletic_product_orders`, `event_registrations`, `athletic_memberships`) receba a linha com `user_id` correto para aparecer em "Histórico de Compras".
- **Nova server function:** `searchBuyerByEmail({ q })` → retorna até 4 perfis (`email ILIKE q%`) com `full_name, cpf, phone, current_semester, matricula, class_code, id`.
- **Frontend (dialog Venda Manual):** input de e-mail com dropdown (Command/Popover) exibindo até 4 sugestões; ao clicar, preenche nome/CPF/telefone/etc. Debounce 250ms, só busca com ≥2 chars.

## 3. Reordenação da aba CAMED pública

Em `camed.tsx`, reordenar seções para: **Notícias → Atividades Abertas → Conheça a nossa história → Membros do CAMED**. Apenas reorganização visual.

## 4. Caixa da Atlética — pagamentos pendentes de associação

- **UI:** na lista de pendentes de associação dentro de "Caixa":
  - Mostrar só o mais recente + botão "Mostrar mais (N)" que expande o restante.
  - Ícone lixeira em cada item → confirma e exclui `athletic_membership_payments` (status pending) via nova server function `deletePendingMembershipPayment` (checa `assertDirector`).

## 5. Comprovante de compra em Histórico (com PDF)

- **UI Histórico de Compras (atlética):** em compras aprovadas (`status = paid`), botão "Ver comprovante" abre dialog com dados do pedido (itens, valores, forma de pagamento, NSU, data, comprador). Dentro do dialog, botão "Baixar PDF".
- **PDF:** reutilizar padrão `athletic-tickets-pdf.ts` (jsPDF) para gerar recibo simples com logo/nome da atlética.
- Aplicar a produtos, ingressos e associação.

## 6. Nova aba "Pagamentos Pendentes" em Diretoria › Caixa

- **UI:** nova sub-aba lista todos pedidos com `status = 'pending'` de:
  - `athletic_product_orders`
  - `athletic_event_tickets` (via `event_registrations` pendentes)
  - `athletic_membership_payments`
- Cada card: descrição, comprador (nome/email/CPF/telefone), forma de pagamento (pix/infinitepay/manual), valor, data.
- Botões **Aprovar** (marca como `paid`, `paid_at = now()`, dispara mesmo pós-processamento do webhook: e-mail recibo + ativar associação/ingresso quando aplicável) e **Reprovar** (marca `cancelled`).
- **Backend:** `approvePendingPayment({ kind, id })` e `rejectPendingPayment({ kind, id })`, ambas com `assertDirector`.
- **Histórico de Compras do usuário:** quando `status = pending`, exibir badge/texto "Pagamento aguardando aprovação da diretoria" no lugar dos botões atuais.

## 7. Import em massa de sócios via Excel

- **UI:** botão "Adicionar em Massa" ao lado de "Adicionar Manualmente" na aba Sócios. Abre dialog com:
  - Upload `.xlsx`
  - Preview das primeiras linhas + validação de colunas
  - Botão "Importar"
- **Backend:** server function `bulkImportMembers({ athletic_id, rows[] })`:
  - Para cada linha (mapa por header conforme planilha enviada — nome, e-mail, CPF, telefone, curso/semestre, etc.):
    1. Faz `upsert` em `athletic_memberships` com `email`, `full_name`, `role='ligante'`, `active=true`, `member_until` = fim do ciclo atual (ou nulo conforme padrão da atlética).
    2. Se existir `profiles.email` correspondente, vincula `user_id`.
    3. Se **não existir** perfil, marca `pending_invite=true` (nova coluna boolean) e envia e-mail de convite.
- **DB:** adicionar `athletic_memberships.pending_invite boolean default false` + colunas de dados adicionais que faltarem (curso/semestre já existem via profiles quando vinculado).
- **E-mail:** usar `gmail.server.ts` (remetente `no-reply@ligasuno.com.br`) com novo template `sendMemberInviteEmail(email, athleticName, signupUrl)`:
  - Assunto: "Você é sócio da {atlética} — crie sua conta no MEDUNO"
  - Corpo HTML com brand verde/laranja, botão "Criar conta" apontando para `https://ligasuno.com.br/auth?email=<email>` (rota `/auth` já preenche e-mail via query).
- **Formato aceito:** documentar no dialog os headers esperados (conforme planilha que você enviou — vou ler o arquivo antes de implementar para casar 1:1 com os nomes reais das colunas).

## Observação

Você mencionou que enviaria um Excel com o formato da planilha de sócios, mas não vejo o arquivo anexado nesta mensagem. **Reenvie o `.xlsx`** — vou usá-lo para mapear exatamente os headers/colunas no importador antes de codar.

## Detalhes técnicos

- Migrações separadas por assunto (manutenção, membership pending_invite).
- Todas server functions novas usam `requireSupabaseAuth` + `assertDirector`/checks equivalentes.
- Autocomplete usa `ilike 'q%'` com `limit 4` e RLS/policy que já permite diretor ler `profiles` — se não permitir, criar RPC `SECURITY DEFINER` `search_buyer_profiles(_q, _athletic_id)` restrito a diretores.
- PDF do comprovante usa jsPDF já instalado; nada de dependência nova.
- Import Excel: parser `xlsx` (SheetJS) client-side; envia JSON já normalizado ao backend (não faz upload do arquivo).
