/** Rótulos de data/mês em pt-BR (só formatação; nenhuma regra de negócio). */
const SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const LONG = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const WEEK = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

const parts = (ym: string) => ({ y: +ym.slice(0, 4), m: +ym.slice(5, 7) });

/** "2026-10" ou "2026-10-07" -> "out/26" */
export const monthShort = (ym: string) => {
  const { y, m } = parts(ym);
  return `${SHORT[m - 1]}/${String(y % 100).padStart(2, '0')}`;
};
/** "2026-10" -> "outubro" */
export const monthLong = (ym: string) => LONG[parts(ym).m - 1];
/** "2026-10" -> "out" */
export const monthAbbr = (ym: string) => SHORT[parts(ym).m - 1];
/** "2026-10" -> "2026-09" */
export const prevMonth = (ym: string) => {
  const { y, m } = parts(ym);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
};
/** "2026-10-07" -> "quarta, 7 de outubro" */
export const longDate = (iso: string) => {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  return `${WEEK[d.getDay()]}, ${d.getDate()} de ${LONG[d.getMonth()]}`;
};
/** ISO datetime -> "14:30" (vazio se não houver hora) */
export const hhmm = (iso: string) => {
  if (!iso.includes('T')) return '';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
/** ISO -> "07/10" usando o fuso local quando houver hora */
export const dayMonth = (iso: string) => {
  if (!iso.includes('T')) return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
};
/** "2026-10-07" -> "7 de outubro" */
export const dayMonthLong = (iso: string) => `${+iso.slice(8, 10)} de ${LONG[+iso.slice(5, 7) - 1]}`;
export const greeting = (h = new Date().getHours()) => (h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite');
export const firstName = (name?: string) => (name ?? '').trim().split(/\s+/)[0] ?? '';
/** "2026-12" -> "2027-01" */
export const nextMonth = (ym: string) => {
  const { y, m } = parts(ym);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
};
