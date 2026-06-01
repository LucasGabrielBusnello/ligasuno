
## Visão geral

Mercado Pago será o **único provedor de pagamentos**. Você (CPF) opera como "marketplace" e cada presidente conecta a própria conta MP via OAuth. Em cada pagamento, o MP debita automaticamente uma taxa (`marketplace_fee`) que cai na sua conta e o restante vai direto pra conta do presidente — sem você intermediar dinheiro.

```
[Aluno paga PIX/Cartão]
        │
        ▼
[Mercado Pago do Presidente] ──► recebe valor líquido
        │
        └──► marketplace_fee (taxa configurada) ──► [Sua conta MP]
```

Anuidade da plataforma usa o mesmo MP, sem split (100% pra você).

## O que você precisa providenciar

1. **Conta Mercado Pago (CPF)** — gratuita em mercadopago.com.br
2. **Criar uma aplicação** em developers.mercadopago.com → Suas integrações → Criar aplicação
   - Tipo: "Pagamentos online" + "Marketplace"
3. **Copiar 3 valores** da aplicação (vou pedir via secrets):
   - `MP_ACCESS_TOKEN` (Production) — sua chave da plataforma
   - `MP_CLIENT_ID` — pra OAuth dos presidentes
   - `MP_CLIENT_SECRET` — pra OAuth dos presidentes
4. **Configurar Redirect URI** na aplicação MP:
   `https://ligasuno.lovable.app/api/public/payments/mp-oauth-callback`
5. **Configurar Webhook** na aplicação MP (tópicos: `payment`, `merchant_order`):
   `https://ligasuno.lovable.app/api/public/payments/mp-webhook`

## Fluxo do presidente (uma vez)

1. Painel do presidente → botão "Conectar Mercado Pago"
2. Redireciona pro MP → presidente faz login (ou cria conta gratuita: CPF + dados bancários)
3. Autoriza nossa aplicação
4. Voltamos com `access_token` + `user_id` do presidente, salvos em `league_mp_accounts`
5. Pronto — todas as inscrições da liga dele já caem na conta dele com split automático

## Mudanças no banco (migração)

**Nova tabela `league_mp_accounts`** — credenciais MP por liga
- `league_id`, `mp_user_id`, `access_token` (criptografado), `refresh_token`, `public_key`, `expires_at`, `connected_at`

**Tabela `app_settings`** — adicionar colunas de taxa (% + valor fixo) por categoria:
- `fee_selection_pct`, `fee_selection_fixed`
- `fee_semester_pct`, `fee_semester_fixed`
- `fee_event_pct`, `fee_event_fixed`
- `fee_minicourse_pct`, `fee_minicourse_fixed`
- (Anuidade não tem taxa — é 100% sua)

**Tabela `payment_transactions`** — log unificado de todos pagamentos MP (id, tipo, valor bruto, taxa retida, status, mp_payment_id, league_id, user_id)

## Mudanças no código

### Backend (server functions novas/refatoradas)

1. `src/lib/mp.server.ts` — cliente MP (helper de fetch com auth, criar pagamento PIX/Cartão com split, criar assinatura)
2. `src/lib/mp-oauth.functions.ts` — iniciar OAuth e callback
3. `src/lib/events.functions.ts` — trocar Stripe por MP (`createEventCheckout`)
4. `src/lib/minicourses.functions.ts` — trocar Stripe por MP
5. `src/lib/selection.functions.ts` — trocar Stripe por MP para taxa de seletiva
6. `src/lib/subscription.functions.ts` — trocar Stripe por MP (anuidade recorrente, sem split)
7. `src/routes/api/public/payments/mp-webhook.ts` — novo webhook MP (substitui o do Stripe)
8. `src/routes/api/public/payments/mp-oauth-callback.ts` — callback OAuth

### Frontend

9. `src/routes/admin.tsx` (aba Configurações) — campos de taxa por categoria (% + R$ fixo)
10. `src/routes/presidente.$slug.tsx` — card "Mercado Pago" com botão Conectar/Reconectar/Desconectar + status
11. Bloquear publicação de evento/seletiva/minicurso pago se a liga ainda não conectou MP (com aviso claro)
12. Remover referências a Stripe nas telas

### Cleanup

13. Remover `src/lib/subscription.functions.ts` versão Stripe, helpers Stripe, secrets Stripe (`STRIPE_*`) ficam no projeto mas sem uso
14. Remover edge function `payments/webhook` antiga (manter por compat até validar MP em produção)

## Tratamento de taxas

Para cada pagamento (exceto anuidade):
```
valor_taxa = arredondar(preço × pct/100 + fixo, 2)
marketplace_fee = valor_taxa  // vai pra você
recebedor = mp_account da liga // recebe (preço - valor_taxa - taxa_MP)
```

Taxa do MP em si (0,99% PIX ou ~4,98% cartão) é descontada do presidente, não da plataforma — padrão de marketplace.

## Anuidade (100% sua)

Continua sendo cobrança recorrente mensal, mas no MP via "Assinaturas" (preapproval). Cobra no seu próprio access_token, sem split. Webhook atualiza `paid_until` e `published` da liga igual hoje.

## Validação

- Testar OAuth com 1 presidente fictício (você pode criar 2ª conta MP de teste)
- Testar 1 pagamento PIX em modo sandbox primeiro
- Conferir no painel MP que o split apareceu corretamente

## Detalhes técnicos relevantes

- API MP usa `Authorization: Bearer <access_token>` direto (sem gateway Lovable)
- PIX retorna QR Code + copia-cola na resposta → renderizar modal próprio (não tem checkout hospedado bom pra PIX)
- Cartão usa Checkout Pro (URL hospedada do MP, similar ao Stripe Checkout)
- Webhook MP envia só `{id, type}` — precisamos fazer GET no recurso pra pegar detalhes (padrão MP)
- Tokens OAuth do presidente expiram em 180 dias → guardar `refresh_token` e renovar automaticamente

## Próximo passo

Quando aprovar este plano, vou:
1. Pedir os 3 secrets do MP via tool de secrets
2. Rodar a migração do banco
3. Implementar tudo na ordem acima
