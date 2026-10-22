import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { num } from '../common/money';
import { PrismaService } from '../prisma/prisma.service';
import {
  addMonths,
  flowAfterBase,
  daysInMonth,
  monthOf,
  resolveToday,
  savedTotal,
  type FinInput,
  type FinPayslipItem,
} from './finance';

export interface LoadOpts {
  /** força o "hoje" (YYYY-MM-DD); padrão = data do lançamento mais recente */
  today?: string;
  /** mês de referência (YYYY-MM); se for outro mês, "hoje" vira o último dia dele */
  month?: string;
  /** carrega lançamentos desde este mês (além da janela padrão de 3 meses antes de "hoje") */
  since?: string;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Carrega do banco tudo que as funções puras de `finance.ts` precisam (sempre filtrando por userId). */
@Injectable()
export class FinanceDataService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveToday(userId: string, opts: LoadOpts = {}): Promise<string> {
    const latest = await this.prisma.transaction.findFirst({
      where: { userId },
      orderBy: { date: 'desc' },
      select: { date: true },
    });
    let today = resolveToday(latest ? [{ date: iso(latest.date) }] : [], opts.today);
    if (opts.month && opts.month !== monthOf(today)) {
      today = opts.month < monthOf(today) ? `${opts.month}-${daysInMonth(opts.month)}` : `${opts.month}-01`;
    }
    return today;
  }

  /**
   * Guardado de agora: a base que o usuário informou (`savedAmount` em `savedAt`) + caixinha/investimento
   * que veio depois dela (ver `flowAfterBase`). Sem base, soma a caixinha de todo o histórico.
   */
  async saved(userId: string, user: { savedAmount: Prisma.Decimal; savedAt: Date | null }): Promise<number> {
    const rows = await this.prisma.transaction.findMany({
      where: { userId, category: 'investimento', ...(user.savedAt ? { createdAt: { gt: user.savedAt } } : {}) },
      select: { amount: true, date: true, createdAt: true },
    });
    const base = user.savedAt?.toISOString();
    const flows = rows.filter((t) => !base || flowAfterBase({ date: iso(t.date), createdAt: t.createdAt.toISOString() }, base));
    return savedTotal(num(user.savedAmount), flows.map((t) => num(t.amount)));
  }

  async load(userId: string, opts: LoadOpts = {}): Promise<FinInput> {
    const today = await this.resolveToday(userId, opts);
    let fromMonth = addMonths(monthOf(today), -3);
    if (opts.since && opts.since < fromMonth) fromMonth = opts.since;

    const [user, txs, loans, limits, payslip, goal, accounts] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      this.prisma.transaction.findMany({
        where: { userId, date: { gte: new Date(`${fromMonth}-01`), lte: new Date(today) } },
        orderBy: { date: 'desc' },
        select: { date: true, description: true, amount: true, category: true, unexpected: true, unexpectedNote: true },
      }),
      this.prisma.loan.findMany({ where: { userId } }),
      this.prisma.categoryLimit.findMany({ where: { userId } }),
      this.prisma.payslip.findFirst({ where: { userId }, orderBy: { month: 'desc' } }),
      this.prisma.goal.findFirst({ where: { userId, achievedAt: null }, orderBy: [{ deadline: 'asc' }, { createdAt: 'asc' }] }),
      this.prisma.bankAccount.findMany({ where: { userId, balance: { not: null } }, select: { balance: true } }),
    ]);

    return {
      today,
      txs: txs.map((t) => ({
        date: iso(t.date),
        description: t.description,
        amount: num(t.amount),
        category: t.category,
        unexpected: t.unexpected,
        unexpectedNote: t.unexpectedNote,
      })),
      loans: loans.map((l) => ({
        name: l.name,
        source: l.source,
        installment: num(l.installment),
        currentInstallment: l.currentInstallment,
        totalInstallments: l.totalInstallments,
      })),
      limits: Object.fromEntries(limits.map((l) => [l.category, num(l.amount)])),
      payslip: payslip
        ? {
            month: payslip.month,
            gross: num(payslip.gross),
            net: num(payslip.net),
            items: (Array.isArray(payslip.items) ? payslip.items : []) as unknown as FinPayslipItem[],
          }
        : null,
      netIncome: user.netIncome == null ? null : num(user.netIncome),
      grossIncome: user.grossIncome == null ? null : num(user.grossIncome),
      otherIncome: user.otherIncome == null ? null : num(user.otherIncome),
      goal: goal ? { id: goal.id, name: goal.name, target: num(goal.target), deadline: goal.deadline ? iso(goal.deadline) : null } : null,
      saved: await this.saved(userId, user),
      savedAt: user.savedAt?.toISOString() ?? null,
      // mesmo "saldo atual" da tela Gastos: soma das contas que informaram saldo
      balance: accounts.length ? accounts.reduce((a, c) => a + num(c.balance!), 0) : null,
    };
  }
}
