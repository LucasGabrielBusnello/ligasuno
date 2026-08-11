// Tabela de taxas e cálculo de custo total (isomórfico — pode ser usado no cliente).
//
// Custo total = taxa do meio de pagamento (provedor) + taxa da plataforma (Ligasuno/MEDUNO).

export type PayMethod = "pix" | "debit" | "credit";

export type MethodFee = {
  /** Percentual sobre o valor bruto (ex.: 0.99 = 0,99%). */
  percent: number;
  /** Valor fixo em reais por transação. */
  fixed: number;
};

export type ProviderFeeTable = {
  pix: MethodFee;
  debit: MethodFee;
  credit: MethodFee;
};

export const METHOD_LABEL: Record<PayMethod, string> = {
  pix: "Pix",
  debit: "Cartão de débito",
  credit: "Cartão de crédito (à vista)",
};

/**
 * Taxas públicas do Mercado Pago (recebimento imediato / padrão de checkout).
 * Servem como referência — o MP não expõe a tabela da conta por API.
 */
export const MP_FEES: ProviderFeeTable = {
  pix: { percent: 0.99, fixed: 0 },
  debit: { percent: 3.79, fixed: 0 },
  credit: { percent: 4.98, fixed: 0 },
};

/** Taxas de referência do Asaas (usadas só enquanto a conta não estiver conectada). */
export const ASAAS_REFERENCE_FEES: ProviderFeeTable = {
  pix: { percent: 0, fixed: 1.99 },
  debit: { percent: 1.99, fixed: 0.35 },
  credit: { percent: 2.99, fixed: 0.49 },
};

/** Taxas de referência da Efí (Gerencianet) — plano gratuito, recebimento imediato. */
export const EFI_REFERENCE_FEES: ProviderFeeTable = {
  pix: { percent: 0, fixed: 0.6 },
  debit: { percent: 2.79, fixed: 0 },
  credit: { percent: 3.79, fixed: 0.49 },
};


export type PlatformFee = { pct: number; fixed: number };

export type FeeBreakdown = {
  method: PayMethod;
  gross: number;
  providerFee: number;
  platformFee: number;
  totalFee: number;
  totalPercent: number;
  net: number;
};

const round2 = (n: number) => Math.max(0, Math.round(n * 100) / 100);

export function computeBreakdown(
  gross: number,
  method: PayMethod,
  table: ProviderFeeTable,
  platform: PlatformFee,
): FeeBreakdown {
  const m = table[method];
  const providerFee = round2((gross * (m.percent || 0)) / 100 + (m.fixed || 0));
  const platformFee = round2((gross * (platform.pct || 0)) / 100 + (platform.fixed || 0));
  const totalFee = round2(providerFee + platformFee);
  return {
    method,
    gross,
    providerFee,
    platformFee,
    totalFee,
    totalPercent: gross > 0 ? Math.round((totalFee / gross) * 10000) / 100 : 0,
    net: round2(gross - totalFee),
  };
}

export function compareProviders(
  gross: number,
  platform: PlatformFee,
  asaasTable: ProviderFeeTable,
): Record<PayMethod, { mercadopago: FeeBreakdown; asaas: FeeBreakdown }> {
  const methods: PayMethod[] = ["pix", "debit", "credit"];
  const out = {} as Record<PayMethod, { mercadopago: FeeBreakdown; asaas: FeeBreakdown }>;
  for (const m of methods) {
    out[m] = {
      mercadopago: computeBreakdown(gross, m, MP_FEES, platform),
      asaas: computeBreakdown(gross, m, asaasTable, platform),
    };
  }
  return out;
}

export const brl = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
