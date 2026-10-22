import { ParsedStatement, StatementParseError } from './types';
import { periodOf } from './util';

const tag = (block: string, name: string): string | undefined =>
  block.match(new RegExp(`<${name}>\\s*([^<\\r\\n]+)`, 'i'))?.[1]?.trim();

const ofxDate = (v: string): string => `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;

/** OFX (SGML ou XML): lê cada <STMTTRN>, saldo em <LEDGERBAL><BALAMT>. */
export function parseOfxStatement(text: string): ParsedStatement {
  const blocks = text.split(/<STMTTRN>/i).slice(1);
  const rows = blocks.map((b) => {
    const dt = tag(b, 'DTPOSTED');
    const amt = tag(b, 'TRNAMT');
    if (!dt || !amt) throw new StatementParseError('STMTTRN sem DTPOSTED/TRNAMT');
    return {
      date: ofxDate(dt),
      description: (tag(b, 'MEMO') ?? tag(b, 'NAME') ?? '').replace(/\s+/g, ' '),
      amount: Math.round(Number(amt.replace(',', '.')) * 100) / 100,
    };
  });
  if (!rows.length) throw new StatementParseError('OFX sem lançamentos');

  const start = tag(text, 'DTSTART');
  const end = tag(text, 'DTEND');
  const ledger = text.match(/<LEDGERBAL>[\s\S]*?<BALAMT>\s*([-\d.,]+)/i)?.[1];
  return {
    rows,
    ...periodOf(rows),
    ...(start ? { periodStart: ofxDate(start) } : {}),
    ...(end ? { periodEnd: ofxDate(end) } : {}),
    balance: ledger ? Math.round(Number(ledger.replace(',', '.')) * 100) / 100 : undefined,
    accountLabel: undefined,
  };
}
