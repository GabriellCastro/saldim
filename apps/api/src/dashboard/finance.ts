/**
 * Cálculos do painel (porte das contas do design `Controle Financeiro v3.dc.html`).
 * Funções PURAS: recebem dados simples (lançamentos, empréstimos, limites, holerite, renda)
 * e nunca usam valores fixos de exemplo — tudo sai dos dados do usuário.
 *
 * Datas são strings ISO `YYYY-MM-DD`; meses `YYYY-MM`. Saídas negativas, entradas positivas.
 */
import { CATEGORIES, CATEGORY_BY_ID, VARIABLE_IDS } from '../categories/categories';
import { UNEXPECTED_BY_ID } from '../categories/unexpected';

// ───────────────────────── tipos de entrada ─────────────────────────
export interface FinTx {
  date: string; // YYYY-MM-DD
  description: string;
  amount: number;
  category: string;
  /** imprevisto marcado pelo usuário (tipo de `unexpected.ts`) + justificativa */
  unexpected?: string | null;
  unexpectedNote?: string | null;
}
export interface FinLoan {
  name: string;
  source: 'FOLHA' | 'CONTA';
  installment: number;
  currentInstallment: number;
  totalInstallments: number;
}
export interface FinPayslipItem {
  label: string;
  amount: number;
  kind: 'provento' | 'desconto';
}
export interface FinPayslip {
  month: string;
  gross: number;
  net: number;
  items: FinPayslipItem[];
}
export interface FinGoal {
  id?: string;
  name: string;
  target: number;
  /** prazo antigo (opcional, não entra no cálculo) */
  deadline?: string | null;
}
export interface FinInput {
  today: string;
  txs: FinTx[];
  loans: FinLoan[];
  /** limites salvos pelo usuário (categoria → valor); faltando, usa `defaultLimit` */
  limits: Record<string, number>;
  payslip: FinPayslip | null;
  netIncome: number | null;
  grossIncome: number | null;
  otherIncome: number | null;
  goal?: FinGoal | null;
  /** guardado de agora: base informada + caixinha lançada depois (ver `savedTotal`) */
  saved?: number;
  /** quando o usuário informou a base do guardado */
  savedAt?: string | null;
  /** saldo atual das contas (soma do que veio do banco/extrato); null = o banco não informou */
  balance?: number | null;
}

// ───────────────────────── utilidades ─────────────────────────
export const r2 = (v: number): number => Math.round((v + Number.EPSILON) * 100) / 100;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

const MONTH_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const MONTH_LONG = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

