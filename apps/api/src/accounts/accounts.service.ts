import { Injectable } from '@nestjs/common';
import { BankAccount } from '@prisma/client';
import { num } from '../common/money';
import { PrismaService } from '../prisma/prisma.service';

export const toAccountDto = (a: BankAccount) => ({
  id: a.id,
  bank: a.bank,
  label: a.label,
  balance: a.balance == null ? null : num(a.balance),
  lastSyncAt: a.lastSyncAt?.toISOString() ?? null,
});

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const accounts = await this.prisma.bankAccount.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
    return accounts.map(toAccountDto);
  }

  /** Cria (ou atualiza) a conta do banco do usuário e marca a sincronização. */
  async upsertSynced(userId: string, bank: string, opts: { label?: string; balance?: number }) {
    const data = {
      lastSyncAt: new Date(),
      ...(opts.label ? { label: opts.label } : {}),
      ...(opts.balance != null ? { balance: opts.balance } : {}),
    };
    const existing = await this.prisma.bankAccount.findFirst({ where: { userId, bank }, orderBy: { createdAt: 'asc' } });
    if (existing) return this.prisma.bankAccount.update({ where: { id: existing.id }, data });
    return this.prisma.bankAccount.create({
      data: { userId, bank, label: opts.label ?? 'Itaú', ...data },
    });
  }
}
