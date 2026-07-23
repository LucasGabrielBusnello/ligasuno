## Checklist para começar a receber pagamentos na atlética

Sem mexer em código — só configuração. Segue a ordem:

### 1. Salvar o handle no painel da atlética (2 min)
- Entre no site logado como diretor(a) da AAAMD.
- Vá em **Atlética → Diretoria → InfinitePay**.
- Campo **Handle**: cole `aaamd-desbravadores` (é o que aparece na URL `checkout.infinitepay.io/aaamd-desbravadores/...`).
- Deixe **Webhook Secret** em branco por enquanto.
- Clique **Salvar**.

### 2. Conferir se os botões de pagamento apareceram (1 min)
Nos 3 lugares abaixo deve surgir o botão **Pagar com InfinitePay**:
- Diálogo de **Associação** (virar sócio).
- Diálogo de **Ingresso** de evento (quando venda online estiver aberta).
- **Carrinho** de produtos da atlética.

Se algum não aparecer, é sinal de que o handle não salvou — volte ao passo 1.

### 3. Fazer uma compra de teste de R$ 1 (5 min)
- Crie um produto qualquer com preço **R$ 1,00** e estoque 1.
- Faça o fluxo completo como sócio: adiciona ao carrinho → **Pagar com InfinitePay** → cai no checkout da InfinitePay → paga no Pix.
- Volta pro site com `?paid=1` na URL e toast de sucesso.
- **Confirme no painel financeiro** da atlética que o pedido apareceu como **Pago**.

Se o pedido ficou como "Pendente" mesmo após pagar, o webhook não chegou — vá pro passo 4.

### 4. (Opcional mas recomendado) Configurar o webhook na InfinitePay
Isso garante que o site marca o pedido como pago automaticamente, sem depender do usuário voltar pela URL de retorno.

- Entre em **infinitepay.io** com a conta da AAAMD.
- Vá em **Loja Virtual → Webhooks** (ou **Integrações → Webhooks**).
- Cadastre a URL: `https://ligasuno.com.br/api/public/payments/infinitepay-webhook`
- Método: **POST**.
- Eventos: **Pagamento aprovado / concluído** (marque tudo relacionado a pagamento).
- Salve.

### 5. (Opcional) Ativar assinatura do webhook
Só faça isso se a InfinitePay pedir/oferecer uma chave secreta:
- Gere uma string aleatória (ex.: `openssl rand -hex 32` ou um gerador de senha).
- Cole a **mesma string** nos dois lugares: no campo Secret da InfinitePay **e** no card InfinitePay do painel da atlética.
- Salve nos dois lados.

### 6. Repetir o teste
- Refaça uma compra de R$ 1.
- Agora o pedido deve virar **Pago** sozinho, mesmo se você fechar a aba antes de voltar pro site.
- Confirme o recibo por e-mail chegando.

---

### Se algo der errado
Me diga em qual passo travou e o que apareceu (mensagem de erro, print, ou "o botão não aparece"). Os problemas mais comuns:
- **"InfinitePay não conectada"** → handle não salvou (passo 1).
- **Pedido fica "Pendente" após pagar** → webhook não configurado (passo 4).
- **Painel da InfinitePay não mostra webhook** → abrir chamado no suporte pedindo liberação de Checkout Integrado + Webhook para o handle `aaamd-desbravadores`.