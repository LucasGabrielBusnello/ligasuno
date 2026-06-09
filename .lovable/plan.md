# Credenciamento, Certificados de Evento e Backup

## 1. Resiliência / backup (dia do evento)

- **Snapshot diário automático** (pg_cron + server route `/api/public/cron/event-snapshot`): para cada evento dos próximos 7 dias e dos últimos 30, gera JSON com inscritos, credenciamentos, dados de pagamento e salva em `event_snapshots` (nova tabela, jsonb).
- **Botão "Exportar inscritos" (CSV + JSON)** na aba Presidente > Eventos > evento — download imediato.
- **Sync Google Sheets**: conector Google Sheets (builder vai conectar a conta `ligasuno@gmail.com`). Cada liga define (1 vez) o ID de uma planilha; a cada inscrição/credenciamento, server fn faz append/upsert na aba do evento. Botão "Sincronizar agora" força full-resync. Se o sync falhar, log mas não bloqueia inscrição.
- **Modo "Congelar evento"** opcional (toggle no evento, ativa automático no dia): bloqueia editar/excluir evento e inscrições; só credenciamento permanece. Reduz risco de apagar dados por engano no dia.

## 2. Schema novo

```text
league_events  (novas colunas)
  ├── full_name_required boolean default true  (sempre exige nome completo na inscrição)
  ├── total_hours numeric                       (horas totais do certificado)
  ├── checkin_count int default 1               (quantos credenciamentos)
  ├── checkin_schedule jsonb                    ([{idx,label,starts_at,interval_min}])
  └── freeze_on_event_day boolean default true

event_registrations  (novas colunas)
  ├── full_name text                            (preenchido na inscrição p/ certificado)
  ├── cpf text
  └── checkin_code text  (6 dígitos, único por evento)

league_minicourses  (novas colunas)
  ├── total_hours numeric
  └── (mantém 1 credenciamento)

minicourse_registrations  (novas colunas)
  ├── full_name text, cpf text, checkin_code text

event_checkins  (NOVA)
  registration_id, checkin_index int (1..n), checked_in_at, method ('manual'|'qr'),
  by_user_id, UNIQUE(registration_id, checkin_index)

minicourse_checkins  (NOVA) — mesma forma, sem index

event_snapshots  (NOVA)
  event_id, taken_at, payload jsonb

league_sheets_sync  (NOVA)
  league_id, spreadsheet_id, last_synced_at, last_error
```

Trigger gera `checkin_code` (6 dígitos aleatórios, único por evento) no INSERT de `event_registrations` / `minicourse_registrations`. Política RLS: presidente da liga lê tudo do seu evento; ligante lê o próprio.

## 3. Criar/editar evento (presidente)

Formulário ganha:
- **Nome completo obrigatório** (sempre on, já default true).
- **Horas totais no certificado** (input + texto: "Essa será a quantidade de horas em certificado").
- **Quantidade de credenciamentos** (1–10). Para cada um: label, data/hora, intervalo (min). Aviso: "Cada credenciamento valerá `total_hours / N` horas".
- **Congelar no dia do evento** (default on).

Para minicursos: input "Horas no certificado" + nota fixa "Minicursos têm 1 credenciamento".

## 4. Inscrição (público + painel inscrito)

- Form de inscrição em evento e minicurso passa a exigir **Nome completo** (já existe para liga) com mensagem "será usado para o certificado" + **CPF**.
- Página pública e painel do inscrito mostram a programação dos credenciamentos (label/data/intervalo).
- Painel do inscrito mostra **QR code do crachá** (lib `qrcode` no client, payload = `checkin_code`) + botão "Baixar PNG".

## 5. Credenciamento (Presidente > Eventos > [Evento])

Botão **"Credenciamento"** abre dialog com **abas**: 1°, 2°, 3°... conforme `checkin_count` (minicurso = só 1 aba).

Cada aba contém:
- Lista de inscritos pagos: nome, código, status (presente/ausente) com checkbox manual.
- Botão **"Ler QR Code"** abre câmera via `html5-qrcode`. Ao ler, busca a inscrição pelo `checkin_code` *daquele evento* e marca presença **apenas nesse credenciamento**. Beep + toast. Se já presente, avisa duplicado.
- Botão **"Copiar Códigos de Participantes"**: copia `nome\tcódigo\n...` (todos presentes nessa aba).
- Botão **"Copiar nomes para sorteio"** (já existe na liga): agora **só lista quem está presente no credenciamento ativo**.
- Botão **"Gerar crachás (PDF)"** — uma página com grid de cartões (nome, código, QR), pdf-lib + qrcode.