export const monthOf = (date: string) => date.slice(0, 7);
export const dayOf = (date: string) => Number(date.slice(8, 10));
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
}
export function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
/** `2026-10` → `out/26` */
export const monthLabel = (month: string) => `${MONTH_SHORT[Number(month.slice(5, 7)) - 1]}/${month.slice(2, 4)}`;
/** `2026-10` → `outubro` */
export const monthLongName = (month: string) => MONTH_LONG[Number(month.slice(5, 7)) - 1];
/** `2026-08-25` → `25/08` */
export const ddmm = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`;
/** Diferença em meses entre dois `YYYY-MM` (b - a). */
export const monthDiff = (a: string, b: string) => {
  const [ya, ma] = a.split('-').map(Number);
  const [yb, mb] = b.split('-').map(Number);
  return yb * 12 + mb - (ya * 12 + ma);
};

/** `R$ 1.234,56` / `−R$ 12,00` (mesmo formato do design). */
export function brl(v: number): string {
  const abs = Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (v < 0 ? '−' : '') + 'R$ ' + abs;
}

/** "Hoje" do painel: `override` ou a data do lançamento mais recente (fallback: data real). */
export function resolveToday(txs: { date: string }[], override?: string, now = new Date()): string {
  if (override) return override;
  let latest = '';
  for (const t of txs) if (t.date > latest) latest = t.date;
  return latest || now.toISOString().slice(0, 10);
}

/**
 * Imprevisto: gasto pontual. Fica fora das estimativas (fixos, médias, limites, recorrentes, ritmo)
 * e entra uma vez só na projeção, no mês em que aconteceu (`unexpectedIn`).
 */
export const isUnexpected = (t: FinTx) => !!t.unexpected && t.amount < 0;

/** Soma (com sinal) de uma categoria num mês, opcionalmente até o dia `dmax`. Imprevistos ficam fora. */
export function sumBy(txs: FinTx[], category: string, month: string, dmax?: number): number {
  let s = 0;
  for (const t of txs) {
    if (t.category !== category || monthOf(t.date) !== month || isUnexpected(t)) continue;
    if (dmax && dayOf(t.date) > dmax) continue;
    s += t.amount;
  }
  return s;
}

/** Lançamentos de um mês até o dia `today` (inclusive). */
// internos (transferência própria, caixinha/investimento) não são gasto
const isSpending = (t: FinTx) => t.amount < 0 && CATEGORY_BY_ID.get(t.category)?.kind !== 'interno';
const kindOf = (cat: string) => CATEGORY_BY_ID.get(cat)?.kind;

// ───────────────────────── renda ─────────────────────────
export interface Income {
  net: number;
  gross: number;
  other: number;
  total: number;
}

/**
 * Renda de outra conta própria (design: OUTRA = média das transferências grandes "propria" de cada mês).
 * Por mês pega o maior crédito "propria"; considera só meses em que ele passa de 20% do líquido.
 */
export function deriveOtherIncome(txs: FinTx[], net: number): number {
  const maxByMonth = new Map<string, number>();
  for (const t of txs) {
    if (t.category !== 'propria' || t.amount <= 0) continue;
    const m = monthOf(t.date);
    maxByMonth.set(m, Math.max(maxByMonth.get(m) ?? 0, t.amount));
  }
  const vals = [...maxByMonth.values()].filter((v) => v >= Math.max(1, net * 0.2));
  return vals.length ? r2(sum(vals) / vals.length) : 0;
}

export function incomeOf(input: FinInput, countOther = true): Income {
  const lastSalary = [...input.txs]
    .filter((t) => t.category === 'salario' && t.amount > 0)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  const net = r2(input.netIncome ?? input.payslip?.net ?? lastSalary?.amount ?? 0);
  const gross = r2(input.grossIncome ?? input.payslip?.gross ?? net);
  const otherRaw = input.otherIncome ?? deriveOtherIncome(input.txs, net);
  const other = countOther ? r2(otherRaw) : 0;
  return { net, gross, other, total: r2(net + other) };
}

// ───────────────────────── fixos ─────────────────────────
/**
 * Como estimar cada custo fixo por mês (espelha o design):
 *  - `avgClosed`: média dos 2 últimos meses fechados com valor (aluguel, moto, celular, tarifas);
 *  - `lastClosed`: último mês fechado (contas da casa: cada mês tem boletos diferentes);
 *  - `avgRecent`: média dos 2 últimos meses com débito, incluindo o atual (empréstimos na conta,
 *    porque os contratos são recentes e já foram todos debitados no início do mês).
 * Itens abaixo de `MIN_FIXED` (ex.: tarifas de centavos) não entram na lista.
 */
export const FIXED_RULE: Record<string, 'avgClosed' | 'lastClosed' | 'avgRecent'> = {
  contas: 'lastClosed',
  emprestimo: 'avgRecent',
};
export const MIN_FIXED = 10;
export const FIXED_IDS = CATEGORIES.filter((c) => c.kind === 'fixo').map((c) => c.id);

export interface FixedItem {
  id: string;
  label: string;
  amount: number;
}

export function fixedCosts(txs: FinTx[], today: string): FixedItem[] {
  const cur = monthOf(today);
  const months = [...new Set(txs.map((t) => monthOf(t.date)))].filter((m) => m <= cur).sort().reverse();
  const items: FixedItem[] = [];
  for (const id of FIXED_IDS) {
    const rule = FIXED_RULE[id] ?? 'avgClosed';
    const pool = rule === 'avgRecent' ? months : months.filter((m) => m < cur);
    const vals = pool.map((m) => -sumBy(txs, id, m)).filter((v) => v > 0);
    const picked = rule === 'lastClosed' ? vals.slice(0, 1) : vals.slice(0, 2);
    const amount = picked.length ? r2(sum(picked) / picked.length) : 0;
    if (amount >= MIN_FIXED) items.push({ id, label: CATEGORY_BY_ID.get(id)!.label, amount });
  }
  return items;
}

// ───────────────────────── recorrentes ─────────────────────────
/**
 * Contas que se repetem todo mês dentro de categorias variáveis (faculdade, academia, assinatura,
 * boleto que o categorizador não conhece, Pix mensal pra mesma pessoa…). Pro plano elas são fixas:
 * o limite nunca fica abaixo delas.
 * Regra: mesmo estabelecimento em pelo menos 2 dos 3 últimos meses (até 2 lançamentos por mês, senão é
 * hábito e não conta), valores parecidos; o valor é a média mensal dos 2 meses mais recentes com débito.
 */
export interface RecurringItem {
  category: string;
  name: string;
  amount: number;
}
/** Hábitos, não contas: nunca viram recorrentes. */
const NOT_RECURRING = new Set(['lanches', 'delivery', 'restaurantes']);
const RECURRING_MAX_PER_MONTH = 2;
const RECURRING_MIN_RATIO = 0.6;

const merchantKey = (d: string) =>
  cleanName(d.toUpperCase())
    .replace(/[^A-Z ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .join(' ');

export function recurringCharges(txs: FinTx[], today: string): RecurringItem[] {
  const cur = monthOf(today);
  const pool = [cur, addMonths(cur, -1), addMonths(cur, -2)];
  // categoria|estabelecimento → mês → [qtd, total]
  const groups = new Map<string, { category: string; names: string[]; months: Map<string, [number, number]> }>();
  for (const t of txs) {
    const m = monthOf(t.date);
    if (t.amount >= 0 || t.date > today || !pool.includes(m) || isUnexpected(t)) continue;
    if (kindOf(t.category) !== 'variavel' || NOT_RECURRING.has(t.category)) continue;
    const key = merchantKey(t.description);
    if (!key) continue;
    const id = `${t.category}|${key}`;
    const g = groups.get(id) ?? { category: t.category, names: [] as string[], months: new Map<string, [number, number]>() };
    const [n, total] = g.months.get(m) ?? [0, 0];
    g.months.set(m, [n + 1, total - t.amount]);
    g.names.push(cleanName(t.description).replace(/[\d/.-]+/g, ' ').replace(/\s+/g, ' ').trim());
    groups.set(id, g);
  }
  const out: RecurringItem[] = [];
  for (const g of groups.values()) {
    const ms = [...g.months.entries()];
    if (ms.length < 2 || ms.some(([, [n]]) => n > RECURRING_MAX_PER_MONTH)) continue;
    const totals = ms.map(([, [, v]]) => v);
    if (Math.min(...totals) / Math.max(...totals) < RECURRING_MIN_RATIO) continue;
    const recent = ms.sort((a, b) => b[0].localeCompare(a[0])).slice(0, 2).map(([, [, v]]) => v);
    const amount = r2(sum(recent) / recent.length);
    if (amount < MIN_FIXED) continue;
    const name = g.names.reduce((a, b) => (b.length > a.length ? b : a), '');
    out.push({ category: g.category, name: prettyName(name), amount });
  }
  return out.sort((a, b) => b.amount - a.amount);
}

// ───────────────────────── variáveis / limites ─────────────────────────
export interface BudgetItem {
  category: string;
  label: string;
  limit: number;
  spent: number;
  avg: number;
  /** contas recorrentes da categoria por mês: o plano não corta abaixo disso */
  committed: number;
  ratio: number;
  status: 'ok' | 'warn' | 'over';
}

/**
 * Limite sugerido quando o usuário não salvou um: o padrão do catálogo, mas sem cortar mais de
 * `MAX_SUGGESTED_CUT` da média de uma vez (corte gradual; o usuário aperta depois se quiser).
 */
export const MAX_SUGGESTED_CUT = 0.2;
export function limitOf(limits: Record<string, number>, id: string, avg = 0): number {
  if (limits[id] != null) return limits[id];
  const def = CATEGORY_BY_ID.get(id)?.defaultLimit ?? 0;
  return Math.max(def, Math.ceil((avg * (1 - MAX_SUGGESTED_CUT)) / 10) * 10);
}

/** Quanto o plano deixa gastar na categoria: o limite, mas nunca menos que as contas recorrentes. */
export const planLimit = (b: Pick<BudgetItem, 'limit' | 'committed'>) => Math.max(b.limit, b.committed);

/** Status do design: estourou > limite; atenção se a fração gasta passa do ritmo do mês + 15pp. */
export function budgetStatus(spent: number, limit: number, day: number, days: number): BudgetItem['status'] {
  if (spent > limit) return 'over';
  const r = limit ? spent / limit : 0;
  return r > day / days + 0.15 ? 'warn' : 'ok';
}

/** Limites dos variáveis: `avg` = mês anterior, `spent` = mês de `today` até o dia. */
export function budgetItems(txs: FinTx[], limits: Record<string, number>, today: string): BudgetItem[] {
  const cur = monthOf(today);
  const prev = addMonths(cur, -1);
  const day = dayOf(today);
  const days = daysInMonth(cur);
  const recurring = recurringCharges(txs, today);
  return VARIABLE_IDS.map((id) => {
    const spent = r2(-sumBy(txs, id, cur, day));
    const avg = r2(-sumBy(txs, id, prev));
    const limit = r2(limitOf(limits, id, avg));
    return {
      category: id,
      label: CATEGORY_BY_ID.get(id)!.label,
      limit,
      spent,
      avg,
      committed: r2(sum(recurring.filter((r) => r.category === id).map((r) => r.amount))),
      ratio: limit ? Math.round((spent / limit) * 10000) / 10000 : 0,
      status: budgetStatus(spent, limit, day, days),
    };
  });
}

/** Gasto variável acumulado por dia do mês (índice 0 = antes do dia 1). */
export function dailyVariable(txs: FinTx[], today: string): number[] {
  const cur = monthOf(today);
  const day = dayOf(today);
  const vars = new Set(VARIABLE_IDS);
  const perDay = new Array<number>(day + 1).fill(0);
  for (const t of txs) {
    if (!vars.has(t.category) || monthOf(t.date) !== cur || isUnexpected(t)) continue;
    const d = dayOf(t.date);
    if (d <= day) perDay[d] += -t.amount;
  }
  let acc = 0;
  return perDay.map((v) => r2((acc += v)));
}

export interface Pace {
  spent: number;
  limit: number;
  idealToDate: number;
  /** gasto - ideal; negativo = abaixo do ritmo */
  diff: number;
  word: 'acima' | 'abaixo';
}
export function paceOf(daily: number[], limit: number, today: string): Pace {
  const day = dayOf(today);
  const spent = daily[daily.length - 1] ?? 0;
  const idealToDate = r2((limit * day) / daysInMonth(monthOf(today)));
  const diff = r2(spent - idealToDate);
  return { spent, limit, idealToDate, diff, word: diff > 0 ? 'acima' : 'abaixo' };
}

// ───────────────────────── ciclo do salário ─────────────────────────
/** Soma `n` dias a uma data ISO. */
export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const weekday = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = domingo

/** Domingo de Páscoa (algoritmo de Meeus/Butcher). */
function easter(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
const FIXED_HOLIDAYS = ['01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '11-20', '12-25'];
/** Feriado nacional (fixos + Sexta-feira Santa). */
export function isHoliday(date: string): boolean {
  return FIXED_HOLIDAYS.includes(date.slice(5)) || date === addDays(easter(Number(date.slice(0, 4))), -2);
}

/**
 * Dia do salário no mês: 5º dia útil (pela CLT o sábado conta, domingo e feriado não).
 * Se cair no sábado, a empresa paga na sexta (ou no último dia útil antes, se a sexta for feriado).
 */
export function paydayOf(month: string, nth = 5): string {
  let d = `${month}-01`;
  let count = 0;
  for (;;) {
    if (weekday(d) !== 0 && !isHoliday(d) && ++count === nth) break;
    d = addDays(d, 1);
  }
  while (weekday(d) === 6 || weekday(d) === 0 || isHoliday(d)) d = addDays(d, -1);
  return d;
}

export interface SalaryCycle {
  /** dia em que entrou (ou deveria entrar) o último salário */
  start: string;
  /** próximo salário */
  nextPayday: string;
  /** dia do ciclo (1 = dia do salário) e total de dias até o próximo */
  day: number;
  days: number;
  daysLeft: number;
  /** gasto variável desde o salário, limite do ciclo (soma dos limites) e quanto ainda dá */
  spent: number;
  limit: number;
  remaining: number;
  /** quanto dá pra gastar por dia até o próximo salário (contando hoje) */
  perDay: number;
  idealToDate: number;
  /** spent - idealToDate; negativo = abaixo do ritmo */
  diff: number;
  /** gasto variável acumulado por dia do ciclo (índice 0 = antes do salário) */
  daily: number[];
}

/** O salário de verdade, se entrou perto do dia previsto (empresa adiantou/atrasou). */
function actualPayday(txs: FinTx[], expected: string): string {
  const near = txs.filter(
    (t) => t.category === 'salario' && t.amount > 0 && Math.abs(Date.parse(t.date) - Date.parse(expected)) <= 5 * 86400000,
  );
  return near.sort((a, b) => b.amount - a.amount)[0]?.date ?? expected;
}

/** Ciclo de salário a salário: quanto foi nos variáveis desde o último e quanto ainda dá até o próximo. */
export function salaryCycle(txs: FinTx[], limit: number, today: string): SalaryCycle {
  const cur = monthOf(today);
  let start = actualPayday(txs, paydayOf(cur));
  let nextPayday = paydayOf(addMonths(cur, 1));
  if (start > today) {
    nextPayday = start;
    start = actualPayday(txs, paydayOf(addMonths(cur, -1)));
  }
  const days = Math.round((Date.parse(nextPayday) - Date.parse(start)) / 86400000);
  const day = Math.round((Date.parse(today) - Date.parse(start)) / 86400000) + 1;
  const vars = new Set(VARIABLE_IDS);
  const perDay = new Array<number>(day + 1).fill(0);
  for (const t of txs) {
    if (!vars.has(t.category) || t.date < start || t.date > today || isUnexpected(t)) continue;
    perDay[Math.round((Date.parse(t.date) - Date.parse(start)) / 86400000) + 1] += -t.amount;
  }
  let acc = 0;
  const daily = perDay.map((v) => r2((acc += v)));
  const spent = daily[daily.length - 1];
  const remaining = r2(limit - spent);
  const daysLeft = Math.max(0, days - day + 1);
  const idealToDate = r2((limit * day) / days);
  return {
    start,
    nextPayday,
    day,
    days,
    daysLeft,
    spent,
    limit: r2(limit),
    remaining,
    perDay: daysLeft ? r2(Math.max(0, remaining) / daysLeft) : 0,
    idealToDate,
    diff: r2(spent - idealToDate),
    daily,
  };
}

// ───────────────────────── empréstimos / holerite ─────────────────────────
export const loanLeft = (l: FinLoan) => Math.max(0, l.totalInstallments - l.currentInstallment);
const folhaLoans = (loans: FinLoan[]) => loans.filter((l) => l.source === 'FOLHA');

/** Líquido do holerite no mês `i` da projeção: sobe à medida que os consignados da folha acabam. */
export function netAt(i: number, net: number, loans: FinLoan[]): number {
  return r2(net + sum(folhaLoans(loans).filter((l) => loanLeft(l) < i).map((l) => l.installment)));
}

/**
 * 13º estimado: 1ª parcela (novembro) = metade do salário base; 2ª (dezembro) = o resto menos INSS e IRRF.
 * Sem holerite: metade do líquido em cada parcela.
 */
export function thirteenth(payslip: FinPayslip | null, income: Income): { first: number; second: number } {
  if (!payslip) return { first: r2(income.net / 2), second: r2(income.net / 2) };
  const find = (re: RegExp, kind: FinPayslipItem['kind']) =>
    sum(payslip.items.filter((i) => i.kind === kind && re.test(i.label)).map((i) => Math.abs(i.amount)));
  const base = find(/sal[áa]rio\s*base/i, 'provento') || payslip.gross;
  const taxes = find(/INSS/i, 'desconto') + find(/IRRF/i, 'desconto');
  const first = r2(base / 2);
  return { first, second: r2(base - first - taxes) };
}

// ───────────────────────── projeção ─────────────────────────
export interface ProjectionMonth {
  month: string;
  label: string;
  /** líquido do holerite + outra conta */
  income: number;
  /** líquido do holerite no mês (sobe quando empréstimos da folha acabam) */
  payslipNet: number;
  /** quanto a folha liberou neste mês em relação ao anterior */
  freed: number;
  out: number;
  extra: number;
  /** imprevistos do mês (só o mês atual tem; já somados em `out`) */
  unexpected: number;
  balance: number;
  /** reserva acumulada */
  reserve: number;
}
export interface ProjectionOpts {
  months?: number;
  plan?: boolean;
  countOther?: boolean;
  /** desconta os imprevistos do mês atual (padrão true; false = "como seria sem eles") */
  unexpected?: boolean;
}

/** Total gasto com imprevistos num mês (positivo). */
export function unexpectedIn(txs: FinTx[], month: string): number {
  return r2(-sum(txs.filter((t) => isUnexpected(t) && monthOf(t.date) === month).map((t) => t.amount)));
}

/** Dia (YYYY-MM-DD) em Brasília de um instante ISO. */
const brDay = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

/**
 * Lançamento da caixinha que veio depois da base do guardado (e entra nele): lançado num dia depois do dia
 * da base E importado depois dela. Do mesmo dia (guardou e informou junto) ou que já tava no app quando
 * informou (pendente, mesmo com data futura) já tava no valor informado.
 */
export function flowAfterBase(t: { date: string; createdAt: string }, savedAt: string): boolean {
  return t.date > brDay(savedAt) && t.createdAt > savedAt;
}

/**
 * Guardado de agora: a base que o usuário informou + o que entrou/saiu da caixinha/investimento
 * depois disso (`flows` = valores dos lançamentos: depósito é negativo e soma, resgate é positivo e tira).
 */
export function savedTotal(base: number, flows: number[]): number {
  return r2(Math.max(0, base - sum(flows)));
}

/**
 * Guardado no início do mês atual: o guardado de agora menos o que entrou na caixinha/investimento no mês
 * (esse dinheiro saiu da renda do mês, que a projeção já conta como sobra; somar os dois contaria duas vezes).
 */
export function savedAtMonthStart(input: FinInput): number {
  const cur = monthOf(input.today);
  const flow = sum(input.txs.filter((t) => t.category === 'investimento' && monthOf(t.date) === cur).map((t) => t.amount));
  return r2(Math.max(0, (input.saved ?? 0) + flow));
}

/** Projeção mês a mês (design `project`): plano = gastar nos limites; sem plano = na média atual. Reserva parte do guardado no início do mês. */
export function project(input: FinInput, opts: ProjectionOpts = {}): ProjectionMonth[] {
  const { months = 15, plan = true, countOther = true, unexpected = true } = opts;
  const income = incomeOf(input, countOther);
  const fixedSum = sum(fixedCosts(input.txs, input.today).map((f) => f.amount));
  const items = budgetItems(input.txs, input.limits, input.today);
  const varSum = sum(items.map((v) => (plan ? planLimit(v) : v.avg)));
  const t13 = thirteenth(input.payslip, income);
  const cur = monthOf(input.today);
  const surprise = unexpected ? unexpectedIn(input.txs, cur) : 0;
  // parte do guardado no início do mês (o que foi pra caixinha neste mês já tá na sobra dele)
  let reserve = savedAtMonthStart(input);
  let prevNet = income.net;
  return Array.from({ length: months }, (_, i) => {
    const month = addMonths(cur, i);
    const mm = Number(month.slice(5, 7));
    const payslipNet = netAt(i, income.net, input.loans);
    const extra = mm === 11 ? t13.first : mm === 12 ? t13.second : 0;
    const inc = payslipNet + income.other;
    const unexp = i === 0 ? surprise : 0;
    const out = fixedSum + varSum + unexp;
    const balance = inc + extra - out;
    reserve += balance;
    const freed = r2(payslipNet - prevNet);
    prevNet = payslipNet;
    return {
      month,
      label: monthLabel(month),
      income: r2(inc),
      payslipNet,
      freed,
      out: r2(out),
      extra: r2(extra),
      unexpected: unexp,
      balance: r2(balance),
      reserve: r2(reserve),
    };
  });
}

// ───────────────────────── real × plano ─────────────────────────
export interface MoneyMonth {
  income: number;
  out: number;
  balance: number;
}
export interface ActualMonth {
  month: string;
  label: string;
  /** mês atual: valores reais só até `today` */
  partial: boolean;
  /** o que aconteceu na conta; `balance` = sobra: no mês atual, o saldo da conta agora (sem saldo, entrou − saiu); nos fechados, entrou − saiu */
  real: MoneyMonth & { unexpected: number };
  /** o plano da IA pro mês inteiro */
  plan: MoneyMonth;
  /** real ÷ plano em % (null = plano zero/negativo) */
  pct: { income: number | null; out: number | null; balance: number | null };
  /** só no mês atual: reserva real (o guardado) × a que a IA espera no fim do mês (projeção do mês 0) */
  reserve: { real: number; plan: number; pct: number | null } | null;
  /**
   * só no mês atual: o que já foi guardado no mês, a meta de guardar e o excedente. Reserva e sobra são
   * coisas diferentes: a sobra esperada (`plan.balance`) só perde o excedente (o que passou da meta de guardar).
   */
  saving: { month: number; planned: number; extra: number } | null;
}

/**
 * Entrada real de um mês: salário + outras entradas + o que veio da outra conta própria (o maior crédito
 * "propria" do mês, se passar de 20% do líquido: mesma régua de `deriveOtherIncome`, que é o que o plano usa).
 * Crédito de empréstimo não é renda.
 */
function realIncome(txs: FinTx[], month: string, net: number): number {
  const of = txs.filter((t) => t.amount > 0 && monthOf(t.date) === month);
  const base = sum(of.filter((t) => t.category === 'salario' || t.category === 'outros_in').map((t) => t.amount));
  const other = Math.max(0, ...of.filter((t) => t.category === 'propria').map((t) => t.amount));
  return r2(base + (other >= Math.max(1, net * 0.2) ? other : 0));
}

const pctOf = (real: number, plan: number) => (plan > 0 ? Math.round((real / plan) * 100) : null);

/** Real × plano da IA no mês atual (até hoje) e nos meses fechados anteriores (`back`). */
export function actualVsPlan(input: FinInput, back = 2): ActualMonth[] {
  const cur = monthOf(input.today);
  const income = incomeOf(input);
  const fixed = sum(fixedCosts(input.txs, input.today).map((f) => f.amount));
  const limits = sum(budgetItems(input.txs, input.limits, input.today).map(planLimit));
  const m0 = project(input, { plan: true, months: 1 })[0];
  const has = new Set(input.txs.map((t) => monthOf(t.date)));
  const out: ActualMonth[] = [];
  for (let k = back; k >= 0; k--) {
    const month = addMonths(cur, -k);
    if (!has.has(month)) continue;
    const inMonth = input.txs.filter((t) => monthOf(t.date) === month && t.date <= input.today);
    const rIn = realIncome(input.txs, month, income.net);
    const rOut = r2(-sum(inMonth.filter(isSpending).map((t) => t.amount)));
    // sobra: no mês atual é o que tá na conta agora (saldo do banco); nos fechados, entrou − saiu
    const flow = r2(rIn - rOut);
    const real = { income: rIn, out: rOut, balance: k === 0 && input.balance != null ? input.balance : flow, unexpected: unexpectedIn(input.txs, month) };
    // mês atual: o que foi guardado acima da meta de guardar (excedente) é abatido da sobra esperada
    const savedMonth = k === 0 ? r2((input.saved ?? 0) - savedAtMonthStart(input)) : 0;
    const extra = k === 0 ? r2(Math.max(0, savedMonth - Math.max(0, m0.balance))) : 0;
    const plan =
      k === 0
        ? { income: r2(m0.income + m0.extra), out: m0.out, balance: r2(Math.max(0, m0.balance - extra)) }
        : { income: income.total, out: r2(fixed + limits), balance: r2(income.total - fixed - limits) };
    out.push({
      month,
      label: monthLabel(month),
      partial: k === 0,
      real,
      plan,
      pct: { income: pctOf(real.income, plan.income), out: pctOf(real.out, plan.out), balance: pctOf(real.balance, plan.balance) },
      reserve: k === 0 ? { real: input.saved ?? 0, plan: m0.reserve, pct: pctOf(input.saved ?? 0, m0.reserve) } : null,
      saving: k === 0 ? { month: savedMonth, planned: m0.balance, extra } : null,
    });
  }
  return out;
}

// ───────────────────────── detalhe de um mês ─────────────────────────
/** Uma linha do detalhe: real (null = mês futuro), plano da IA e "gastando como o mês passado". */
export interface DetailLine {
  id: string;
  label: string;
  real: number | null;
  plan: number;
  noPlan: number;
}
export interface DetailGroup {
  lines: DetailLine[];
  real: number | null;
  plan: number;
  noPlan: number;
}
export interface MonthDetail {
  month: string;
  label: string;
  /** past = mês fechado; current = mês de "hoje" (real até hoje); future = só projeção */
  kind: 'past' | 'current' | 'future';
  /** meses a partir do atual (negativo = passado) */
  offset: number;
  income: DetailGroup;
  fixed: DetailGroup;
  variable: DetailGroup;
  unexpected: { total: number; items: { date: string; description: string; amount: number; type: string; label: string; note: string | null }[] };
  totals: {
    real: MoneyMonth | null;
    plan: MoneyMonth;
    noPlan: MoneyMonth;
  };
  /** reserva no fim do mês; real = o guardado (só no mês atual) */
  reserve: { real: number | null; plan: number | null; noPlan: number | null };
  /** só no mês atual: guardado no mês, a meta de guardar e o excedente (abatido da sobra esperada) */
  saving: { month: number; planned: number; extra: number } | null;
  /** o que muda no mês: 13º, consignado da folha que acaba */
  events: string[];
  /** meses navegáveis (anterior/próximo dentro do intervalo) */
  prev: string | null;
  next: string | null;
}
export const DETAIL_BACK = 2;
export const DETAIL_AHEAD = 35;

const group = (lines: DetailLine[], withReal: boolean): DetailGroup => ({
  lines,
  real: withReal ? r2(sum(lines.map((l) => l.real ?? 0))) : null,
  plan: r2(sum(lines.map((l) => l.plan))),
  noPlan: r2(sum(lines.map((l) => l.noPlan))),
});

/** Detalhe de um mês da projeção: entradas, fixos, variáveis e imprevistos, real × plano × "como o mês passado". */
export function monthDetail(input: FinInput, month: string): MonthDetail | null {
  const cur = monthOf(input.today);
  const offset = monthDiff(cur, month);
  if (offset < -DETAIL_BACK || offset > DETAIL_AHEAD) return null;
  const kind = offset < 0 ? 'past' : offset === 0 ? 'current' : 'future';
  const withReal = kind !== 'future';
  const income = incomeOf(input);
  const fixedItems = fixedCosts(input.txs, input.today);
  const items = budgetItems(input.txs, input.limits, input.today);
  const t13 = thirteenth(input.payslip, income);
  const i = Math.max(0, offset);
  const plan = project(input, { plan: true, months: i + 1 })[i];
  const noPlan = project(input, { plan: false, months: i + 1 })[i];
  const realCat = (id: string) => (withReal ? r2(-sumBy(input.txs, id, month)) : null);
  // mês atual: o excedente do guardado no mês (acima da meta de guardar) é abatido da sobra esperada (ver actualVsPlan)
  const savedMonth = kind === 'current' ? r2((input.saved ?? 0) - savedAtMonthStart(input)) : 0;
  const savedExtra = kind === 'current' ? r2(Math.max(0, savedMonth - Math.max(0, plan.balance))) : 0;

  // entradas
  const inMonth = input.txs.filter((t) => t.amount > 0 && monthOf(t.date) === month);
  const otherReal = Math.max(0, ...inMonth.filter((t) => t.category === 'propria').map((t) => t.amount));
  const payslipNet = kind === 'past' ? income.net : plan.payslipNet;
  const mm = Number(month.slice(5, 7));
  const extra = kind === 'past' ? (mm === 11 ? t13.first : mm === 12 ? t13.second : 0) : plan.extra;
  const incLines: DetailLine[] = [
    { id: 'salario', label: 'Salário (líquido)', real: withReal ? r2(sum(inMonth.filter((t) => t.category === 'salario').map((t) => t.amount))) : null, plan: payslipNet, noPlan: payslipNet },
    ...(income.other > 0 || otherReal > 0
      ? [{ id: 'outra', label: 'Da tua outra conta', real: withReal ? (otherReal >= Math.max(1, income.net * 0.2) ? r2(otherReal) : 0) : null, plan: income.other, noPlan: income.other }]
      : []),
    ...(extra > 0 ? [{ id: '13', label: mm === 11 ? '13º (1ª parcela)' : '13º (2ª parcela)', real: withReal ? 0 : null, plan: r2(extra), noPlan: r2(extra) }] : []),
  ];
  const outrosIn = r2(sum(inMonth.filter((t) => t.category === 'outros_in').map((t) => t.amount)));
  if (withReal && outrosIn > 0) incLines.push({ id: 'outros_in', label: 'Outras entradas', real: outrosIn, plan: 0, noPlan: 0 });

  // fixos: os estimados + algum fixo que apareceu de verdade no mês
  const fixedIds = new Set(fixedItems.map((f) => f.id));
  const fixLines: DetailLine[] = fixedItems.map((f) => ({ id: f.id, label: f.label, real: realCat(f.id), plan: f.amount, noPlan: f.amount }));
  if (withReal)
    for (const id of FIXED_IDS)
      if (!fixedIds.has(id) && (realCat(id) ?? 0) > 0) fixLines.push({ id, label: CATEGORY_BY_ID.get(id)!.label, real: realCat(id), plan: 0, noPlan: 0 });

  // variáveis: plano = limite (nunca abaixo das recorrentes); "como o mês passado" = média
  const varLines: DetailLine[] = items
    .map((b) => ({ id: b.category, label: b.label, real: realCat(b.category), plan: planLimit(b), noPlan: b.avg }))
    .sort((a, b) => (b.real ?? b.plan) - (a.real ?? a.plan));

  // imprevistos do mês (no futuro não tem)
  const unexp = input.txs
    .filter((t) => isUnexpected(t) && monthOf(t.date) === month)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((t) => ({
      date: t.date,
      description: cleanName(t.description),
      amount: r2(-t.amount),
      type: t.unexpected!,
      label: UNEXPECTED_BY_ID.get(t.unexpected!)?.label ?? t.unexpected!,
      note: t.unexpectedNote ?? null,
    }));
  const unexpTotal = r2(sum(unexp.map((u) => u.amount)));

  const inc = group(incLines, withReal);
  const fix = group(fixLines, withReal);
  const vars = group(varLines, withReal);
  const realOut = withReal ? r2((fix.real ?? 0) + (vars.real ?? 0) + unexpTotal) : null;
  const totals = {
    real: withReal
      ? { income: inc.real!, out: realOut!, balance: kind === 'current' && input.balance != null ? input.balance : r2(inc.real! - realOut!) }
      : null,
    plan:
      kind === 'past'
        ? { income: inc.plan, out: r2(fix.plan + vars.plan), balance: r2(inc.plan - fix.plan - vars.plan) }
        : { income: r2(plan.income + plan.extra), out: plan.out, balance: kind === 'current' ? r2(Math.max(0, plan.balance - savedExtra)) : plan.balance },
    noPlan:
      kind === 'past'
        ? { income: inc.noPlan, out: r2(fix.noPlan + vars.noPlan), balance: r2(inc.noPlan - fix.noPlan - vars.noPlan) }
        : { income: r2(noPlan.income + noPlan.extra), out: noPlan.out, balance: noPlan.balance },
  };

  const events: string[] = [];
  if (extra > 0) events.push(`${mm === 11 ? '1ª' : '2ª'} parcela do 13º: uns ${brl(extra)}`);
  if (kind !== 'past')
    for (const l of folhaLoans(input.loans).filter((l) => loanLeft(l) === i - 1 && i > 0))
      events.push(`Acabou o ${l.name} da folha: o líquido sobe ${brl(l.installment)}`);
  if (unexpTotal > 0) events.push(`Imprevistos: ${brl(unexpTotal)} fora do plano`);

  return {
    month,
    label: monthLabel(month),
    kind,
    offset,
    income: inc,
    fixed: fix,
    variable: vars,
    unexpected: { total: unexpTotal, items: unexp },
    totals,
    reserve: {
      real: kind === 'current' ? (input.saved ?? 0) : null,
      plan: kind === 'past' ? null : plan.reserve,
      noPlan: kind === 'past' ? null : noPlan.reserve,
    },
    saving: kind === 'current' ? { month: savedMonth, planned: plan.balance, extra: savedExtra } : null,
    events,
    prev: offset > -DETAIL_BACK ? addMonths(month, -1) : null,
    next: offset < DETAIL_AHEAD ? addMonths(month, 1) : null,
  };
}

/** Primeiro mês em que a reserva alcança `target` (ou null). */
export function reachMonth(months: { month: string; reserve: number }[], target: number): string | null {
  return months.find((m) => m.reserve >= target)?.month ?? null;
}

// ───────────────────────── gastos por categoria ─────────────────────────
export interface CategorySpend {
  id: string;
  label: string;
  kind: 'fixo' | 'variavel';
  amount: number;
  pctIncome: number;
}

/**
 * Gastos por categoria (fixos + variáveis; transferências próprias e entradas ficam fora).
 * `month` null = todos os meses de `txs`; aí `incomeTotal` deve ser a renda do período todo.
 */
export function spendingByCategory(txs: FinTx[], month: string | null, incomeTotal: number): CategorySpend[] {
  const by = new Map<string, number>();
  for (const t of txs) {
    if ((month && monthOf(t.date) !== month) || !isSpending(t)) continue;
    const k = kindOf(t.category);
    if (k !== 'fixo' && k !== 'variavel') continue;
    by.set(t.category, (by.get(t.category) ?? 0) - t.amount);
  }
  return [...by.entries()]
    .map(([id, v]) => {
      const c = CATEGORY_BY_ID.get(id)!;
      const amount = r2(v);
      return {
        id,
        label: c.label,
        kind: c.kind as 'fixo' | 'variavel',
        amount,
        pctIncome: incomeTotal ? Math.round((amount / incomeTotal) * 1000) / 10 : 0,
      };
    })
    .sort((a, b) => b.amount - a.amount);
}

// ───────────────────────── estabelecimentos ─────────────────────────
const PREFIX = /^(PAY|PIX TRANSF|PIX QRS|PIX AUT|PAG BOLETO BANCO|PAG BOLETO|PAG|COMPRA CARTAO|DEBITO)\s+/i;
export const cleanName = (d: string) => d.replace(PREFIX, '').trim();

/** Deixa o nome legível: "INFO STORE" → "Info Store"; siglas de até 2 letras ficam maiúsculas ("JR"). */
export function prettyName(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => (w.length <= 2 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()))
    .join(' ');
}

/** Lançamentos dos últimos 2 meses até `today` (janela do extrato usada pelos insights). */
export function recentWindow(txs: FinTx[], today: string, months = 2): FinTx[] {
  const start = `${addMonths(monthOf(today), -months)}-${today.slice(8, 10)}`;
  return txs.filter((t) => t.date > start && t.date <= today);
}

export interface Merchant {
  name: string;
  count: number;
  total: number;
}
/** Estabelecimento com mais compras variáveis na janela (agrupa pelo começo do nome, como o Itaú trunca). */
export function topMerchant(txs: FinTx[]): Merchant | null {
  const vars = new Set(VARIABLE_IDS);
  const groups = new Map<string, { names: string[]; count: number; total: number }>();
  for (const t of txs) {
    if (!vars.has(t.category) || t.amount >= 0 || t.category === 'pessoas') continue;
    const name = cleanName(t.description);
    const key = name.slice(0, 5).toUpperCase();
    const g = groups.get(key) ?? { names: [], count: 0, total: 0 };
    g.names.push(name);
    g.count++;
    g.total -= t.amount;
    groups.set(key, g);
  }
  let best: Merchant | null = null;
  for (const g of groups.values()) {
    if (!best || g.count > best.count) {
      const longest = g.names.reduce((a, b) => (b.length > a.length ? b : a), '');
      best = { name: prettyName(longest), count: g.count, total: r2(g.total) };
    }
  }
  return best;
}

/** Texto de insight da tela Gastos (design: JR Distribuidora / iFood / vazamentos). `month` null = período todo. */
export function spendingInsight(txs: FinTx[], today: string, month: string | null): string {
  const win = recentWindow(txs, today);
  const parts: string[] = [];
  const top = topMerchant(win);
  if (top && top.count >= 5)
    parts.push(`Foram ${top.count} compras na ${top.name} em 2 meses, somando ${brl(top.total)}.`);
  const deliveries = win.filter((t) => t.category === 'delivery' && t.amount < 0).length;
  const leakCats = new Set(['lanches', 'delivery', 'pessoas']);
  const leak = r2(-sum(txs.filter((t) => leakCats.has(t.category) && (!month || monthOf(t.date) === month)).map((t) => t.amount)));
  if (leak > 0)
    parts.push(
      `Somando lanches, delivery (${deliveries} pedidos) e Pix pra pessoas, ${month ? monthLongName(month) : 'no período todo'} passou de ${brl(leak)}. É aí que o limite mais rende.`,
    );
  return parts.join(' ') || 'Ainda não tem lançamentos suficientes pra achar padrões. Importa teu extrato.';
}

// ───────────────────────── visão geral ─────────────────────────
export interface OverviewCalc {
  month: string;
  today: string;
  day: number;
  daysInMonth: number;
  income: Income;
  fixed: FixedItem[];
  fixedTotal: number;
  variable: { spent: number; limit: number; avg: number; idealToDate: number; diff: number; daily: number[] };
  leftover: number;
  /** variáveis de salário a salário (5º dia útil) */
  cycle: SalaryCycle;
  payslipFreed: number | null;
  netAfterLoans: { month: string; net: number } | null;
  insight: string;
}

/**
 * Texto do card "IA" da visão geral: só a próxima ação, sem repetir os números dos cards (mês, meta, sobra).
 * Estourou > acima do ritmo (warn) > tudo no ritmo (aí aponta a categoria que mais pesa no plano).
 */
export function overviewInsight(items: BudgetItem[], day: number, days: number): string {
  const over = items.filter((i) => i.status === 'over').sort((a, b) => b.spent - b.limit - (a.spent - a.limit));
  if (over.length)
    return `${listPt(over.slice(0, 3).map((i) => i.label))} já ${over.length === 1 ? 'estourou' : 'estouraram'} o limite do mês. Segura o resto pra não comer a sobra.`;
  const warn = items.filter((i) => i.status === 'warn').sort((a, b) => b.ratio - a.ratio);
  if (warn.length) {
    const w = warn[0];
    return `Fica de olho em ${listPt(warn.slice(0, 3).map((i) => i.label))}: ${warn.length === 1 ? 'tá andando' : 'tão andando'} mais rápido que o mês (${w.label} já usou ${Math.round(w.ratio * 100)}% do limite e o mês tá em ${Math.round((day / days) * 100)}%).`;
  }
  const heavy = [...items].sort((a, b) => b.avg - planLimit(b) - (a.avg - planLimit(a)))[0];
  return heavy && heavy.avg > planLimit(heavy)
    ? `Tudo no ritmo. O que mais pesa no plano é ${heavy.label}: média ${brl(heavy.avg)} → limite ${brl(planLimit(heavy))}.`
    : 'Tudo no ritmo dos limites. Segue assim.';
}

export function overview(input: FinInput): OverviewCalc {
  const { today } = input;
  const month = monthOf(today);
  const income = incomeOf(input);
  const fixed = fixedCosts(input.txs, today);
  const fixedTotal = r2(sum(fixed.map((f) => f.amount)));
  const items = budgetItems(input.txs, input.limits, today);
  const limit = r2(sum(items.map((i) => i.limit)));
  const avg = r2(sum(items.map((i) => i.avg)));
  const daily = dailyVariable(input.txs, today);
  const pace = paceOf(daily, limit, today);

  const plan = project(input, { plan: true });
  const last = plan[plan.length - 1];
  const freedIdx = plan.findIndex((m) => m.payslipNet === last.payslipNet);
  const payslipFreed = last.payslipNet > income.net ? r2(last.payslipNet - income.net) : null;

  const insight = overviewInsight(items, dayOf(today), daysInMonth(month));

  return {
    month,
    today,
    day: dayOf(today),
    daysInMonth: daysInMonth(month),
    income,
    fixed,
    fixedTotal,
    variable: { spent: pace.spent, limit, avg, idealToDate: pace.idealToDate, diff: pace.diff, daily },
    leftover: r2(income.total - fixedTotal - limit),
    cycle: salaryCycle(input.txs, limit, today),
    payslipFreed,
    netAfterLoans: payslipFreed ? { month: plan[freedIdx].month, net: last.payslipNet } : null,
    insight,
  };
}

// ───────────────────────── alertas ─────────────────────────
export interface Alert {
  tag: string;
  tone: 'neg' | 'warn' | 'pos';
  title: string;
  body: string;
}

export function alerts(input: FinInput): Alert[] {
  const { today, txs, loans } = input;
  const out: Alert[] = [];
  const win = recentWindow(txs, today);
  const income = incomeOf(input);
  const fixed = fixedCosts(txs, today);

  // DÍVIDA: créditos de empréstimo que entraram na conta
  const credits = win.filter((t) => t.category === 'emprestimo_in' && t.amount > 0).sort((a, b) => a.date.localeCompare(b.date));
  if (credits.length) {
    const total = r2(sum(credits.map((t) => t.amount)));
    const folha = folhaLoans(loans).length;
    const conta = fixed.find((f) => f.id === 'emprestimo')?.amount ?? 0;
    const n = credits.length;
    let body =
      n === 1
        ? `Em ${ddmm(credits[0].date)} entrou 1 crédito de empréstimo na conta.`
        : `Entre ${ddmm(credits[0].date)} e ${ddmm(credits[n - 1].date)} entraram ${n} créditos consignados na conta.`;
    if (conta > 0)
      body += folha
        ? ` Além dos ${folha} da folha, já tem ${brl(conta)}/mês debitando na conta.`
        : ` Já tem ${brl(conta)}/mês debitando na conta.`;
    out.push({ tag: 'DÍVIDA', tone: 'neg', title: `${brl(total)} em novos empréstimos`, body });
  }

  // INCOMUM: maior compra variável da janela, se passar de metade do líquido
  const vars = new Set(VARIABLE_IDS);
  const big = win.filter((t) => vars.has(t.category) && t.amount < 0).sort((a, b) => a.amount - b.amount)[0];
  if (big && income.net > 0 && -big.amount >= income.net * 0.5) {
    const sameDay = win
      .filter((t) => t.date === big.date && t.amount > 0 && t.category !== 'salario')
      .sort((a, b) => b.amount - a.amount)[0];
    out.push({
      tag: 'INCOMUM',
      tone: 'warn',
      title: `Compra de ${brl(-big.amount)} na ${prettyName(cleanName(big.description))}`,
      body: sameDay
        ? `Em ${ddmm(big.date)}, no mesmo dia de um crédito de ${brl(sameDay.amount)}.`
        : `Em ${ddmm(big.date)}. Bem acima do teu gasto normal.`,
    });
  }

  // FOLHA: contratos consignados que terminaram
  const ended = folhaLoans(loans).filter((l) => loanLeft(l) === 0);
  if (ended.length) {
    const next = addMonths(monthOf(today), 1);
    const nextNet = netAt(1, income.net, loans);
    const name = monthLongName(next);
    out.push({
      tag: 'FOLHA',
      tone: 'pos',
      title: ended.length === 1 ? `Contrato de ${ended[0].totalInstallments}x terminou` : `${ended.length} contratos terminaram`,
      body: `${name[0].toUpperCase() + name.slice(1)} entra ${brl(nextNet)} líquido.`,
    });
  }

  // LIMITE: variáveis que já estouraram no mês
  for (const b of budgetItems(txs, input.limits, today).filter((i) => i.status === 'over')) {
    out.push({
      tag: 'LIMITE',
      tone: 'warn',
      title: `${b.label} estourou o limite`,
      body: `${brl(b.spent)} de ${brl(b.limit)} em ${monthLongName(monthOf(today))}.`,
    });
  }

  // RITMO: variáveis acima do ritmo ideal
  const limit = sum(budgetItems(txs, input.limits, today).map((i) => i.limit));
  const pace = paceOf(dailyVariable(txs, today), limit, today);
  if (pace.diff > 0)
    out.push({
      tag: 'RITMO',
      tone: 'warn',
      title: `${brl(pace.diff)} acima do ritmo`,
      body: `Até o dia ${dayOf(today)} o ideal era ${brl(pace.idealToDate)} nos variáveis e tu já gastou ${brl(pace.spent)}.`,
    });
  return out;
}

// ───────────────────────── assistente (sugestões e respostas por regras) ─────────────────────────
const goalShort = (target: number) =>
  target >= 1000 && target % 1000 === 0 ? `${(target / 1000).toLocaleString('pt-BR')} mil` : brl(target);

/** "a, b e c" */
const listPt = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}` : xs.join(''));

