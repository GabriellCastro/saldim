import { Injectable, NotFoundException } from '@nestjs/common';
import { num } from '../common/money';
import { PrismaService } from '../prisma/prisma.service';
import { FinanceDataService } from './finance-data.service';
import { actualVsPlan, addMonths, alerts, monthDetail, incomeOf, monthOf, overview, project, reachMonth, spendingByCategory, spendingInsight } from './finance';
import type { MonthQueryDto, ProjectionQueryDto, SpendingQueryDto } from './dto/dashboard-query.dto';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly data: FinanceDataService,
  ) {}

  async overview(userId: string, q: MonthQueryDto) {
    const input = await this.data.load(userId, q);
    // conta principal: a que tem lançamentos (poupança zerada do Open Finance não vira "a conta")
    const order = [{ lastSyncAt: { sort: 'desc' as const, nulls: 'last' as const } }, { createdAt: 'asc' as const }];
    const account =
      (await this.prisma.bankAccount.findFirst({ where: { userId, transactions: { some: {} } }, orderBy: order })) ??
      (await this.prisma.bankAccount.findFirst({ where: { userId }, orderBy: order }));
    const ov = overview(input);
    return {
      ...ov,
      account: {
        label: account?.label ?? 'Nenhuma conta',
        lastSyncAt: account?.lastSyncAt?.toISOString() ?? null,
        balance: account?.balance == null ? null : num(account.balance),
      },
      alertsCount: alerts(input).length,
    };
  }

  /**
   * Gastos por categoria. Padrão: mês anterior a "hoje" (o último mês fechado, como no design).
   * `month=all` soma todos os meses; o % fica sobre a renda mensal × nº de meses.
   * `months` lista os meses com lançamentos (mais recente primeiro) para o filtro do web.
   */
  async spending(userId: string, q: SpendingQueryDto) {
    const today = await this.data.resolveToday(userId, { today: q.today });
    const months = await this.monthsWithTransactions(userId);
    const all = q.month === 'all';
    const month = all ? null : (q.month ?? addMonths(monthOf(today), -1));
    const since = all ? (months[months.length - 1] ?? monthOf(today)) : month!;
    const input = await this.data.load(userId, { today, since });
    const monthly = incomeOf(input).total;
    const income = Math.round(monthly * (all ? Math.max(months.length, 1) : 1) * 100) / 100;
    const byCategory = spendingByCategory(input.txs, month, income);
    return {
      month: month ?? 'all',
      months,
      total: Math.round(byCategory.reduce((a, c) => a + c.amount, 0) * 100) / 100,
      income,
      byCategory,
      insight: spendingInsight(input.txs, input.today, month),
    };
  }

  private async monthsWithTransactions(userId: string): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<{ m: string }[]>`
      SELECT DISTINCT to_char("date", 'YYYY-MM') AS m FROM "Transaction" WHERE "userId" = ${userId} ORDER BY m DESC`;
    return rows.map((r) => r.m);
  }

  /** Detalhe de um mês da tabela da Projeção (2 meses pra trás até 35 pra frente). */
  async month(userId: string, month: string) {
    const input = await this.data.load(userId);
    const d = monthDetail(input, month);
    if (!d) throw new NotFoundException('Mês fora do intervalo da projeção');
    return d;
  }

  async projection(userId: string, q: ProjectionQueryDto) {
    const input = await this.data.load(userId, { today: q.today });
    const opts = { months: q.months ?? 15, countOther: q.countOther ?? true };
    const plan = q.plan ?? true;
    const withPlan = project(input, { ...opts, plan: true });
    const noPlan = project(input, { ...opts, plan: false });
    const g = input.goal;
    return {
      months: plan ? withPlan : noPlan,
      goal: g
        ? {
            name: g.name,
            target: g.target,
            deadline: g.deadline,
            reachedAt: reachMonth(plan ? withPlan : noPlan, g.target),
            reachedAtPlan: reachMonth(withPlan, g.target),
            reachedAtNoPlan: reachMonth(noPlan, g.target),
          }
        : null,
      plan,
      alt: (plan ? noPlan : withPlan).map((m) => ({ month: m.month, balance: m.balance, reserve: m.reserve })),
      // o que aconteceu de verdade × o plano da IA (mês atual até hoje + 2 meses fechados)
      actual: actualVsPlan(input),
    };
  }
}
