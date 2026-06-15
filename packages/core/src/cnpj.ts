// CNPJ (Cadastro Nacional da Pessoa Jurídica) — the Brazilian company tax ID.
// Pure helpers shared by the company registry (T6), spreadsheet onboarding (T8)
// and the NF-e parser (T19). No IO. Storage keeps the normalized 14-digit form;
// formatting is for display only.

const CNPJ_LENGTH = 14;

/** Strip everything but digits — masked or raw input becomes the canonical form. */
export function normalizeCnpj(input: string): string {
  return input.replace(/\D/g, '');
}

/** Display a CNPJ as XX.XXX.XXX/XXXX-XX. Returns the digits unchanged if not 14 long. */
export function formatCnpj(input: string): string {
  const digits = normalizeCnpj(input);
  if (digits.length !== CNPJ_LENGTH) return digits;
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

// One check digit over a base string: weights cycle 2..9 from the rightmost digit
// leftward (the modulo-11 scheme used for both CNPJ verification digits).
function checkDigit(base: string): number {
  let sum = 0;
  let weight = 2;
  for (let i = base.length - 1; i >= 0; i--) {
    sum += Number(base[i]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const mod = sum % 11;
  return mod < 2 ? 0 : 11 - mod;
}

/** Validate a CNPJ by length + both check digits. Masked input is accepted. */
export function isValidCnpj(input: string): boolean {
  const digits = normalizeCnpj(input);
  if (digits.length !== CNPJ_LENGTH) return false;
  // Repeated-digit strings (00000000000000, 11111111111111…) pass the check-digit
  // math but are never real registrations — reject them explicitly.
  if (/^(\d)\1{13}$/.test(digits)) return false;
  const d1 = checkDigit(digits.slice(0, 12));
  const d2 = checkDigit(digits.slice(0, 13));
  return d1 === Number(digits[12]) && d2 === Number(digits[13]);
}
