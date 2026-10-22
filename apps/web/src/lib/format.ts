const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** R$ 1.234,56 — use `hidden` para o modo "Ocultar valores". */
export const money = (v: number, hidden = false) => (hidden ? 'R$ ••••' : brl.format(v).replace(/ /g, ' '));
/** −R$ 5,90 / +R$ 0,01 */
export const signedMoney = (v: number, hidden = false) =>
  hidden ? 'R$ ••••' : `${v < 0 ? '−' : '+'}${money(Math.abs(v))}`;
export const pct = (v: number) => `${Math.round(v * 100)}%`;
/** "2026-10-07" -> "07/10" */
export const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
/** Iniciais de nome de pessoa: primeira + última palavra relevante ("Lucas M. da Rocha" → "LR"). */
export const nameInitials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 2 || /^[A-Z]/.test(w))
    .map((w) => w[0])
    .filter((_, i, a) => i === 0 || i === a.length - 1)
    .join('')
    .toUpperCase();
/** Iniciais de lançamento/estabelecimento (tira prefixos do extrato). */
export const initials = (s: string) =>
  s.replace(/^(PAY|PIX QRS|PIX TRANSF|PIX AUT|PAG BOLETO)\s+/i, '').slice(0, 2).toUpperCase();
