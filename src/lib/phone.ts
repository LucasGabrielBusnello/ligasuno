// Validação de telefone brasileiro (10 dígitos fixo OU 11 dígitos celular)
export function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

export function isValidBRPhone(value: string) {
  const d = normalizePhone(value);
  // 10 = fixo (DDD + 8), 11 = celular (DDD + 9 + 8)
  if (d.length !== 10 && d.length !== 11) return false;
  const ddd = Number(d.slice(0, 2));
  if (ddd < 11 || ddd > 99) return false;
  if (d.length === 11 && d[2] !== "9") return false; // celular começa com 9
  // rejeita sequências triviais (todos iguais)
  if (/^(\d)\1+$/.test(d.slice(2))) return false;
  return true;
}

export function formatBRPhone(value: string) {
  const d = normalizePhone(value).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
