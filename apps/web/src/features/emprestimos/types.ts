export type LoanSource = 'FOLHA' | 'CONTA';

export type Loan = {
  id: string;
  name: string;
  source: LoanSource;
  installment: number;
  currentInstallment: number;
  totalInstallments: number;
  remainingInstallments: number;
  remainingAmount: number;
  endMonth: string; // YYYY-MM
};

export type LoansResponse = {
  items: Loan[];
  kpis: { monthlyFolha: number; monthlyConta: number; totalRemaining: number; endsNext3Months: number };
};

export type LoanInput = Pick<Loan, 'name' | 'source' | 'installment' | 'currentInstallment' | 'totalInstallments'>;

/** Subconjunto de /dashboard/overview e /dashboard/projection usado na reserva mínima. */
export type OverviewLite = { fixed: { label: string; amount: number }[]; fixedTotal: number };
export type ProjectionLite = {
  /** `reserve` (acumulado) vem da API além do contrato; se faltar, somamos `balance`. */
  months: { month: string; label: string; income: number; out: number; extra: number; balance: number; reserve?: number }[];
  plan: boolean;
};
