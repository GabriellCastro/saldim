/** Máscaras de digitação (pt-BR). Só formatação; validação real é na API. */
const digits = (s: string) => s.replace(/\D/g, '');

/** 000.000.000-00 */
export function maskCpfInput(v: string): string {
  const d = digits(v).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
}

/** (00) 00000-0000 */
export function maskPhoneInput(v: string): string {
  const d = digits(v).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** (11) 91234-5678 -> (11) 9••••-5678, como no perfil do design. */
export const hidePhone = (p: string) => p.replace(/(\d{2})\)\s?(\d)\d{4}/, '$1) $2••••');

export const isEmail = (v: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.trim());
