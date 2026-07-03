## Objetivo
Conectar um domínio `.com.br` customizado ao projeto publicado, priorizando o caminho mais barato.

## Contexto atual
- Projeto já publicado em: `https://ligasuno.lovable.app`
- Plano pago ativo (permite domínio customizado).
- Nenhum domínio customizado conectado no momento.

## Plano de ação

### 1. Comprar o domínio `.com.br` no registrador mais barato
Sugestões para comparar preços de registro e renovação:
- **Registro.br** (oficial para .com.br)
- **Hostinger**
- **GoDaddy**
- **Namecheap**

Escolha o que tiver o menor custo total de primeiro ano + renovação.

### 2. Publicar/verificar o projeto
Certificar-se de que o projeto está publicado para que o domínio customizado possa apontar para ele.

### 3. Iniciar a conexão do domínio no Lovable
- Acessar **Project Settings → Project section → Domains**
- Ou clicar em **Publish → Add custom domain**
- Inserir o domínio `.com.br` desejado (ex: `seudominio.com.br`)

### 4. Configurar os registros DNS no registrador
O Lovable fornecerá os registros necessários. Normalmente serão:
- **A Record** para `@` apontando para o IP do Lovable
- **A Record** para `www` apontando para o IP do Lovable
- **TXT Record** para `_lovable` com o valor de verificação

Adicionar esses registros no painel DNS do registrador onde o domínio foi comprado.

### 5. Aguardar propagação e verificar
- Propagação DNS pode levar até 72 horas.
- O Lovable fará a verificação automaticamente.
- Após ativo, escolher o domínio `.com.br` como primário para redirecionar o `.lovable.app`.

### 6. Testar o domínio
Acessar `https://seudominio.com.br` e confirmar que o site carrega corretamente.

## Observações importantes
- Não é possível comprar/conectar `.com.br` em plano gratuito, mas você já está em plano pago.
- Comprar dentro do Lovable é mais conveniente, mas registradores externos costumam ser mais baratos para domínios `.com.br`.
- Não posso executar a compra nem inserir dados de pagamento — isso precisa ser feito por você na sua conta.

## Próximo passo
Me confirme quando tiver comprado o domínio e eu guio você na conexão/configuração dentro do Lovable.