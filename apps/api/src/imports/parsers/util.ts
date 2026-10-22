import { StatementParseError } from './types';

/** "1.234,56" | "-1.234,56" | "1.234,56-" | "- 12,00" | "-1234.56" → number */
export function parseBrNumber(raw: string): number {
  let s = raw.trim().replace(/\s+/g, '').replace(/^R\$/i, '');
  let neg = false;
  if (s.endsWith('-')) {
    neg = true;
    s = s.slice(0, -1);
  }
  if (s.startsWith('-') || s.startsWith('−')) {
    neg = true;
    s = s.slice(1);
  } else if (s.startsWith('+')) s = s.slice(1);
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  if (!Number.isFinite(n) || s === '') throw new StatementParseError(`Valor inválido: "${raw}"`);
  return Math.round((neg ? -n : n) * 100) / 100;
}

const pad = (n: number | string) => String(n).padStart(2, '0');

/**
 * "dd/mm/yyyy" | "dd/mm/yy" | "dd/mm" | "yyyy-mm-dd" → "yyyy-mm-dd".
 * Sem ano, usa `refYear`; se o mês passar de `refMonth` (virada de ano), usa o ano anterior.
 */
export function parseDate(raw: string, refYear: number, refMonth = 12): string {
  const s = raw.trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (!m) throw new StatementParseError(`Data inválida: "${raw}"`);
  const [, d, mo, y] = m;
  let year: number;
  if (y) year = y.length === 2 ? 2000 + Number(y) : Number(y);
  else year = Number(mo) > refMonth ? refYear - 1 : refYear;
  const iso = `${year}-${pad(mo)}-${pad(d)}`;
  if (Number.isNaN(Date.parse(iso))) throw new StatementParseError(`Data inválida: "${raw}"`);
  return iso;
}

export function periodOf(rows: { date: string }[]): { periodStart?: string; periodEnd?: string } {
  if (!rows.length) return {};
  const dates = rows.map((r) => r.date).sort();
  return { periodStart: dates[0], periodEnd: dates[dates.length - 1] };
}
