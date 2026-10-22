/** Resultado normalizado de qualquer parser de extrato. Datas em ISO `YYYY-MM-DD`. */
export interface ParsedRow {
  date: string;
  description: string;
  amount: number;
  /** categoria já vinda do arquivo (ex.: JSON de exemplo); senão o categorizador decide */
  category?: string;
}

export interface ParsedStatement {
  accountLabel?: string;
  periodStart?: string;
  periodEnd?: string;
  /** saldo atual da conta, quando o arquivo informa */
  balance?: number;
  rows: ParsedRow[];
}

export class StatementParseError extends Error {}
