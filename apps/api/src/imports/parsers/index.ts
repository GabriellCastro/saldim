import { parseCsvStatement } from './csv.parser';
import { parseItauPdf } from './itau-pdf.parser';
import { parseJsonStatement } from './json.parser';
import { parseOfxStatement } from './ofx.parser';
import type { ParsedStatement } from './types';

export * from './types';
export { parseCsvStatement, parseItauPdf, parseJsonStatement, parseOfxStatement };
export { parseItauText } from './itau-pdf.parser';

export type StatementFormat = 'pdf' | 'ofx' | 'json' | 'csv';

/** Detecta o formato pelo conteúdo (e extensão como desempate). */
export function detectFormat(buf: Buffer, fileName = ''): StatementFormat {
  const head = buf.subarray(0, 512).toString('utf8').replace(/^﻿/, '').trimStart();
  if (head.startsWith('%PDF')) return 'pdf';
  if (/OFXHEADER|<OFX>/i.test(head) || /\.ofx$/i.test(fileName)) return 'ofx';
  if (head.startsWith('{') || /\.json$/i.test(fileName)) return 'json';
  return 'csv';
}

export async function parseStatement(buf: Buffer, fileName = ''): Promise<ParsedStatement> {
  const fmt = detectFormat(buf, fileName);
  if (fmt === 'pdf') return parseItauPdf(buf);
  const text = buf.toString('utf8');
  if (fmt === 'ofx') return parseOfxStatement(text);
  if (fmt === 'json') return parseJsonStatement(text);
  return parseCsvStatement(text);
}
