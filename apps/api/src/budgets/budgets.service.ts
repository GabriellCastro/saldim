import { BadRequestException, Injectable } from '@nestjs/common';
import { VARIABLE_IDS } from '../categories/categories';
import { PrismaService } from '../prisma/prisma.service';
import { FinanceDataService } from '../dashboard/finance-data.service';
import { budgetItems, daysInMonth, dayOf, monthOf, r2 } from '../dashboard/finance';
import type { MonthQueryDto } from '../dashboard/dto/dashboard-query.dto';

@Injectable()
export class BudgetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly data: FinanceDataService,
  ) {}

  async list(userId: string, q: MonthQueryDto) {
    const input = await this.data.load(userId, q);
    const month = monthOf(input.today);
    const items = budgetItems(input.txs, input.limits, input.today);
    const total = (k: 'spent' | 'limit' | 'avg') => r2(items.reduce((a, i) => a + i[k], 0));
    return {
      month,
      day: dayOf(input.today),
      daysInMonth: daysInMonth(month),
      items,
      totals: { spent: total('spent'), limit: total('limit'), avg: total('avg') },
    };
  }

  async set(userId: string, category: string, amount: number) {
    if (!VARIABLE_IDS.includes(category)) {
      throw new BadRequestException(`Categoria sem limite: ${category}. Use uma variável (${VARIABLE_IDS.join(', ')}).`);
    }
    await this.prisma.categoryLimit.upsert({
      where: { userId_category: { userId, category } },
      create: { userId, category, amount },
      update: { amount },
    });
    const input = await this.data.load(userId);
    return budgetItems(input.txs, input.limits, input.today).find((i) => i.category === category)!;
  }
}