Server fns (auth presidente):
- `listEventCheckins({event_id, checkin_index})`
- `markEventCheckin({registration_id, checkin_index, present})`
- `scanEventCheckin({event_id, checkin_index, code})` → encontra por código, marca presente
- Equivalentes para minicurso.

## 6. Certificados de evento e minicurso

Novo botão **"Gerar Certificados"** na aba Presidente > Eventos (por evento) e Presidente > Minicursos (por minicurso). Reaproveita `CertificatesDialog` em modo `event`/`minicourse`:

- Mostra inscritos com **nome completo, CPF, horas calculadas** = `total_hours * (credenciamentos_presentes / checkin_count)` (minicurso = `total_hours` se presente, senão 0).
- Edição inline de nome/CPF.
- Checkbox por linha + **"Selecionar todos"**.
- Mesma assinatura desenhada pela liga (`league_president_signatures`), mesma cor tema da liga.
- Botão **"Enviar Certificados via E-Mail"** → server fn que gera PDF (`buildCertificatePdf` adaptado: título "Participação em evento" / minicurso, lista os credenciamentos comparecidos em vez das atividades da liga) e envia via Gmail `ligasuno@gmail.com`. Log em `certificate_email_log` (já existe).

Server fns novas em `src/lib/event-certificates.functions.ts`:
- `previewEventCertificates({event_id})`, `sendEventCertificates(...)`
- `previewMinicourseCertificates(...)`, `sendMinicourseCertificates(...)`

## 7. Integração Google Sheets (backup)

- Conectar conector `google_sheets` (workspace).
- UI nova em Presidente > Configurações da liga: "Planilha de backup" → cola ID/URL, botão "Testar", botão "Sincronizar agora".
- Server fn `syncEventToSheet({event_id})`: cria aba `Evento <título>` se faltar, escreve headers + linhas (nome, email, cpf, código, status pagamento, presença por credenciamento, horas calculadas).
- Chamado: após cada nova inscrição, após cada credenciamento, e via cron diário das próximas 7 / últimos 30 dias.

## 8. Bibliotecas a adicionar

`html5-qrcode` (scanner), `qrcode` (gerar QR no client e no PDF de crachás). `pdf-lib` já existe.

## 9. Arquivos principais a tocar/criar

```text
supabase/migrations/<ts>_event_checkins_certificates.sql       (novo)
src/lib/event-certificates.functions.ts                         (novo)
src/lib/event-checkin.functions.ts                              (novo)
src/lib/sheets-sync.functions.ts                                (novo)
src/lib/sheets-sync.server.ts                                   (novo, gateway gmail/sheets)
src/components/event-checkin-dialog.tsx                         (novo, abas + scanner)
src/components/qr-scanner.tsx                                   (novo, html5-qrcode wrapper)
src/components/event-certificates-dialog.tsx                    (novo)
src/components/badge-pdf.ts                                     (novo, gera PDF de crachás)
src/lib/certificates.functions.ts                               (refator: extrai builder p/ reuso)
src/routes/presidente.$slug.tsx                                 (botões Credenciamento, Gerar Certificados, Exportar, Sync)
src/routes/$slug/index.tsx                                      (form inscrição: nome completo + CPF + programação)
src/routes/ligante.$slug.tsx                                    (mostra QR/crachá do inscrito)
src/routes/api/public/cron/event-snapshot.ts                    (novo, cron)
```

## 10. Ordem de implementação

1. Migration (schema + trigger de código + RLS + grants).
2. Form de evento/minicurso (campos novos) + form de inscrição (nome/CPF) + UI do programa.
3. Geração de QR no painel do inscrito + PDF de crachás.
4. Dialog de Credenciamento (abas, manual, scanner, copiar códigos, sorteio filtrado).
5. Dialog de Certificados de evento/minicurso + envio por e-mail.
6. Backup: snapshot cron + export CSV/JSON.
7. Sync Google Sheets (conector + UI + ganchos).
