## Visão geral

1. Frequência passa de booleano para tri-estado (`presente` / `ausente` / `justificada`) e cada sessão de frequência ganha um campo de **horas equivalentes** + uma descrição explicativa.
2. Inscrição em **eventos** e na **seleção de ligas** passa a exigir **Nome Completo** (com legenda "será usado para certificados") e **CPF**, validado.
3. Presidente ganha em **membros** um botão **"Certificados do Semestre"** que abre uma tela de revisão (lista de ligantes × atividades × horas), permite editar nome/CPF por ligante, escolher quem recebe via checkbox, e envia certificado PDF assinado por e-mail.
4. Presidente cadastra **assinatura** (upload de PNG transparente OU desenho em canvas). Assinatura fica salva no perfil de presidente e é estampada no certificado.

---

## 1. Frequência tri-estado + horas

**Banco** (`league_attendance`):
- Adiciona coluna `status text not null default 'ausente' check (status in ('presente','ausente','justificada'))`.
- Backfill: `status = 'presente' where present = true else 'ausente'`. Mantém `present` por compatibilidade, mas a UI passa a usar `status`.

**Nova tabela `league_attendance_sessions`** (uma linha por atividade+data, separada das presenças individuais — hoje horas estão repetidas em todas as linhas):
- `league_id`, `activity`, `activity_date`, `hours numeric(5,2) not null default 0`, `description text`.
- Chave única `(league_id, activity, activity_date)`.
- Backfill a partir das sessões já existentes em `league_attendance` com `hours = 0`.

**UI diretor → Frequência (`src/routes/diretor.$slug.tsx` → `FreqTab`)**:
- No formulário de criar/editar frequência:
  - Campo **Horas equivalentes** (number, passo 0.5) com legenda: "Quantas horas essa atividade vale no certificado do semestre. A soma das horas das atividades em que o ligante esteve **Presente** é o total que aparece no certificado dele."
  - Campo **Descrição** (textarea opcional).
  - Para cada membro, substitui o checkbox por 3 botões/radio: **Presente / Ausente / Justificada**.
- Lista de frequências registradas mostra contagem `presentes/justificados/ausentes` e horas.

Regra de horas (confirmado pelo usuário): apenas `presente` soma; `justificada` e `ausente` contam 0.

---

## 2. Nome completo + CPF obrigatórios nas inscrições

**Inscrição em eventos** (`event_registrations` + UI de inscrição em `$slug/index.tsx` ou rota de evento público):
- Garantir que o formulário tenha campo "Nome Completo (será usado para certificados)" obrigatório + CPF com máscara, validado por `isValidCPF` (já existe em `src/lib/cpf.ts`).
- Persistir `full_name` e `cpf` em `event_registrations` (verificar colunas; adicionar se faltar).

**Inscrição em seleção de liga** (`league_selection_registrations`):
- Mesma exigência. Validar CPF com `isValidCPF`. Já existe a coluna, garantir obrigatoriedade + legenda no formulário público (`src/components/selection-public.tsx`).

Pré-preencher com `profiles.full_name` / `profiles.cpf` quando o usuário estiver logado, mas o usuário pode editar antes de confirmar.

---

## 3. Assinatura do presidente

**Banco** — nova tabela `league_president_signatures`:
- `league_id` (FK, unique), `user_id` (presidente que cadastrou), `signature_url` (storage), `updated_at`.
- GRANTs padrão; RLS: presidente da liga (`leagues.president_id = auth.uid()`) lê/escreve, `service_role` total.

**Storage** — bucket privado `league-signatures` (criado via `storage_create_bucket`). Políticas: presidente da liga lê/escreve seu próprio arquivo. Server function de envio de e-mail usa `supabaseAdmin` para baixar a imagem.

**UI presidente** (`src/routes/presidente.$slug.tsx`, nova aba ou seção dentro de "Membros"):
- Dois caminhos:
  - **Upload PNG**: input `accept="image/png"`, valida fundo transparente recomendado.
  - **Desenhar**: componente canvas (biblioteca leve, ex.: `react-signature-canvas`) com botões Limpar/Salvar. Resultado vira PNG transparente.
- Preview da assinatura atual + botão "Substituir".

---

## 4. Certificados do Semestre

**UI presidente → aba Membros, novo botão "Certificados do Semestre"** abre um diálogo/rota dedicada:

Tabela com colunas:
- Checkbox (selecionar para envio)
- Nome (editável, default = `profiles.full_name`)
- CPF (editável, default = `profiles.cpf`, validado)
- E-mail (`profiles.email`, read-only)
- Total de horas (calculado: soma de `hours` das sessões em que o ligante teve `status='presente'`)
- "Ver atividades" → expande detalhamento (atividade, data, horas, status)

Acima da tabela: botão **"Enviar Certificados via e-mail"** que envia para todos os selecionados.

**Geração do PDF** — usar `pdf-lib` no server (compatível com Worker, sem nativos). Template único:
- Cabeçalho com nome da liga, logo (se houver).
- Texto: "Certificamos que **{nome completo}**, inscrito(a) no CPF {cpf}, participou da {Liga} no semestre {cycle}, completando **{horas totais}h** em atividades. Atividades: ...".
- Lista das atividades com horas.
- Cor primária do template = `leagues.theme_color` (preenchimento de barras/títulos). Layout idêntico para todas as ligas.
- Estampa a assinatura PNG + nome do presidente + "Presidente da {Liga}".

**Server function** `sendSemesterCertificates` (`src/lib/certificates.functions.ts`):
- Input: `league_id`, lista `[{ user_id, full_name, cpf }]`.
- Para cada item: monta dados (atividades + horas via `supabaseAdmin`), gera PDF com `pdf-lib`, codifica em base64, envia via Gmail connector (gateway `google_mail`) como anexo MIME a partir de `ligasuno@gmail.com` (conta já conectada).
- Grava log em nova tabela `certificate_email_log` (league_id, user_id, sent_at, status, error).
- Retorna resumo `{ enviados, falhas: [...] }` → toast no front.

**Observação sobre o remetente**: o conector Gmail envia em nome da conta conectada. Vou validar que `ligasuno@gmail.com` é a conta atualmente conectada via `get_connection_configuration`; se for outra, peço para você reconectar com `ligasuno@gmail.com` antes de testar o envio.

---

## Resumo dos arquivos

**Migrações novas**
- Tri-estado em `league_attendance` + tabela `league_attendance_sessions`.
- Tabela `league_president_signatures` + bucket `league-signatures` + RLS.
- Tabela `certificate_email_log`.
- (Se faltar) colunas `full_name`/`cpf` em `event_registrations`.

**Código**
- `src/routes/diretor.$slug.tsx` — `FreqTab` (status tri-estado, horas, descrição, lista atualizada).
- `src/routes/presidente.$slug.tsx` — botão "Certificados do Semestre" + diálogo + UI de assinatura.
- `src/components/selection-public.tsx` e formulário de inscrição em eventos — exigir Nome Completo + CPF com legenda.
- `src/lib/certificates.functions.ts` — server fns: `previewCertificateData`, `sendSemesterCertificates`, `uploadSignature`.
- Novo `src/components/signature-pad.tsx` — canvas + upload.
- Dependências: `pdf-lib`, `react-signature-canvas`.

Confirma para eu implementar?