/** Loan da folha com mais parcelas pela frente. */
const longestLoan = (loans: FinLoan[]) =>
  [...folhaLoans(loans)].filter((l) => loanLeft(l) > 0).sort((a, b) => loanLeft(b) - loanLeft(a))[0];

export function prompts(input: FinInput): string[] {
  const list = ['Onde estou gastando mais?'];
  const l = longestLoan(input.loans);
  if (l) list.push(`E se eu quitar o contrato de ${l.totalInstallments}x?`);
  list.push(input.goal ? `Quanto guardar por mês pra ${goalShort(input.goal.target)}?` : 'Quanto dá pra guardar por mês?');
  list.push('Posso trocar de celular?');
  return list;
}

/** Resposta sem IA: escolhe o assunto por palavras-chave e responde com os números do usuário. */
export function ruleReply(input: FinInput, question: string): string {
  const q = question.toLowerCase();
  const income = incomeOf(input);
  const fixed = fixedCosts(input.txs, input.today);
  const fixedSum = r2(sum(fixed.map((f) => f.amount)));
  const items = budgetItems(input.txs, input.limits, input.today);
  const plan = project(input, { plan: true });
  const cur = monthOf(input.today);
  const prev = addMonths(cur, -1);
  const last = plan[plan.length - 1];
  const when = (m: string | null) => (m ? monthLabel(m) : `depois de ${last.label}`);
  const reserveMin = reachMonth(plan, fixedSum);
  const varLim = sum(items.map((i) => i.limit));
  const varAvg = sum(items.map((i) => i.avg));

  // empréstimo / quitar
  if (/quit|contrato|empr[ée]stimo|consignado|\d+\s*x\b/.test(q)) {
    const n = Number(/(\d+)\s*x\b/.exec(q)?.[1]);
    const folha = folhaLoans(input.loans);
    const l = (n && folha.find((x) => x.totalInstallments === n && loanLeft(x) > 0)) || longestLoan(input.loans);
    if (!l) return 'Não achei empréstimo em aberto na tua folha. Se tiver algum, cadastra na tela de Empréstimos.';
    const left = loanLeft(l);
    const end = monthLabel(addMonths(cur, left));
    let txt = `O contrato de ${l.totalInstallments}x tem ${left} parcelas de ${brl(l.installment)} pela frente, ${brl(r2(left * l.installment))} no total, até ${end}.`;
    txt +=
      left <= 2
        ? ' Faltam poucas parcelas: não vale usar reserva, ele sai sozinho. Guarda o valor liberado quando terminar.'
        : ` Quitar agora libera ${brl(l.installment)} por mês no teu líquido. Pede o saldo com desconto de juros antes e compara.`;
    txt += ` Só usa dinheiro pra isso depois de ter ${brl(fixedSum)} de reserva (1 mês de fixos), o que com os limites acontece em ${when(reserveMin)}.`;
    return txt;
  }

  // meta / guardar
  if (/guard|meta|reserva|\bmil\b|poupar|juntar/.test(q)) {
    const p = goalPlanFor(input);
    const g = input.goal;
    if (!g || !p) return 'Tu ainda não tem meta. Diz quanto quer juntar no card da visão geral que eu calculo quando tu chega lá.';
    if (p.status === 'reached') return `Tu já bateu a meta de ${brl(g.target)}. Cria a próxima no card da meta, somando em cima dela.`;
    const prevName = monthLongName(addMonths(cur, -1));
    let txt = `${goalSentence(input)}.`;
    txt +=
      p.paceToday < 0
        ? ` No ritmo de ${prevName} não chega: teus gastos passam da renda em ${brl(-p.paceToday)} por mês.`
        : p.reachToday
          ? ` No ritmo de ${prevName} chega em ${monthLabel(p.reachToday)}.`
          : ` No ritmo de ${prevName} não chega em 5 anos.`;
    if (p.cuts.length) txt += ` O plano segura ${listPt(p.cuts.slice(0, 3).map((c) => `${c.label} (${brl(c.avg)} → ${brl(c.limit)})`))}.`;
    return txt;
  }

  // compra grande / celular
  if (/celular|trocar|comprar|compra|posso/.test(q)) {
    return (
      `${input.saved ? `Hoje tu tem ${brl(input.saved)} guardado.` : 'Hoje tu não tem reserva guardada.'} Com os limites, sobram ${brl(plan[0].balance)} em ${monthLabel(cur)} e a reserva de 1 mês de fixos (${brl(fixedSum)}) fica pronta em ${when(reserveMin)}. ` +
      `Espera até lá e compra à vista com o que passar disso. Parcelar agora soma mais uma conta aos ${brl(fixed.find((f) => f.id === 'celular')?.amount ?? fixedSum)} que já saem todo mês.`
    );
  }

  // onde gasto mais / cortar
  if (/onde|gast|cort|economi|mais/.test(q)) {
    const top = [...items].sort((a, b) => b.avg - a.avg).slice(0, 3).filter((i) => i.avg > 0);
    const m = topMerchant(recentWindow(input.txs, input.today));
    let txt = top.length
      ? `Em ${monthLongName(prev)} o que mais pesou nos variáveis foi ${listPt(top.map((i) => `${i.label} (${brl(i.avg)})`))}.`
      : `Ainda não tenho gastos de ${monthLongName(prev)} pra comparar.`;
    if (m && m.count >= 5) txt += ` Só na ${m.name} foram ${m.count} compras, ${brl(m.total)}.`;
    if (varAvg > varLim) txt += ` Se tu segurar nos limites, economiza ${brl(r2(varAvg - varLim))} por mês.`;
    return txt;
  }

  // fallback (design): onde o corte mais rende
  const gap = [...items].sort((a, b) => b.avg - b.limit - (a.avg - a.limit))[0];
  return (
    `Pelos teus números: os fixos levam ${brl(fixedSum)} de ${brl(income.total)} de renda` +
    (gap && gap.avg > gap.limit
      ? `, então o corte que mais rende é em ${gap.label} (${brl(gap.avg)} → ${brl(gap.limit)})`
      : '') +
    ' e guardar cada empréstimo que sai da folha.'
  );
}

