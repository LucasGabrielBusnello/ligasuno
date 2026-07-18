# Plano de implementação

Pedido muito grande — divido em 4 fases para você aprovar antes de eu abrir migrations e reescrever telas inteiras. Cada fase é independente e pode ser aprovada/adiada.

---

## Fase 1 — Cronograma (coordenação)

**Banco**
- Adicionar `term_start_date` e `term_end_date` em `academic_terms` (semestre letivo).
- Nova tabela `class_subdivisions` (class_code, letter A/B/C…, shift_morning_start, shift_morning_end, shift_afternoon_start, shift_afternoon_end, shift_night_start, shift_night_end). Turma "A" criada automaticamente.

**UI Coordenação → Currículo**
- No editor de turma ATM: barra listando A (fixa), botão "+" adiciona B, C, D… (próxima letra). Clicar na barra abre painel com 3 blocos (Manhã/Tarde/Noite) e horários início/fim; vazios usam o padrão global.

**UI Cronograma**
- Grid semanal respeita `term_start_date`/`term_end_date` — semanas fora do período mostram aviso "fora do semestre letivo".
- Ao criar/editar entrada, opção **"Todas as turmas"** (grava uma entrada por subdivisão existente, ou entrada especial `subdivision = '*'` que aparece em todas).
- Remover a opção **"Prática Abex"** do seletor de tipo.
- **Criar em lote** ganha campos `start_time`/`end_time` opcionais (fallback ao padrão da turma+turno).
- **Alerta de choque**: badge vermelho na célula quando duas matérias ocupam mesmo horário/subdivisão; tooltip lista as conflitantes.

---

## Fase 2 — Atlética com sidebar

**Layout**
- Reescrever `/atletica` para layout com sidebar esquerda (colapsável em mobile via Sheet). Abas: **Produtos, Eventos, Esportes, Sobre, Diretoria, Painel do Sócio** (só sócios).
- Manter paleta verde/laranja atual.

**Mudanças por aba**
- **Produtos**: layout ajustado, lógica mantida.
- **Eventos**: mantido.
- **Esportes** (nova, substitui "Sócio"): grade de esportes com foto, descrição, gênero e botão "Entrar no grupo WhatsApp". Remove inscrição/vagas.
- **Sobre**: descrição + no fim da página, seção **Parceiros** (movida de "Sócio").
- **Painel do Sócio** (visível só a sócios ativos): mostra data-fim da associação + **carteirinha** no modelo da imagem enviada (fundo verde, título laranja, logo central, dados: Nome, CPF, RA/matrícula, Turma ATM, Data de nascimento, Data fim associação, logo AAAMD no rodapé).

**Perfil do sócio**
- `profiles` já tem cpf/full_name/class_code. Faltam **matrícula** (já existe `enrollment_id`) e **data de nascimento** — adicionar `birth_date`.

---

## Fase 3 — Diretoria (reformulações)

**Permissões granulares**
- Nova coluna `permissions` (jsonb) em `athletic_memberships` armazenando flags: `socios, produtos, eventos, esportes, parceiros, caixa, config`.
- Ao criar/editar membro em Diretoria → Sócios, checkboxes com essas 7 permissões. Sidebar da Diretoria mostra só as abas permitidas. Presidente e admin master têm tudo.

**Aba Eventos (diretoria)**
- Botão "Gerar ingressos" → renomear para **"Registrar venda"** (formulário: nome, e-mail, telefone, valor pago manual, método de pagamento manual).
- "Gerenciar" mostra lista de ingressos vendidos (já existe parcialmente, garantir).
- Editor de evento: checkbox **"Sem limite de ingressos"** (grava `capacity = null`).

**Aba Caixa**
- Campo para anexar comprovante em entradas manuais (upload no storage), igual às ligas.

**Conta InfinitePay**
- Nova aba **Config → Pagamentos**: quem tem permissão `caixa` (ou `config`) pode vincular/alterar handle da InfinitePay (input de texto salvo em `athletics.infinitepay_handle`).
- Adicionar coluna `infinitepay_handle text` em `athletics`.
- Server fn de checkout gera link `https://checkout.infinitepay.io/{handle}?...` (Pix sem taxa; cartão com taxa da InfinitePay).
- Split "virtual": após confirmação (webhook InfinitePay), aplicar taxa configurada e registrar no caixa como fez anteriormente com o MP.

**Painel Admin → Config**
- Já existe fee_atletica_*. Zerar valores default (definir 0 nas configs existentes via migration) e adicionar aviso de que taxas são cobradas via split virtual.

---

## Fase 4 — Hub inicial

- Adicionar de volta um **card de propaganda** na home logo abaixo da barra superior — por enquanto, banner fixo da AAAMD Desbravadores (imagem de capa da atlética + CTA "Conheça a AAAMD" → `/atletica`).

---

## Perguntas antes de começar

1. **Ordem**: implemento Fase 1 → 2 → 3 → 4 sequencialmente (uma resposta por fase, você aprova cada migration antes da próxima), ok?
2. **InfinitePay checkout**: uso o **link de checkout público** deles (`checkout.infinitepay.io/{handle}`) por enquanto? A API oficial de split não existe; confirmação de pagamento seria manual ou via webhook simples da InfinitePay (você precisaria configurar no painel deles depois).
3. **Turmas globais**: quando você marca "Todas as turmas" no cronograma, prefere gravar **1 entrada por subdivisão** (duplica no banco, fácil editar depois individualmente) ou **1 entrada com marca especial `*`** (mais limpo, mas edições futuras afetam todas)?
4. **Data de nascimento**: adicionar no fluxo de revisão de perfil (dialog que já pede matrícula/turma) para os já-cadastrados preencherem?

Confirme ordem e as 3 perguntas para eu abrir a Fase 1.
