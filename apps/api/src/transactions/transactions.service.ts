import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Transaction } from '@prisma/client';
import { CATEGORY_BY_ID } from '../categories/categories';
import { UNEXPECTED_BY_ID, UNEXPECTED_TYPES } from '../categories/unexpected';
import { num } from '../common/money';
import { r2 } from '../dashboard/finance';
import { PrismaService } from '../prisma/prisma.service';
import { ListTransactionsDto } from './dto/list-transactions.dto';
import type { UnexpectedQueryDto } from './dto/unexpected-query.dto';
import type { UpdateTransactionDto } from './dto/update-transaction.dto';

export const toTxDto = (t: Transaction) => ({
  id: t.id,
  date: t.date.toISOString().slice(0, 10),
  description: t.description,
  amount: num(t.amount),
  category: t.category,
  categoryLabel: CATEGORY_BY_ID.get(t.category)?.label ?? t.category,
  unexpected: t.unexpected,
  unexpectedLabel: t.unexpected ? (UNEXPECTED_BY_ID.get(t.unexpected)?.label ?? t.unexpected) : null,
  unexpectedNote: t.unexpectedNote,
});

/** Intervalo [início, início do mês seguinte) de um mês `YYYY-MM`, em UTC. */
export function monthRange(month: string): { gte: Date; lt: Date } {
  const [y, m] = month.split('-').map(Number);
  return { gte: new Date(Date.UTC(y, m - 1, 1)), lt: new Date(Date.UTC(y, m, 1)) };
}

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, q: ListTransactionsDto) {
    const take = q.take ?? 50;
    const where: Prisma.TransactionWhereInput = {
      userId,
      ...(q.month ? { date: monthRange(q.month) } : {}),
      ...(q.category ? { category: q.category } : {}),
    };
    if (q.cursor) {
      const exists = await this.prisma.transaction.findFirst({ where: { id: q.cursor, userId }, select: { id: true } });
      if (!exists) throw new NotFoundException('cursor inválido');
    }
    const rows = await this.prisma.transaction.findMany({
      where,
      orderBy: [{ date: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }],
      take: take + 1,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > take;
    const items = rows.slice(0, take);
    return { items: items.map(toTxDto), nextCursor: hasMore ? items[items.length - 1].id : null };
  }

  /** Recategoriza e/ou marca/desmarca imprevisto (só saídas). */
  async update(userId: string, id: string, dto: UpdateTransactionDto) {
    const tx = await this.prisma.transaction.findFirst({ where: { id, userId } });
    if (!tx) throw new NotFoundException('Lançamento não encontrado');
    if (dto.category === undefined && dto.unexpected === undefined && dto.unexpectedNote === undefined)
      throw new BadRequestException('Nada pra mudar');
    const data: Prisma.TransactionUpdateInput = {};
    if (dto.category) data.category = dto.category;
    if (dto.unexpected === null) Object.assign(data, { unexpected: null, unexpectedNote: null });
    else {
      if (dto.unexpected) {
        if (num(tx.amount) >= 0) throw new BadRequestException('Só gasto (saída) pode ser imprevisto');
        data.unexpected = dto.unexpected;
      }
      if (dto.unexpectedNote !== undefined) {
        if (!dto.unexpected && !tx.unexpected) throw new BadRequestException('Marca o tipo do imprevisto antes da justificativa');
        data.unexpectedNote = dto.unexpectedNote?.trim() || null;
      }
    }
    return toTxDto(await this.prisma.transaction.update({ where: { id }, data }));
  }

  /** Imprevistos de um mês (padrão: o do lançamento mais recente) ou de tudo: total, por tipo e a lista. */
  async unexpected(userId: string, q: UnexpectedQueryDto) {
    let month = q.month;
    if (!month) {
      const latest = await this.prisma.transaction.findFirst({ where: { userId }, orderBy: { date: 'desc' }, select: { date: true } });
      month = (latest?.date ?? new Date()).toISOString().slice(0, 7);
    }
    const rows = await this.prisma.transaction.findMany({
      where: { userId, unexpected: { not: null }, amount: { lt: 0 }, ...(month === 'all' ? {} : { date: monthRange(month) }) },
      orderBy: [{ date: 'desc' }, { id: 'asc' }],
    });
    const items = rows.map(toTxDto);
    const byType = UNEXPECTED_TYPES.map((u) => {
      const of = items.filter((t) => t.unexpected === u.id);
      return { type: u.id, label: u.label, count: of.length, amount: r2(-of.reduce((a, t) => a + t.amount, 0)) };
    })
      .filter((g) => g.count)
      .sort((a, b) => b.amount - a.amount);
    return { month, total: r2(-items.reduce((a, t) => a + t.amount, 0)), count: items.length, byType, items };
  }
}