const RECENT_TX_MONTHS = 2;
const RECENT_TX_MAX = 300;

/** Resumo compacto (JSON) para o prompt do Claude. */
export function financeSummary(input: FinInput) {
  const ov = overview(input);
  const cur = monthOf(input.today);
  const prev = addMonths(cur, -1);
  const plan = project(input, { plan: true });
  const noPlan = project(input, { plan: false });
  return {
    hoje: input.today,
    renda: { liquido: ov.income.net, bruto: ov.income.gross, outraConta: ov.income.other },
    holerite: input.payslip
      ? { mes: input.payslip.month, itens: input.payslip.items.map((i) => `${i.kind === 'desconto' ? '-' : '+'}${i.label} ${i.amount}`) }
      : null,
    fixos: ov.fixed.map((f) => ({ [f.label]: f.amount })),
    contasRecorrentes: recurringCharges(input.txs, input.today).map((r) => `${r.name} (${CATEGORY_BY_ID.get(r.category)!.label}): ${r.amount}/mês`),
    variaveis: budgetItems(input.txs, input.limits, input.today).map((b) => ({
      cat: b.label,
      limite: b.limit,
      ...(b.committed ? { recorrente: b.committed } : {}),
      [`gasto_${cur}`]: b.spent,
      [`media_${prev}`]: b.avg,
    })),
    ritmo: { gastoAteHoje: ov.variable.spent, idealAteHoje: ov.variable.idealToDate },
    gastosMesAnterior: spendingByCategory(input.txs, prev, ov.income.total).map((c) => ({ [c.label]: c.amount })),
    emprestimos: input.loans.map((l) => ({
      origem: l.source,
      parcela: l.installment,
      atual: l.currentInstallment,
      total: l.totalInstallments,
      fim: monthLabel(addMonths(cur, loanLeft(l))),
    })),
    meta: input.goal ? { ...input.goal, guardado: input.saved ?? 0, plano: goalPlanFor(input) } : null,
    projecaoComLimites: plan.map((m) => `${m.label}: saldo ${m.balance}, reserva ${m.reserve}`),
    projecaoSemLimites: noPlan.map((m) => `${m.label}: saldo ${m.balance}, reserva ${m.reserve}`),
    alertas: alerts(input).map((a) => `${a.tag}: ${a.title}. ${a.body}`),
    // pra responder perguntas sobre um gasto específico ("quanto foi no Assaí?", "que Pix foi esse?")
    lancamentos: recentWindow(input.txs, input.today, RECENT_TX_MONTHS)
      .filter((t) => t.category !== 'propria')
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, RECENT_TX_MAX)
      .map((t) => `${ddmm(t.date)} ${cleanName(t.description)} ${t.amount} ${t.category}${isUnexpected(t) ? ' [imprevisto]' : ''}`),
    // gastos pontuais que o usuário marcou: fora das médias e limites, descontados uma vez na projeção do mês
    imprevistos: input.txs
      .filter(isUnexpected)
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((t) => ({
        data: ddmm(t.date),
        valor: -t.amount,
        tipo: UNEXPECTED_BY_ID.get(t.unexpected!)?.label ?? t.unexpected,
        descricao: cleanName(t.description),
        ...(t.unexpectedNote ? { justificativa: t.unexpectedNote } : {}),
      })),
    reservas: (() => {
      const r = reserveLevels(input);
      return {
        custoDoMes: r.monthlyCost,
        essencialDoMes: r.essential,
        niveis: r.levels.map((l) => `${l.label} (${l.months} meses do ${l.base === 'essencial' ? 'essencial' : 'custo de vida'}): ${l.target}, ${l.reached ? 'já tem' : l.reachPlan ? `chega em ${monthLabel(l.reachPlan)}` : 'não chega em 5 anos'}`),
      };
    })(),
  };
}

