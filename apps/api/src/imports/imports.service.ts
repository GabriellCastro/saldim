import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { Import } from '@prisma/client';
import { AccountsService } from '../accounts/accounts.service';
import { categorize } from '../categorizer/categorizer';
import { shiftDay } from '../open-finance/mapping';
import { PrismaService } from '../prisma/prisma.service';
import { numberRepeats, onlyNew } from './dedupe';
import { ParsedStatement, parseStatement, StatementParseError } from './parsers';

const isoDate = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const toDate = (iso?: string) => (iso ? new Date(`${iso}T00:00:00Z`) : undefined);

export const toImportDto = (i: Import) => ({
  id: i.id,
  kind: i.kind,
  status: i.status,
  fileName: i.fileName,
  count: i.count,
  periodStart: isoDate(i.periodStart),
  periodEnd: isoDate(i.periodEnd),
  error: i.error,
  createdAt: i.createdAt.toISOString(),
});

@Injectable()
export class ImportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accounts: AccountsService,
  ) {}

  async list(userId: string) {
    const rows = await this.prisma.import.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
    return rows.map(toImportDto);
  }

  /** Upload de extrato: detecta formato, faz parse e grava. Falha de leitura → Import FAILED + 422. */
  async importExtratoFile(userId: string, fileName: string, buf: Buffer) {
    let parsed: ParsedStatement;
    try {
      parsed = await parseStatement(buf, fileName);
    } catch (e) {
      const message = e instanceof StatementParseError ? e.message : 'Não consegui ler o arquivo';
      await this.prisma.import.create({
        data: { userId, kind: 'EXTRATO', status: 'FAILED', fileName, error: message },
      });
      throw new UnprocessableEntityException(message);
    }
    return this.importParsed(userId, fileName, parsed);
  }

  /** Grava um extrato já normalizado (usado pelo upload e pelo seed). Duplicados são ignorados. */
  async importParsed(userId: string, fileName: string, parsed: ParsedStatement) {
    const account = await this.accounts.upsertSynced(userId, 'itau', {
      label: parsed.accountLabel,
      balance: parsed.balance,
    });
    const dates = parsed.rows.map((r) => r.date).sort();
    const periodStart = parsed.periodStart ?? dates[0];
    const periodEnd = parsed.periodEnd ?? dates[dates.length - 1];

    const imp = await this.prisma.import.create({
      data: {
        userId,
        accountId: account.id,
        kind: 'EXTRATO',
        fileName,
        periodStart: toDate(periodStart),
        periodEnd: toDate(periodEnd),
      },
    });

    try {
      const rows = numberRepeats(parsed.rows);
      // o que já está na conta (de outro extrato ou do Open Finance), com folga de 3 dias pras datas que diferem
      const existing = dates.length
        ? await this.prisma.transaction.findMany({
            where: {
              userId,
              accountId: account.id,
              date: { gte: toDate(shiftDay(dates[0], -3)), lte: toDate(shiftDay(dates[dates.length - 1], 3)) },
            },
            select: { id: true, date: true, description: true, amount: true, accountId: true },
            orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
          })
        : [];
      const fresh = onlyNew(
        rows,
        existing.map((t) => ({ ...t, date: isoDate(t.date)!, amount: Number(t.amount) })),
      );

      const { count } = await this.prisma.transaction.createMany({
        data: fresh.map((r) => ({
          userId,
          accountId: account.id,
          importId: imp.id,
          date: toDate(r.date)!,
          description: r.description,
          amount: r.amount,
          category: r.category ?? categorize(r.description, r.amount),
        })),
        skipDuplicates: true,
      });
      const done = await this.prisma.import.update({ where: { id: imp.id }, data: { status: 'DONE', count } });
      return toImportDto(done);
    } catch (e) {
      await this.prisma.import.update({
        where: { id: imp.id },
        data: { status: 'FAILED', error: e instanceof Error ? e.message : String(e) },
      });
      throw e;
    }
  }
}
