/** Tipos das respostas da API usadas pelo shell e pelas telas do painel (ver docs/api.md). */
export type Tx = {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  categoryLabel: string;
  /** imprevisto: tipo (GET /categories/unexpected), rótulo e justificativa */
  unexpected: string | null;
  unexpectedLabel: string | null;
  unexpectedNote: string | null;
};
export type Alert = { tag: string; tone: 'neg' | 'warn' | 'pos'; title: string; body: string };
export type Account = { id: string; bank: string; label: string; balance: number | null; lastSyncAt: string | null };
export type Payslip = { id: string; month: string; gross: number; net: number };
export type Import = {
  id: string;
  kind: string;
  status: string;
  fileName: string;
  count: number;
  periodStart: string | null;
  periodEnd: string | null;
  error: string | null;
};

export type Overview = {
  month: string;
  today: string;
  day: number;
  daysInMonth: number;
  account: { label: string; lastSyncAt: string | null; balance: number | null };
  income: { net: number; gross: number; other: number; total: number };
  fixed: { id: string; label: string; amount: number }[];
  fixedTotal: number;
  /** daily = acumulado por dia, índice 0 = 0; diff = spent - idealToDate */
  variable: { spent: number; limit: number; avg: number; idealToDate: number; diff: number; daily: number[] };
  leftover: number;
  /** variáveis de salário a salário (5º dia útil; sábado → sexta). daily: índice 0 = antes do salário */
  cycle: {
    start: string;
    nextPayday: string;
    day: number;
    days: number;
    daysLeft: number;
    spent: number;
    limit: number;
    remaining: number;
    perDay: number;
    idealToDate: number;
    diff: number;
    daily: number[];
  };
  payslipFreed: number | null;
  netAfterLoans: { month: string; net: number } | null;
  /** texto do card "IA" da visão geral */
  insight: string;
  alertsCount: number;
};

export type ProjMonth = {
  month: string;
  label: string;
  income: number;
  out: number;
  extra: number;
  /** imprevistos do mês (só o atual; já somados em out) */
  unexpected: number;
  /** líquido do holerite no mês e quanto subiu vs mês anterior */
  payslipNet: number;
  freed: number;
  balance: number;
  /** reserva acumulada */
  reserve: number;
};
export type Projection = {
  months: ProjMonth[];
  goal: {
    name: string;
    target: number;
    deadline: string;
    reachedAt: string | null;
    reachedAtPlan: string | null;
    reachedAtNoPlan: string | null;
  } | null;
  plan: boolean;
  /** a outra linha (sem plano se plan=true e vice-versa) */
  alt: { month: string; balance: number; reserve: number }[];
  /** real × plano da IA: mês atual (até hoje, `partial`) e meses fechados anteriores */
  actual: ActualMonth[];
};

/** amount positivo; pctIncome em % (1 casa) */
export type SpendingCat = { id: string; label: string; kind: 'fixo' | 'variavel'; amount: number; pctIncome: number };
export type Spending = { month: string /* YYYY-MM ou 'all' */; months: string[]; total: number; income: number; byCategory: SpendingCat[]; insight: string };

export type BudgetItem = {
  category: string;
  label: string;
  limit: number;
  spent: number;
  avg: number;
  /** contas recorrentes da categoria por mês (piso do plano) */
  committed: number;
  ratio: number;
  status: 'ok' | 'warn' | 'over';
};
export type Budgets = { month: string; day: number; daysInMonth: number; items: BudgetItem[]; totals: { spent: number; limit: number; avg: number } };

export type MoneyMonth = { income: number; out: number; balance: number };
export type ActualMonth = {
  month: string;
  label: string;
  partial: boolean;
  /** balance = sobra = o que tá na conta (entrou − saiu), vai baixando ao longo do mês */
  real: MoneyMonth & { unexpected: number };
  /** plano da IA pro mês inteiro */
  plan: MoneyMonth;
  /** real ÷ plano em % (null = plano zero/negativo) */
  pct: { income: number | null; out: number | null; balance: number | null };
  /** só no mês atual: o guardado × a reserva que a IA espera no fim do mês */
  reserve: { real: number; plan: number; pct: number | null } | null;
  /** só no mês atual: guardado no mês, o que o plano mandava guardar e quanto passou (plan.balance já vem descontado) */
  saving: { month: number; planned: number; extra: number } | null;
};

/** GET /dashboard/month/:month — detalhe de um mês da tabela da Projeção. real = null em mês futuro. */
export type DetailLine = { id: string; label: string; real: number | null; plan: number; noPlan: number };
export type DetailGroup = { lines: DetailLine[]; real: number | null; plan: number; noPlan: number };
export type MonthDetail = {
  month: string;
  label: string;
  kind: 'past' | 'current' | 'future';
  offset: number;
  income: DetailGroup;
  fixed: DetailGroup;
  variable: DetailGroup;
  unexpected: { total: number; items: { date: string; description: string; amount: number; type: string; label: string; note: string | null }[] };
  totals: { real: MoneyMonth | null; plan: MoneyMonth; noPlan: MoneyMonth };
  reserve: { real: number | null; plan: number | null; noPlan: number | null };
  /** só no mês atual: guardado no mês, o que o plano mandava guardar e quanto passou */
  saving: { month: number; planned: number; extra: number } | null;
  events: string[];
  prev: string | null;
  next: string | null;
};