// ───────────────────────── meta ─────────────────────────
/**
 * Meta "inteligente": o usuário diz só o valor; a data sai dos dados. O plano é gastar até os limites
 * de cada categoria (o mesmo "plano da IA" do painel); também mostra o ritmo de hoje (gastos do mês passado).
 */
export type GoalStatus = 'reached' | 'onTrack' | 'tooSlow';
export interface GoalCut {
  category: string;
  label: string;
  avg: number;
  /** limite atual (o plano gasta até aqui; nunca abaixo das contas recorrentes) */
  limit: number;
  /** contas recorrentes da categoria (não entram no corte) */
  committed: number;
  /** quanto o plano corta por mês nessa categoria (média − limite) */
  cut: number;
}
export interface GoalPlanCalc {
  missing: number;
  status: GoalStatus;
  /** mês (YYYY-MM) em que bate seguindo os limites; null se não chega em 5 anos */
  reachPlan: string | null;
  monthsPlan: number | null;
  /** média guardada por mês seguindo os limites (até bater, no máx. 12 meses) */
  savePerMonth: number;
  /** mês em que bate gastando como o mês passado (null = não chega) */
  reachToday: string | null;
  /** sobra de um mês "normal" (sem 13º) gastando como o mês passado — o mesmo do texto da IA; negativo = gastos passam da renda */
  paceToday: number;
  cuts: GoalCut[];
  /** imprevistos do mês atual e quantos meses empurraram a meta (0 = não mudou) */
  unexpected: { amount: number; delayMonths: number };
}
type MonthBal = { month: string; balance: number; reserve: number; extra?: number };
export interface GoalPlanInput {
  target: number;
  saved: number;
  /** projeções de `project` (reserva já parte do guardado), mês atual primeiro, ~60 meses */
  plan: MonthBal[];
  noPlan: MonthBal[];
  items: BudgetItem[];
  /** projeção com limites sem descontar os imprevistos do mês (pra medir o atraso) */
  planNoUnexpected?: MonthBal[];
  /** total de imprevistos do mês atual */
  unexpected?: number;
}

