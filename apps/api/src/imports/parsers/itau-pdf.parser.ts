import pdfParse from 'pdf-parse';
import { ParsedStatement, StatementParseError } from './types';
import { parseBrNumber, parseDate, periodOf } from './util';

const MONEY = String.raw`-?\s?[\d.]+,\d{2}-?`;
/** dd/mm[/yyyy] DESCRIÇÃO valor [saldo] — o pdf-parse às vezes cola as colunas sem espaço. */
const LINE = new RegExp(String.raw`^(\d{2}\/\d{2}(?:\/\d{2,4})?)\s*(.+?)\s*(${MONEY})(?:\s+(${MONEY}))?\s*$`);
const SALDO = /\bSALDO\b|\bSDO\b/i;
/** Valor pt-BR bem formado (milhar com ponto, sem zero à esquerda). */
const STRICT_MONEY = String.raw`-?\s?(?:0|[1-9]\d{0,2}(?:\.\d{3})*),\d{2}-?`;
/**
 * Descrição que termina em dd/mm (ex.: "PIX TRANSF Lucas27/09"): o pdf-parse cola esse "09" no valor
 * ("27/09370,00"). Tentada antes da LINE genérica para o dd/mm ficar na descrição e não virar dígito do valor.
 */
const LINE_DATED_DESC = new RegExp(
  String.raw`^(\d{2}\/\d{2}(?:\/\d{2,4})?)\s*(.*?(?:0[1-9]|[12]\d|3[01])\/(?:0[1-9]|1[0-2]))\s*(${STRICT_MONEY})(?:\s+(${MONEY}))?\s*$`,
);

/** Extrai lançamentos do texto de um extrato Itaú (linhas de saldo são ignoradas). */
export function parseItauText(text: string): ParsedStatement {
  const years = [...text.matchAll(/\d{2}\/\d{2}\/(\d{4})/g)].map((m) => Number(m[1]));
  const refYear = years.length ? Math.max(...years) : new Date().getFullYear();
  const agencia = text.match(/ag(?:[êe]ncia|\.)?\s*:?\s*(\d{4})/i)?.[1];

  const rows: ParsedStatement['rows'] = [];
  let balance: { date: string; value: number } | undefined;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+/g, ' ').trim();
    const m = line.match(LINE_DATED_DESC) ?? line.match(LINE);
    if (!m) continue;
    const [, d, desc, v1, v2] = m;
    let date: string;
    try {
      date = parseDate(d, refYear);
    } catch {
      continue;
    }
    if (SALDO.test(desc)) {
      const value = parseBrNumber(v2 ?? v1);
      if (!balance || date >= balance.date) balance = { date, value };
      continue;
    }
    rows.push({ date, description: desc.trim(), amount: parseBrNumber(v1) });
  }
  if (!rows.length) throw new StatementParseError('Não achei lançamentos no PDF (esperado extrato Itaú)');
  return {
    rows,
    ...periodOf(rows),
    balance: balance?.value,
    accountLabel: agencia ? `Itaú · ag. ${agencia}` : undefined,
  };
}

export async function parseItauPdf(buf: Buffer): Promise<ParsedStatement> {
  let text: string;
  try {
    text = (await pdfParse(buf)).text;
  } catch {
    throw new StatementParseError('Não consegui ler o PDF');
  }
  return parseItauText(text);
}
