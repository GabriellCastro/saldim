/** Regras puras de cadastro (CPF e senha) — usadas por auth e users, testadas em rules.spec.ts. */

/** Só os dígitos do CPF. */
export const cpfDigits = (cpf: string): string => (cpf ?? '').replace(/\D/g, '');

/** Valida CPF pelos dígitos verificadores (aceita com ou sem máscara). */
export function isValidCpf(cpf: string): boolean {
  const d = cpfDigits(cpf);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const check = (len: number): number => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return check(9) === Number(d[9]) && check(10) === Number(d[10]);
}

/** CPF mascarado como no design: •••.482.310-•• */
export function maskCpf(cpf: string): string {
  const d = cpfDigits(cpf);
  if (d.length !== 11) return '•••.•••.•••-••';
  return `•••.${d.slice(3, 6)}.${d.slice(6, 9)}-••`;
}

/** Regras da senha (mesmos textos do design). Retorna as que falharam; vazio = ok. */
export function passwordProblems(pw: string): string[] {
  const p = pw ?? '';
  const problems: string[] = [];
  if (p.length < 8) problems.push('Mínimo 8 caracteres');
  if (!/\d/.test(p)) problems.push('Um número');
  if (!(/[A-Za-z]/.test(p) && /[^A-Za-z0-9]/.test(p))) problems.push('Letra e símbolo');
  return problems;
}

export const isValidPassword = (pw: string): boolean => passwordProblems(pw).length === 0;

/** Mensagem pt-BR para a senha fraca, ou null se ok. */
export function passwordError(pw: string): string | null {
  const problems = passwordProblems(pw);
  return problems.length ? `Senha fraca: falta ${problems.join(', ').toLowerCase()}.` : null;
}