const avgBalance = (ms: MonthBal[], n: number) => {
  const w = ms.slice(0, Math.max(1, n));
  return w.length ? r2(w.reduce((a, m) => a + m.balance, 0) / w.length) : 0;
};

export function goalPlan(i: GoalPlanInput): GoalPlanCalc {
  const missing = r2(Math.max(0, i.target - i.saved));
  const reachToday = missing <= 0 ? null : reachMonth(i.noPlan, i.target);
  // mês "normal": o primeiro depois do atual sem 13º (mesma régua do insight da visão geral)
  const typical = i.noPlan.find((m, k) => k > 0 && !m.extra) ?? i.noPlan[0];
  const paceToday = typical ? r2(typical.balance) : 0;
  const amount = i.unexpected ?? 0;
  if (missing <= 0)
    return {
      missing, status: 'reached', reachPlan: null, monthsPlan: null, savePerMonth: avgBalance(i.plan, 12), reachToday, paceToday, cuts: [],
      unexpected: { amount, delayMonths: 0 },
    };
  const idx = i.plan.findIndex((m) => m.reserve >= i.target);
  // sem chegar em 5 anos conta como mês 61, pra medir o atraso mesmo assim
  const at = (ms: MonthBal[]) => {
    const k = ms.findIndex((m) => m.reserve >= i.target);
    return k >= 0 ? k : ms.length;
  };
  const delayMonths = amount > 0 && i.planNoUnexpected ? Math.max(0, at(i.plan) - at(i.planNoUnexpected)) : 0;
  const reachPlan = idx >= 0 ? i.plan[idx].month : null;
  const monthsPlan = idx >= 0 ? idx + 1 : null;
  // só o gasto livre: contas recorrentes da categoria ficam fora do corte
  const cuts = i.items
    .filter((b) => b.avg > planLimit(b))
    .map((b) => ({ category: b.category, label: b.label, avg: b.avg, limit: planLimit(b), committed: b.committed, cut: r2(b.avg - planLimit(b)) }))
    .sort((a, b) => b.cut - a.cut);
  return {
    missing,
    status: reachPlan ? 'onTrack' : 'tooSlow',
    reachPlan,
    monthsPlan,
    savePerMonth: avgBalance(i.plan, Math.min(12, monthsPlan ?? 12)),
    reachToday,
    paceToday,
    cuts,
    unexpected: { amount, delayMonths },
  };
}

