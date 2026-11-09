const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** Converte o texto digitado em centavos (apenas dígitos). */
export function digitsToCents(raw: string): number {
  const digits = raw.replace(/\D/g, "").replace(/^0+/, "");
  if (!digits) return 0;
  const cents = Number(digits.slice(0, 12));
  return Number.isSafeInteger(cents) ? cents : 0;
}

/** Máscara de moeda: "123456" -> "R$ 1.234,56". Vazio quando não há valor. */
export function maskCurrency(raw: string): string {
  const cents = digitsToCents(raw);
  return cents === 0 ? "" : BRL.format(cents / 100);
}

export function formatCurrency(value: number): string {
  return BRL.format(value);
}

/** Máscara de telefone brasileiro: (85) 99999-9999 ou (85) 3333-3333. */
export function maskPhone(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function maskCNPJ(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  }
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

export function isValidCNPJ(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 14) return false;

  if (/^(\d)\1{13}$/.test(digits)) return false;

  let sum = 0;
  let weight = 5;
  for (let index = 0; index < 12; index += 1) {
    sum += Number(digits[index]) * weight;
    weight = weight === 2 ? 9 : weight - 1;
  }
  let digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  if (digit !== Number(digits[12])) return false;

  sum = 0;
  weight = 6;
  for (let index = 0; index < 13; index += 1) {
    sum += Number(digits[index]) * weight;
    weight = weight === 2 ? 9 : weight - 1;
  }
  digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  return digit === Number(digits[13]);
}
