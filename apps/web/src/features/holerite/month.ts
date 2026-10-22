const SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const LONG = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** "2026-09" -> "set/26" */
export const monthShort = (ym: string) => `${SHORT[+ym.slice(5, 7) - 1]}/${ym.slice(2, 4)}`;
/** "2026-09" -> "setembro/26" */
export const monthLong = (ym: string) => `${LONG[+ym.slice(5, 7) - 1]}/${ym.slice(2, 4)}`;
/** "2026-09" + 3 -> "2026-12" */
export const addMonths = (ym: string, n: number) => {
  const t = +ym.slice(0, 4) * 12 + (+ym.slice(5, 7) - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
};
/** Mês corrente "YYYY-MM" (horário local). */
export const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
