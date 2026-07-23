
## Contexto

O link que você me passou (`https://checkout.infinitepay.io/aaamd-desbravadores/...`) é do **Checkout Integrado** da InfinitePay — o modo mais simples, funciona só com o **handle** (`aaamd-desbravadores`). Não precisa de API key nem de OAuth. O pagamento redireciona pra página oficial da InfinitePay (Pix, débito, crédito com parcelamento) e volta pro nosso site.

Hoje o formulário no painel da atlética pede 3 campos (handle + api_key + webhook_secret), o que é excesso pra esse modo. Vou simplificar.

## O que vou entregar

1. **Simplificar o formulário "InfinitePay da atlética"** (`src/routes/atletica.tsx`)
   - Deixar só: **Handle** (obrigatório) e **Webhook Secret** (opcional, pra validar retornos futuros).
   - Remover o campo API key.
   - Texto de ajuda: "Basta seu handle da InfinitePay (o que aparece na URL do seu checkout, ex.: `aaamd-desbravadores`)."

2. **Ajustar o backend** (`src/lib/athletic-config.functions.ts`)
   - `saveInfinitepayCredentials`: aceitar sem `api_key`; `webhook_secret` opcional.

3. **Criar o gerador de link de pagamento InfinitePay** (novo `src/lib/infinitepay.server.ts`)
   - Função que monta a URL do Checkout Integrado com `items` (base64 do JSON), `redirect_url`, `webhook_url` e `order_nsu` (id interno do pedido) — padrão documentado da InfinitePay.

4. **Novas server functions de checkout InfinitePay** (novo `src/lib/infinitepay-payments.functions.ts`), paralelas às de Mercado Pago já existentes:
   - `createMembershipInfinitepayCheckout` — associação
   - `createEventTicketInfinitepayCheckout` — ingresso online (mesmo fluxo de reserva de ticket que MP)
   - `createCartInfinitepayCheckout` — carrinho de produtos
   - Cada uma retorna `{ checkout_url }` pro frontend abrir em nova aba/redirect.

5. **Webhook público** (`src/routes/api/public/payments/infinitepay-webhook.ts`)
   - Recebe POST da InfinitePay, lê `order_nsu` pra localizar `athletic_membership_payments` / `athletic_event_tickets` / `athletic_product_orders` e marca como pago.
   - Se a atlética tiver `webhook_secret` salvo, valida a assinatura antes de processar.
   - URL fixa (uso na configuração da InfinitePay): `https://ligasuno.com.br/api/public/payments/infinitepay-webhook`.

6. **Frontend de compra**: nos diálogos de associação, ingresso e checkout do carrinho, adicionar botão **"Pagar com InfinitePay"** ao lado dos botões de Pix/Cartão do MP. Só aparece se a atlética tiver InfinitePay conectada.

## Fora do escopo (posso fazer depois se quiser)

- Split automático entre atléticas via InfinitePay (a InfinitePay não expõe API pública de split; ficaria manual/centralizado como já discutimos).
- Migrar tudo de Mercado Pago pra InfinitePay — vou deixar **os dois convivendo**, o comprador escolhe.

## Confirme antes de eu executar

- Handle a salvar: **`aaamd-desbravadores`** (posso já deixar pré-preenchido no form, você só clica salvar). OK?
- Webhook secret: você configurou algum no painel da InfinitePay? Se sim, me diga que a gente salva; se não, deixo em branco e o webhook aceita sem verificar assinatura (o ideal é você gerar um depois).
