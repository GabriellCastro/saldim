import { ParsedStatement, StatementParseError } from './types';
import { parseBrNumber, parseDate, periodOf } from './util';

/** CSV `data;descrição;valor` (pt-BR). Aceita cabeçalho, `;` ou tab, aspas simples. */
export function parseCsvStatement(text: string): ParsedStatement {
  const year = new Date().getFullYear();
  const rows = text
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => line.split(/[;\t]/).map((c) => c.trim().replace(/^"(.*)"$/, '$1')))
    .filter((cols) => cols.length >= 3 && /^\d{1,4}[/-]\d{1,2}/.test(cols[0]))
    .filter((cols) => !/^SALDO/i.test(cols[1]))
    .map((cols) => ({
      date: parseDate(cols[0], year),
      description: cols[1],
      amount: parseBrNumber(cols[2]),
    }));
  if (!rows.length) throw new StatementParseError('CSV sem lançamentos (esperado: data;descrição;valor)');
  return { rows, ...periodOf(rows) };
}
