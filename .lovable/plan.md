
## O que ainda falta do plano original (revisão)

Marcado ✅ = pronto · ⏳ = parcial · ❌ = pendente

- ✅ Rebrand MEDUNO, tema verde, barra superior com Aluno/AAAMD/Ligas/CAMED
- ✅ Login com matrícula/turma + diálogo "Atualizar cadastro" único
- ✅ Painéis administrativos removidos do header (Admin/Coordenação isolados)
- ✅ Currículo (componentes, turmas, subdivisões, professor, contato, carga horária)
- ✅ Semestres letivos (início/fim) e feriados
- ✅ Grid semanal do aluno com turnos manhã/tarde/noite, seg–sáb
- ✅ Zona verde automática quando outra subdivisão tem aula
- ✅ Cores por tipo (aula, prática, avaliação, zona verde, feriado, remarcada)
- ✅ Editor da coordenação com painel lateral por turno, "Marcar em lote", remarcação
- ✅ Ir para data específica no cronograma
- ⏳ **Prática em cor roxa** — hoje está âmbar; ajustar para roxo
- ⏳ **Filtro por subdivisão do aluno** no grid (mostrar só aulas da turma dele) + botão para trocar A/B/C direto na lista de matérias
- ⏳ **Agenda pessoal do aluno aparecendo dentro do grid** (hoje é lista separada)
- ⏳ **Eventos inscritos (atlética/ligas) no cronograma do aluno**
- ❌ **Google Agenda**: botão "Sincronizar" com preview das subdivisões antes do envio
- ❌ **Copiar/duplicar semana inteira** para outra semana no editor da coordenação
- ❌ **"Marcar em lote" com calendário multi-seleção** (hoje aceita datas digitadas)
- ❌ **Aviso de conflito** ao remarcar para um turno já ocupado
- ❌ Notificações de mudança de cronograma para a turma afetada
- ❌ Exportação do cronograma (PDF/print)

## O que vou implementar agora

### 1. Home enxuta (`src/routes/index.tsx`)
- Manter apenas: header (já existe globalmente) + hero MEDUNO + **card de anúncio da atlética**.
- **Remover** da home: grid de páginas (Aluno/AAAMD/Ligas/CAMED) e listagem de Ligas.
- Mover conteúdos:
  - Lista de **Ligas** e busca → passar para `/ligas` (se ainda não estiver lá).
  - Atalhos rápidos que estavam no hub → já cobertos pela barra superior; nada duplicado.
- Card da atlética continua clicável levando para `/aaamd`.

### 2. Google Agenda (App User Connector)
- Configurar cliente `google_calendar` via App User Connector.
- Tabela `app_user_connections` (cifrada) para guardar a chave por usuário.
- Botão **"Sincronizar com Google Agenda"** acima do grid do aluno.
- Diálogo de preview: lista `Matéria (Turma X)` conforme subdivisões escolhidas + eventos pessoais + eventos inscritos, com botão confirmar.
- Server fn cria/atualiza eventos no calendário "primary" (idempotente por `extendedProperties.private.meduno_entry_id`).
- Botão "Desconectar Google Agenda" no perfil.

### 3. Copiar semana (coordenação)
- Botão **"Copiar esta semana para…"** no header do editor.
- Popover com date-picker da semana destino + checkbox "sobrescrever se houver conflito".
- Server fn `copyWeek({ classCode, fromMonday, toMonday, overwrite })`.

### 4. Marcar em lote com calendário multi-seleção
- Substituir input de datas por `<Calendar mode="multiple">` (shadcn) com destaque para dias letivos e feriados desabilitados.
- Mantém opções atuais (tipo aula/prática/prova, matéria, turno, subdivisão).

### 5. Ajustes visuais/comportamentais complementares
- **Prática em roxo** (ajuste em `schedule-grid.tsx` + legenda).
- **Filtro por subdivisão no painel do aluno**: seletor A/B/C ao lado das matérias; grid mostra só entradas daquela subdivisão + entradas sem subdivisão.
- **Eventos inscritos no grid do aluno**: unir `event_registrations` (atlética) + `league_events` inscritos e renderizar no dia (cor accent, não interfere em zona verde).
- **Aviso de conflito na remarcação**: ao escolher data/turno destino, checar `schedule_entries` existentes e mostrar alerta antes de confirmar.

## Detalhes técnicos

- **Banco:** nova tabela `app_user_connections` (id, user_id, connector_id, connection_key_ciphertext, timestamps) com RLS só `service_role`; nenhum schema change para copy-week / multi-select / roxo.
- **Server functions novas:** `src/lib/schedule.functions.ts` → `copyWeek`; `src/lib/google-calendar.functions.ts` → `connectGoogle`, `disconnectGoogle`, `syncScheduleToGoogle`, `previewScheduleSync`.
- **Cripto:** `src/server/connectionKeyCrypto.ts` (AES-256-GCM com `APP_USER_CONNECTION_KEY_SECRET`).
- **Componentes novos:** `google-sync-dialog.tsx`, `copy-week-popover.tsx`, atualizar `bulk-mark-dialog` (dentro de `coordenacao.cronograma.tsx`) para calendário multi-seleção.
- **Rota home:** editar apenas `src/routes/index.tsx`; nada em `__root.tsx`.

## Fora do escopo desta rodada

- Notificações push/e-mail de mudança de cronograma.
- Exportação PDF do cronograma.
- Two-way sync (Google → MEDUNO) — só faremos MEDUNO → Google.

Confirmando esse plano, sigo com a implementação.
