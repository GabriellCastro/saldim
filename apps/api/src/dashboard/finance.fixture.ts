/** Amostra fictícia (extrato Itaú 08/08–07/10/26 + holerite de set/26) para os testes de finance.ts. */
import { readFileSync } from 'fs';
import { join } from 'path';
import { CATEGORIES } from '../categories/categories';
import type { FinInput, FinLoan, FinPayslip, FinTx } from './finance';

const DESIGN = join(__dirname, '..', '..', '..', '..', 'design');

/** Lê `design/extrato-itau.json`; se não existir, extrai o `EXT` do script do design. */
export function loadDesignTxs(): FinTx[] {
  let rows: [string, string, number, string][];
  let year = '2026';
  try {
    const json = JSON.parse(readFileSync(join(DESIGN, 'extrato-itau.json'), 'utf8')) as {
      periodo?: string[];
      tx: [string, string, number, string][];
    };
    rows = json.tx;
    year = json.periodo?.[1]?.slice(-4) ?? year;
  } catch {
    const html = readFileSync(join(DESIGN, 'Controle Financeiro v3.dc.html'), 'utf8');
    const line = /const EXT=(\[.*?\]);\n/.exec(html)![1];
    rows = JSON.parse(line) as [string, string, number, string][];
  }
  return rows.map(([d, description, amount, category]) => ({
    date: `${year}-${d.slice(3, 5)}-${d.slice(0, 2)}`,
    description,
    amount,
    category,
  }));
}

/** Empréstimos consignados da folha (LOANS do design). */
export const DESIGN_LOANS: FinLoan[] = [
  [380, 12, 12],
  [402.5, 10, 12],
  [255.3, 13, 18],
  [140, 10, 18],
  [240.9, 11, 18],
  [248.75, 6, 36],
].map(([installment, currentInstallment, totalInstallments]) => ({
  name: `Crédito Trabalhador ${totalInstallments}x`,
  source: 'FOLHA' as const,
  installment,
  currentInstallment,
  totalInstallments,
}));

export const DESIGN_PAYSLIP: FinPayslip = {
  month: '2026-09',
  gross: 5800.37,
  net: 3000,
  items: [
    { label: 'Salário Base', amount: 5800, kind: 'provento' },
    { label: 'Arredondamento no Mês', amount: 0.37, kind: 'provento' },
    { label: 'Desc. Mensalidade Plano de Saúde', amount: 1, kind: 'desconto' },
    { label: 'INSS Folha', amount: 640.2, kind: 'desconto' },
    { label: 'IRRF Folha', amount: 491.3, kind: 'desconto' },
    ...DESIGN_LOANS.map((l) => ({
      label: `Desc. Empréstimo (Crédito Trabalhador) Parc. ${l.currentInstallment}/${l.totalInstallments}`,
      amount: l.installment,
      kind: 'desconto' as const,
    })),
    { label: 'Desc Arredondamento Mês Anterior', amount: 0.42, kind: 'desconto' },
  ],
};

/** Limites do design (os padrões do catálogo, como se o usuário tivesse salvo). */
export const DESIGN_LIMITS: Record<string, number> = Object.fromEntries(
  CATEGORIES.filter((c) => c.defaultLimit != null).map((c) => [c.id, c.defaultLimit!]),
);

export function designInput(over: Partial<FinInput> = {}): FinInput {
  const txs = loadDesignTxs();
  return {
    today: '2026-10-07',
    txs,
    loans: DESIGN_LOANS,
    limits: DESIGN_LIMITS,
    payslip: DESIGN_PAYSLIP,
    netIncome: null,
    grossIncome: null,
    otherIncome: null,
    goal: { name: 'Reserva de R$ 10 mil', target: 10000, deadline: '2027-12-31' },
    ...over,
  };
}
