import { Injectable, NotFoundException } from '@nestjs/common';
import { Loan } from '@prisma/client';
import { num } from '../common/money';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLoanDto, UpdateLoanDto } from './dto/loan.dto';
import { loanKpis, loanStatus } from './loan-math';

const plain = (l: Loan) => ({
  source: l.source,
  installment: num(l.installment),
  currentInstallment: l.currentInstallment,
  totalInstallments: l.totalInstallments,
});

export const toLoanDto = (l: Loan, now = new Date()) => ({
  id: l.id,
  name: l.name,
  ...plain(l),
  ...loanStatus(plain(l), now),
});

@Injectable()
export class LoansService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const loans = await this.prisma.loan.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
    return {
      items: loans.map((l) => toLoanDto(l)),
      kpis: loanKpis(loans.map(plain), await this.contaFromTransactions(userId)),
    };
  }

  async create(userId: string, dto: CreateLoanDto) {
    return toLoanDto(await this.prisma.loan.create({ data: { userId, ...dto } }));
  }

  async update(userId: string, id: string, dto: UpdateLoanDto) {
    await this.findOwn(userId, id);
    return toLoanDto(await this.prisma.loan.update({ where: { id }, data: dto }));
  }

  async remove(userId: string, id: string) {
    await this.findOwn(userId, id);
    await this.prisma.loan.delete({ where: { id } });
  }

  private async findOwn(userId: string, id: string) {
    const loan = await this.prisma.loan.findFirst({ where: { id, userId } });
    if (!loan) throw new NotFoundException('Empréstimo não encontrado');
    return loan;
  }

  /** Média mensal dos débitos "emprestimo" na conta nos 2 últimos meses com lançamento (como o design). */
  private async contaFromTransactions(userId: string) {
    const rows = await this.prisma.transaction.findMany({
      where: { userId, category: 'emprestimo' },
      select: { date: true, amount: true },
    });
    const byMonth = new Map<string, number>();
    for (const r of rows) {
      const m = r.date.toISOString().slice(0, 7);
      byMonth.set(m, (byMonth.get(m) ?? 0) - num(r.amount));
    }
    const last = [...byMonth.keys()].sort().slice(-2);
    return last.length ? last.reduce((a, m) => a + byMonth.get(m)!, 0) / last.length : 0;
  }
}
