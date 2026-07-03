// Helper isomórfico para extrair todas as taxas debitadas do vendedor (liga)
// em um pagamento do Mercado Pago. Considera taxa de processamento do MP
// + marketplace_fee (nossa taxa da plataforma).
//
// Estrutura típica em payment.fee_details:
//   [
//     { type: "mercadopago_fee", amount: 0.99, fee_payer: "collector" },
//     { type: "application_fee",  amount: 0.50, fee_payer: "collector" },
//   ]
export function getCollectorFees(raw: any): number {
  if (!raw) return 0;
  const details = Array.isArray(raw?.fee_details) ? raw.fee_details : [];
  let total = 0;
  for (const f of details) {
    const payer = String(f?.fee_payer ?? "collector").toLowerCase();
    if (payer === "collector" || payer === "seller") {
      total += Number(f?.amount) || 0;
    }
  }
  // Fallbacks para payloads mais antigos ou reduzidos
  if (total === 0 && Number(raw?.application_fee) > 0) {
    total = Number(raw.application_fee);
  }
  return total;
}

// Valor líquido em CENTAVOS recebido pela liga no pagamento.
// Aceita "gross_amount" (transaction_amount) e um objeto com raw ou fee_amount.
export function netCentsFromTxn(t: { gross_amount: number | string; fee_amount?: number | string | null; raw?: any }): number {
  const gross = Number(t.gross_amount) || 0;
  const feeFromRaw = getCollectorFees(t.raw);
  const fee = feeFromRaw > 0 ? feeFromRaw : Number(t.fee_amount ?? 0) || 0;
  return Math.max(0, Math.round((gross - fee) * 100));
}
