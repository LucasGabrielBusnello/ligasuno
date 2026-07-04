## Checkpoint "Sem Atlética"

Antes de qualquer mudança, deixo um commit-checkpoint no History rotulado **"Versão Sem Atlética — checkpoint"**. Depois, o próximo commit inicia **"Atlética Demo"**. Você pode reverter pelo History a qualquer momento.

> ⚠️ Importante: tabelas criadas para a atlética **permanecem no banco** mesmo se você reverter o código. Isso não quebra o site atual, mas é irreversível pelo History.

---

## Modelo de dados (novo)

- `athletics` — atlética única (AAAMD Desbravadores): nome, slug, logo, cores, descrição, presidente_id.
- `athletic_memberships` — sócios/diretores: `athletic_id`, `user_id`, `role` (`socio` | `diretor` | `presidente`), `matricula`, `semestre`, `cpf`, `member_until` (data limite da sociedade), `active`.
- `athletic_collections` — coleções de produtos (ex.: "Intermed", "Ação Social").
- `athletic_products` — produto: título, descrição, imagens[], preço, coleção, estoque, `discount_pct`, `second_item_discount_pct` (desconto na 2ª peça), tags de marketing (`is_highlight`, `is_new`, `badge_text`).
- `athletic_product_orders` + `athletic_product_order_items` — pedidos online (categoria de pagamento: `athletic_product`).
- `athletic_events` — evento/festa: título, data, local, descrição, imagens[], preço socio/visitante, **total_tickets**, tickets_disponíveis, tema/cor.
- `athletic_event_tickets` — cada ingresso físico gerado: `code` (UUID curto p/ QR), `batch_id`, `status` (`available` | `sold` | `used`), `sold_channel` (`online` | `manual`), `payment_methods` (jsonb: {pix, dinheiro, cartao}), comprador (nome, email, telefone, cpf).
- `athletic_membership_payments` — histórico de pagamentos de associação (período único).
- `athletic_cash_entries` — caixa da atlética (mesma lógica de `league_cash_entries`, categorias: `product`, `event_online`, `event_manual`, `membership`).
- `athletic_mp_account` — OAuth Mercado Pago da atlética (reusa lógica de `league_mp_accounts`).
- `app_settings` ganha: `fee_atletica_event_pct/fixed`, `fee_atletica_product_pct/fixed`, `fee_atletica_membership_pct/fixed`.

RLS: sócios veem "Sócios"; diretores/presidente veem painel de gestão; público vê Produtos e Eventos.

---

## Frontend

### Página inicial (`/`)
Adiciona nova aba **Atlética** ao lado de Ligas / Minhas Ligas / Camed / Eventos. Card decorado com o logo AAAMD (paleta preto+laranja+verde do Instagram) e CTA **"Associar-se"** se o usuário logado ainda não for sócio.

### Nova rota `/atletica` (com sub-abas)
Design festivo, dark, laranja neon + verde esporte, tipografia condensada estilo esportivo (Bebas/Barlow) — inspirado no Instagram @aaamdesbravadores. Elementos decorativos: mascote Desbravador, badges de coleções (Parcerias, Intermed, Torcida, Ação Social, Carnaval).

Sub-abas:
1. **Produtos** — vitrine e-commerce por coleção, cards com preço original/promocional, badges "NOVO", "-X% na 2ª peça", "OFERTA", carrinho simples, checkout via MP (Pix), envio de e-mail de confirmação.
2. **Eventos** — grid de festas/eventos com hero image, contagem regressiva, preço sócio vs visitante, botão comprar → Pix MP → e-mail com ingresso digital (QR).
3. **Sócios** (só logado + sócio ativo) — área do sócio: grupo de esportes, avisos, benefícios, carteirinha digital. Placeholder para funcionalidades futuras.
4. **Diretoria** (só diretor/presidente) — ver abaixo.
5. **Associar-se** — página/modal explicando benefícios, valor definido pela diretoria, coleta matrícula/semestre/CPF, paga via Pix MP → vira sócio até `member_until`.

### Painel Diretoria (`/atletica` → aba Diretoria)
Sub-abas:
- **Sócios**: tabela com nome, gmail, matrícula, semestre, CPF, cargo, `member_until`. Ações: trocar cargo (sócio ↔ diretor), adicionar manualmente, exportar CSV.
- **Produtos**: CRUD de coleções e produtos, upload de imagens, desconto normal + desconto na 2ª peça, marcar destaque/novo, controle de estoque.
- **Eventos**: CRUD de eventos + campo **Total de ingressos**. Ao abrir um evento:
  - Lista de todos os `event_tickets` com status.
  - Botão **"Emitir ingressos físicos PDF"** → pede quantidade → gera lote de ingressos (novos códigos QR únicos), gera PDF decorado (mascote Desbravador + nome do evento + QR + código) formatado para recorte.
  - Botão **"Registrar venda manual"** → abre câmera (QRScanner já existe no projeto), valida QR:
    - Se `available`: abre form (Nome, Gmail, Número, CPF, Métodos de pagamento múltiplos com valor por método) → salva venda → status vira `sold` → decrementa disponíveis → cria entrada no Caixa Atlética (bruto − taxas) → envia e-mail com ingresso.
    - Se `sold`/`used`: mostra dados da venda e bloqueia revenda (uso único).
