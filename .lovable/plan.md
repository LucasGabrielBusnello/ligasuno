## Controles de armazenamento

### 1. Limites no upload (aba Caixa)
- Reduzir o limite de tamanho por arquivo de 10 MB para **5 MB**.
- Comprimir imagens no navegador antes do upload (máx. 1600px no lado maior, qualidade 0.8 em JPEG). PDFs sobem sem alteração.
- Aceitar apenas `image/*` e `application/pdf`.

### 2. Retenção automática
Criar um job diário (pg_cron + rota `/api/public/hooks/storage-cleanup`) que apaga:
- **Comprovantes de caixa** (`cash-receipts`) com mais de **1 ano** (baseado em `created_at` do arquivo). Também limpa a referência `receipt_path` da transação correspondente.
- **PDFs/assets de certificados e eventos** com mais de **3 anos**, quando aplicável.

O job registra no console quantos arquivos apagou por execução.

### Detalhes técnicos
- `src/routes/diretor.$slug.tsx`: nova função `compressImage()` antes do `supabase.storage.upload`; ajustar validação de tamanho para 5MB.
- Nova rota `src/routes/api/public/hooks/storage-cleanup.ts` protegida por `apikey` header (anon key), usando `supabaseAdmin` para listar `storage.objects` por bucket e remover os antigos, além de limpar `receipt_path` em `league_cash_entries`.
- Agendar via pg_cron diariamente às 03:00 chamando essa rota.
