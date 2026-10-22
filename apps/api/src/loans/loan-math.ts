/** Regras puras de empréstimos (testáveis sem banco). */
export interface LoanLike {
  source: 'FOLHA' | 'CONTA';
  installment: number;
  currentInstallment: number;
  totalInstallments: number;
}

const r2 = (v: number) => Math.round(v * 100) / 100;

/** "YYYY-MM" somado de n meses. */
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
}

export const monthOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

/**
 * Parcelas restantes = total − atual (a atual já foi descontada). Fim = mês corrente + restantes,
 * igual ao design (contrato 10/12 em out/26 → última em dez/26).
 */
export function loanStatus(l: LoanLike, now = new Date()) {
  const remainingInstallments = Math.max(0, l.totalInstallments - l.currentInstallment);
  return {
    remainingInstallments,
    remainingAmount: r2(remainingInstallments * l.installment),
    endMonth: addMonths(monthOf(now), remainingInstallments),
  };
}

/**
 * KPIs da tela de empréstimos.
 * - monthlyFolha: soma das parcelas na folha (como no holerite mais recente).
 * - monthlyConta: parcelas cadastradas como CONTA; sem cadastro, usa `contaFromTx` (média debitada na conta).
 * - endsNext3Months: contratos com até 3 parcelas restantes (inclui o que acabou de terminar).
 */
export function loanKpis(loans: LoanLike[], contaFromTx = 0, now = new Date()) {
  const sum = (src: LoanLike['source']) =>
    r2(loans.filter((l) => l.source === src).reduce((a, l) => a + l.installment, 0));
  const conta = sum('CONTA');
  return {
    monthlyFolha: sum('FOLHA'),
    monthlyConta: conta > 0 ? conta : r2(contaFromTx),
    totalRemaining: r2(loans.reduce((a, l) => a + loanStatus(l, now).remainingAmount, 0)),
    endsNext3Months: loans.filter((l) => loanStatus(l, now).remainingInstallments <= 3).length,
  };
}
