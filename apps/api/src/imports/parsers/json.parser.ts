import { CATEGORY_BY_ID } from '../../categories/categories';
import { ParsedStatement, StatementParseError } from './types';
import { parseDate } from './util';

/** Formato de `design/extrato-itau.json` (tx = [dd/mm, descrição, valor, categoria?]). */
export interface ExtratoJson {
  arquivo?: string;
  conta?: string;
  periodo?: [string, string];
  saldoAtual?: number;
  saldos?: unknown;
  tx: [string, string, number, string?][];
}

export function parseJsonStatement(text: string): ParsedStatement {
  let data: ExtratoJson;
  try {
    data = JSON.parse(text) as ExtratoJson;
  } catch {
    throw new StatementParseError('JSON inválido');
  }
  if (!data || !Array.isArray(data.tx)) throw new StatementParseError('JSON sem a lista "tx"');

  const start = data.periodo?.[0] ? parseDate(data.periodo[0], new Date().getFullYear()) : undefined;
  const end = data.periodo?.[1] ? parseDate(data.periodo[1], new Date().getFullYear()) : undefined;
  const refYear = end ? Number(end.slice(0, 4)) : new Date().getFullYear();
  const refMonth = end ? Number(end.slice(5, 7)) : 12;

  const rows = data.tx.map((t, i) => {
    if (!Array.isArray(t) || t.length < 3) throw new StatementParseError(`Linha ${i + 1} inválida`);
    const [date, description, amount, category] = t;
    if (typeof amount !== 'number' || typeof description !== 'string')
      throw new StatementParseError(`Linha ${i + 1} inválida`);
    return {
      date: parseDate(String(date), refYear, refMonth),
      description: description.trim(),
      amount: Math.round(amount * 100) / 100,
      category: category && CATEGORY_BY_ID.has(category) ? category : undefined,
    };
  });

  return {
    accountLabel: data.conta,
    periodStart: start,
    periodEnd: end,
    balance: typeof data.saldoAtual === 'number' ? data.saldoAtual : undefined,
    rows,
  };
}