/** `goalPlan` com os dados do usuário: projeções de 60 meses com e sem limites. */
export function goalPlanFor(input: FinInput): GoalPlanCalc | null {
  if (!input.goal) return null;
  return goalPlan({
    target: input.goal.target,
    saved: input.saved ?? 0,
    plan: project(input, { plan: true, months: 60 }),
    noPlan: project(input, { plan: false, months: 60 }),
    items: budgetItems(input.txs, input.limits, input.today),
    planNoUnexpected: project(input, { plan: true, months: 60, unexpected: false }),
    unexpected: unexpectedIn(input.txs, monthOf(input.today)),
  });
}

// ───────────────────────── reservas ─────────────────────────
/**
 * Três degraus de reserva, pelo custo de vida do usuário (fixos + variáveis nos limites do plano):
 *  - mínima: 3 meses do essencial (fixos + mercado + saúde) — segura um aperto;
 *  - ideal: 6 meses do custo de vida — perder a renda sem desespero;
 *  - dos sonhos: 12 meses do custo de vida — liberdade pra escolher.
 * A data de cada uma sai da projeção com limites, partindo do guardado.
 */
export const ESSENTIAL_VARIABLE = ['mercado', 'saude'];
export const RESERVE_LEVELS = [
  { id: 'min', label: 'Reserva mínima', months: 3, base: 'essencial' },
  { id: 'ideal', label: 'Reserva ideal', months: 6, base: 'custo' },
  { id: 'dream', label: 'Reserva dos sonhos', months: 12, base: 'custo' },
] as const;
export interface ReserveLevel {
  id: (typeof RESERVE_LEVELS)[number]['id'];
  label: string;
  months: number;
  /** 'essencial' = fixos + mercado + saúde; 'custo' = fixos + todos os variáveis */
  base: 'essencial' | 'custo';
  target: number;
  reached: boolean;
  /** mês em que chega seguindo os limites (null = já chegou ou não chega em 5 anos) */
  reachPlan: string | null;
}
export interface ReserveCalc {
  saved: number;
  /** custo do mês: essencial e custo de vida (nos limites do plano) */
  essential: number;
  monthlyCost: number;
  levels: ReserveLevel[];
}

