import { money, signedMoney } from '@/lib/format';

/** 10000 -> "R$ 10 mil" (rótulo da meta). */
export const moneyShort = (v: number) =>
  Math.abs(v) >= 1000 ? `R$ ${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : money(v);
/** 1234 -> "+1,2k" / -800 -> "−0,8k" */
export const signedK = (v: number, hidden = false) =>
  hidden ? '•••' : `${v < 0 ? '−' : '+'}${(Math.abs(v) / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k`;
/** sobra/saldo com sinal (+R$ / −R$) */
export const saldo = (v: number, hidden = false) => signedMoney(v, hidden);
export const tone = (v: number) => (v < 0 ? 'var(--neg)' : 'var(--pos)');
export const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
