/** Regras de senha do design (mesmas da API: mín. 8, 1 número, letra + símbolo). */
export type PwRule = { ok: boolean; label: string };

export function passwordRules(pw: string, confirm?: string): PwRule[] {
  const rules: PwRule[] = [
    { ok: pw.length >= 8, label: 'Mínimo 8 caracteres' },
    { ok: /\d/.test(pw), label: 'Um número' },
    { ok: /[A-Za-z]/.test(pw) && /[^A-Za-z0-9]/.test(pw), label: 'Letra e símbolo' },
  ];
  if (confirm !== undefined) rules.push({ ok: pw.length > 0 && pw === confirm, label: 'As duas senhas iguais' });
  return rules;
}

/** Força 0–4 (perfil): regras básicas + bônus por 12+ caracteres. */
export function passwordScore(pw: string): number {
  return passwordRules(pw).filter((r) => r.ok).length + (pw.length >= 12 ? 1 : 0);
}

/** Força 0–4 do cadastro (design): por tamanho e mistura de letra/número. */
export function signupScore(pw: string): number {
  const n = pw.length;
  if (n === 0) return 0;
  if (n < 6) return 1;
  if (n < 8) return 2;
  return /\d/.test(pw) && /[A-Za-z]/.test(pw) ? 4 : 3;
}

/** Cor da barra por força (índice 1–4) — tokens CSS. */
export const SCORE_COLOR = ['', 'var(--neg)', 'var(--warn)', 'var(--gold)', 'var(--pos)'];
