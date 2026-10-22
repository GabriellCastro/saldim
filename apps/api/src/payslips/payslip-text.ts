import { parseBrNumber } from '../imports/parsers/util';

export interface PayslipItem {
  code?: string;
  label: string;
  amount: number;
  kind: 'provento' | 'desconto';
}
export interface ParsedPayslip {
  month?: string;
  gross?: number;
  net?: number;
  items: PayslipItem[];
}

const MONEY = String.raw`(\d{1,3}(?:\.\d{3})*,\d{2})`;
const MONTHS = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function amountAfter(text: string, label: RegExp): number | undefined {
  const m = text.match(new RegExp(label.source + String.raw`[^\d\n]{0,40}` + MONEY, 'i'));
  return m ? parseBrNumber(m[m.length - 1]) : undefined;
}

/**
 * Leitura "melhor esforço" do texto de um holerite: totais de vencimentos/descontos, líquido,
 * competência e linhas `COD DESCRIÇÃO ... valor`. Quem chama decide o que fazer se faltar algo.
 */
export function parsePayslipText(raw: string): ParsedPayslip {
  const text = fold(raw);
  const gross = amountAfter(text, /total\s+(?:de\s+)?(?:vencimentos|proventos)/);
  const descontos = amountAfter(text, /total\s+(?:de\s+)?descontos/);
  let net = amountAfter(text, /(?:valor\s+)?liquido(?:\s+a\s+receber)?/);
  if (net == null && gross != null && descontos != null) net = Math.round((gross - descontos) * 100) / 100;

  let month: string | undefined;
  const byName = text.match(new RegExp(`(${MONTHS.join('|')})\\s*(?:/|de)?\\s*(\\d{4})`));
  if (byName) month = `${byName[2]}-${String(MONTHS.indexOf(byName[1]) + 1).padStart(2, '0')}`;
  else {
    const num = text.match(/compet[a-z]*\s*:?\s*(\d{2})\/(\d{4})/);
    if (num) month = `${num[2]}-${num[1]}`;
  }

  const items: PayslipItem[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const m = line.trim().match(new RegExp(String.raw`^(\d{3,4})\s+(.+?)\s+(?:\d+(?:[,:]\d+)?\s+)?` + MONEY + '$'));
    if (!m) continue;
    const [, code, label, value] = m;
    const isDesc = /desc|inss|irrf|empr|unimed|contrib|vale|adiant/i.test(fold(label));
    items.push({ code, label: label.trim(), amount: parseBrNumber(value), kind: isDesc ? 'desconto' : 'provento' });
  }
  return { month, gross, net, items };
}
