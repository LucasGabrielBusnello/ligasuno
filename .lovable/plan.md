# Reforma da aba Atlética

## 1. Nova "Página Inicial" (substitui "Sobre")
- Primeira aba do sidebar (topo), ícone Home.
- Conteúdo (ordem vertical):
  1. **Hero central** com logo grande + nome + tagline (o que já existe no topo, migra pra dentro dessa aba).
  2. **Card de coleção vigente** (`FeaturedCollection` — reutilizar `CollectionsMarquee` em modo destaque).
  3. **Bloco Sobre** (descrição, história, presidência) — o conteúdo atual de `SobrePanel`.
- Remover o hero global e o marquee que hoje aparecem **acima** do sidebar; passam a viver dentro da aba.
- Aba "Sobre" deixa de existir como item separado.
- Aba **Produtos** vira segundo item; deixa de ser a inicial.

## 2. Sidebar corrigida
- Buttons já são stateful, mas o hero e marquee gigantes acima empurram o conteúdo pra fora da viewport, dando a sensação de "não funciona". Ao mover hero/marquee pra dentro da Página Inicial (item 1), clicar em Produtos/Eventos abre a seção imediatamente.
- Adicionar `scrollTo({ top: 0 })` no `setActive` para garantir feedback visual.
- Header sticky continua; sidebar `fixed top-14`.

## 3. Ciclos de associação (Diretoria > Configurações)
Nova tabela `athletic_membership_cycles`:
- `athletic_id`, `name`, `starts_at`, `ends_at`, `price_new`, `price_renewal`, `open` (bool), `created_at`.
Nova coluna em `athletics`: `memberships_open` (bool) — chave-mestra pra abrir/fechar novas associações.
Nova coluna em `athletic_memberships`: `cycle_id` (FK opcional).

Regras:
- Se `memberships_open = false` **ou** não existe ciclo ativo (com `open=true` e data atual dentro do intervalo): botão "Associar-se" bloqueado com mensagem.
- Se há ciclo ativo: usa `price_new` ou `price_renewal` (renovação = usuário tinha membership no ciclo anterior).
- Ao pagar: `member_until = ciclo.ends_at`, `cycle_id = ciclo.id`.

UI: em **Diretoria > Configurações**, novo bloco "Ciclos de associação":
- Toggle "Aceitar novas associações".
- Lista de ciclos com CRUD (nome, período, preço novo, preço renovação, ativo).

## 4. Permissões granulares por membro
Nova coluna em `athletic_memberships`: `director_tabs text[]` (default `NULL`).
- `NULL` = comportamento atual (presidente + diretor têm tudo).
- Array = restrição às abas listadas. Ignorado se `role='presidente'`.
- Chaves: `produtos, eventos, esportes, socios, financeiro, parceiros, configuracoes`.

UI: no modal de adicionar/editar membro (Diretoria > Sócios), quando `role` for `diretor`, aparecem 7 checkboxes.
Front-end filtra abas do `DirectorPanel` conforme `director_tabs`.

## 5. InfinitePay no Financeiro (API completa)
Nova tabela `athletic_infinitepay_accounts`:
- `athletic_id` (unique), `handle`, `api_key_encrypted`, `webhook_secret_encrypted`, `connected_at`.
Secret global `INFINITEPAY_API_URL` (base URL).

UI: em **Diretoria > Financeiro**, novo card "InfinitePay":
- Campo pra colar handle + API key + webhook secret; botão "Conectar".
- Server function `saveInfinitepayCredentials` (guarda com Web Crypto AES-GCM, chave em `APP_ENCRYPTION_KEY` gerada via `generate_secret`).
- Server function `disconnectInfinitepay`.
- Server function `createInfinitepayCharge` (usada pela associação/produtos como método alternativo ao MP).
- Route `src/routes/api/public/payments/infinitepay-webhook.ts` (verifica HMAC do webhook secret; marca `paid`).

Passo 1 desta entrega: só o skeleton (tabela, tela de conectar, secret de encryption). Pagamentos via InfinitePay ficam pra segundo turno assim que confirmar endpoints exatos da API (que variam por conta merchant/checkout).

## Detalhes técnicos

### Migração (1 arquivo)
```sql
alter table athletics add column if not exists memberships_open boolean not null default true;

create table public.athletic_membership_cycles (
  id uuid primary key default gen_random_uuid(),
  athletic_id uuid not null references athletics(id) on delete cascade,
  name text not null,
  starts_at date not null,
  ends_at date not null,
  price_new numeric(10,2) not null,
  price_renewal numeric(10,2) not null,
  open boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- grants, RLS (director read/write, anon read active), trigger updated_at

alter table athletic_memberships
  add column if not exists cycle_id uuid references athletic_membership_cycles(id) on delete set null,
  add column if not exists director_tabs text[];

create table public.athletic_infinitepay_accounts (
  id uuid primary key default gen_random_uuid(),
  athletic_id uuid not null unique references athletics(id) on delete cascade,
  handle text not null,
  api_key_encrypted text not null,
  webhook_secret_encrypted text not null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- grants, RLS (só diretoria)
```

### Server functions novas
`src/lib/athletic.functions.ts`:
- `upsertMembershipCycle`, `deleteMembershipCycle`, `toggleMembershipsOpen`
- `saveInfinitepayCredentials`, `disconnectInfinitepay`, `getInfinitepayStatus`

### Front-end
- `src/routes/atletica.tsx`:
  - Adiciona `SectionKey = "inicio" | ...`; remove `"sobre"`; `inicio` como default.
  - Novo componente `InicioSection` (hero + coleção destaque + sobre).
  - Remove hero e marquee do topo (fora de `<main>`).
  - `DirectorPanel`: filtra abas por `director_tabs`; nova sub-aba "Ciclos" dentro de Configurações; novo card InfinitePay em Financeiro.
  - Modal editar membro: checkboxes de abas.
  - `AssociarButton`: consulta ciclo ativo; bloqueia se fechado; mostra preço apropriado (novo vs renovação).

## Fora de escopo (próximos turnos)
- Implementar de fato os endpoints de charge/webhook da InfinitePay (precisa das credenciais reais e do dashboard InfinitePay pra confirmar URLs e payload).
- Migrar pagamentos MP existentes pro fluxo de escolha MP/InfinitePay no checkout.