- **Caixa**: réplica do caixa das ligas, entradas de: vendas online produtos, vendas online eventos, vendas manuais eventos, associações — sempre com valor líquido (bruto − taxa MP − taxa plataforma).
- **Configurações**: valor da associação, período (dias) de sociedade, conectar/desconectar Mercado Pago (OAuth reusando `mp-oauth-*`).

### Admin (`/admin` → Configurações)
Novos campos:
- Taxa eventos atlética (% + fixo)
- Taxa produtos atlética (% + fixo)
- Taxa associações atlética (% + fixo)

---

## Pagamentos

Reusa integração Mercado Pago existente (`src/lib/mp.server.ts`, `mp-oauth-*`). Nova conta OAuth por atlética. Split idêntico ao das ligas: `marketplace_fee` = taxa da plataforma (lida de `app_settings`).

Categorias novas em `computeFee`: `atletica_event`, `atletica_product`, `atletica_membership`.

Webhook único (`/api/public/payments/mp-webhook`) roteia por `external_reference`:
- `ath_event:<ticket_id>` → marca ticket como `sold`, cria entrada no caixa, envia e-mail com QR.
- `ath_prod:<order_id>` → marca pedido como pago, decrementa estoque, envia e-mail, entrada no caixa.
- `ath_memb:<payment_id>` → ativa membership (`member_until` = hoje + período), entrada no caixa.

---

## E-mails

Reusa `gmail.server.ts` (remetente `ligasuno@gmail.com`). Templates novos:
- Ingresso vendido (online ou manual): dados do evento + QR embedado + código.
- Pedido de produto confirmado.
- Bem-vindo sócio.

---

## Passo-a-passo de verificação (o que você deve testar)

1. **Checkpoint**: abra o History e confirme a mensagem "Versão Sem Atlética — checkpoint".
2. **Home**: veja a nova aba **Atlética** com identidade AAAMD.
3. **Não-sócio**: entre na aba, veja o botão **Associar-se** destacado. Complete o fluxo Pix (sandbox) → confirme que virou sócio.
4. **Produtos** (público): navegue por coleções, veja badges de promoção, adicione ao carrinho, pague via Pix → confirme e-mail recebido em ligasuno@gmail.com.
5. **Eventos** (público): compre ingresso online → confirme e-mail com QR.
6. **Sócios**: como sócio, acesse a aba exclusiva (aparece só pra você).
7. **Diretoria → Sócios**: veja tabela com gmail/matrícula/semestre/CPF; promova um sócio a diretor; adicione um sócio manualmente.
8. **Diretoria → Produtos**: crie coleção, produto com desconto na 2ª peça → verifique que vitrine mostra o mega desconto.
9. **Diretoria → Eventos**: crie evento com 100 ingressos → clique **Emitir físicos** (10) → baixe PDF, confira layout, QR e recortes.
10. **Registrar venda manual**: no celular, abra evento na diretoria → **Registrar venda manual** → escaneie um QR do PDF → preencha (misturando Pix R$20 + Dinheiro R$10) → confirme.
11. Verifique: ingresso ficou `sold`, disponíveis caiu 1, entrada apareceu no Caixa com valor líquido, e-mail chegou no comprador. Tente escanear o mesmo QR de novo → bloqueado.
12. **Caixa**: veja entradas separadas por categoria (produto online, evento online, evento manual, associação).
13. **Admin → Configurações**: ajuste as 3 taxas da atlética; refaça uma compra e confira que o líquido no caixa mudou.
14. **Mercado Pago da atlética**: em Diretoria → Configurações, desconecte e reconecte a conta MP.
15. **Site atual**: entre em ligasuno.com.br em aba anônima → confirme que Ligas/Camed/Eventos continuam iguais e nada quebrou.

---

## Detalhes técnicos

- Novo módulo `src/lib/athletic-*.functions.ts` (produtos, eventos, tickets, sócios, caixa, membership).
- `src/routes/atletica.tsx` com sub-rotas via search params ou child routes.
- PDF de ingressos com `@react-pdf/renderer` (ou `pdfkit`) já usado para certificados.
- QR: reusa `src/components/qr-scanner.tsx` e `src/components/qr-image.tsx`.
- Migração única cria todas as tabelas + GRANTs + RLS + policies.
- Cores/fontes AAAMD adicionadas como tokens no `src/styles.css` sob namespace `--atletica-*` para não vazar no resto do site.
- Feature isolada: se `athletics` estiver vazio, a aba não aparece — permite "desligar" sem reverter.