export function reserveLevels(input: FinInput): ReserveCalc {
  const fixed = sum(fixedCosts(input.txs, input.today).map((f) => f.amount));
  const items = budgetItems(input.txs, input.limits, input.today);
  const essential = r2(fixed + sum(items.filter((b) => ESSENTIAL_VARIABLE.includes(b.category)).map(planLimit)));
  const monthlyCost = r2(fixed + sum(items.map(planLimit)));
  const saved = input.saved ?? 0;
  const plan = project(input, { plan: true, months: 60 });
  return {
    saved,
    essential,
    monthlyCost,
    levels: RESERVE_LEVELS.map((l) => {
      const target = r2(l.months * (l.base === 'essencial' ? essential : monthlyCost));
      const reached = saved >= target;
      return { ...l, target, reached, reachPlan: reached ? null : reachMonth(plan, target) };
    }),
  };
}

/** "Seguindo teus limites, a meta de R$ 10.000,00 chega em dez/26" (valores em R$ pro modo privacidade). */
export function goalSentence(input: FinInput): string | null {
  const g = input.goal;
  const p = goalPlanFor(input);
  if (!g || !p) return null;
  if (p.status === 'reached') return `Meta de ${brl(g.target)} batida! Cria a próxima`;
  if (p.status === 'tooSlow') return `Com os limites de hoje, a meta de ${brl(g.target)} não chega em 5 anos: baixa os limites`;
  return `Seguindo teus limites, a meta de ${brl(g.target)} chega em ${monthLabel(p.reachPlan!)} (guardando uns ${brl(p.savePerMonth)} por mês)`;
}
