import { ConflictException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import type { BankConnection } from '@prisma/client';
import { PluggyClient } from 'pluggy-sdk';
import { num } from '../common/money';
import { categorize } from '../categorizer/categorizer';
import { PrismaService } from '../prisma/prisma.service';
import { numberRepeats } from '../imports/dedupe';
import { bankSlug, reconcile, toRows } from './mapping';

/** Na primeira sincronização, quantos dias de histórico buscar. */
const FIRST_SYNC_DAYS = 90;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);
/** 'YYYY-MM-DD' (+/- dias) → Date à meia-noite UTC, como as colunas @db.Date. */
const dayAt = (iso: string, plusDays = 0) => new Date(new Date(`${iso}T00:00:00Z`).getTime() + plusDays * 86_400_000);
/** Conector "MeuPluggy": proxy grátis para as contas que o usuário conectou em meu.pluggy.ai. */
const MEU_PLUGGY = 200;
const SUBTYPE: Record<string, string> = { CHECKING_ACCOUNT: 'Conta corrente', SAVINGS_ACCOUNT: 'Poupança' };
const INSTITUTIONS: Record<string, string> = {
  itau: 'Itaú',
  nubank: 'Nubank',
  bradesco: 'Bradesco',
  santander: 'Santander',
  caixa: 'Caixa',
  inter: 'Inter',
  c6: 'C6 Bank',
  bb: 'Banco do Brasil',
  'banco do brasil': 'Banco do Brasil',
  picpay: 'PicPay',
  mercadopago: 'Mercado Pago',
};
/** "itau" → "Itaú"; desconhecido → primeira letra maiúscula. */
const institutionName = (raw: string) => INSTITUTIONS[raw.trim().toLowerCase()] ?? raw.trim().replace(/^./, (c) => c.toUpperCase());

/**
 * Open Finance via Pluggy. O widget (web) autoriza o banco e devolve um item;
 * aqui a gente confere o dono, lê contas BANK (saldo) e lançamentos postados e grava
 * como um extrato (Import "Open Finance · <banco>"). Credenciais: PLUGGY_CLIENT_ID/SECRET.
 */
@Injectable()
export class OpenFinanceService {
  private readonly logger = new Logger(OpenFinanceService.name);
  private client?: PluggyClient;

  constructor(private readonly prisma: PrismaService) {}

  private pluggy(): PluggyClient {
    const clientId = process.env.PLUGGY_CLIENT_ID;
    const clientSecret = process.env.PLUGGY_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new ServiceUnavailableException('Open Finance não configurado neste servidor');
    this.client ??= new PluggyClient({ clientId, clientSecret });
    return this.client;
  }

  /**
   * Token curto para o widget. Com `itemId` (do próprio usuário), abre em modo atualização.
   * `allowDuplicate`: a Pluggy recusou por já ter um item igual que nunca foi registrado aqui
   * (listar itens é só no plano pago, então não dá pra adotar o antigo) — cria outro; o `register` barra duplicata real.
   */
  async connectToken(userId: string, itemId?: string, allowDuplicate = false) {
    if (itemId) await this.own(userId, itemId);
    const webhookUrl = webhookUrlFromEnv();
    const { accessToken } = await this.pluggy().createConnectToken(itemId, {
      clientUserId: userId,
      avoidDuplicates: !allowDuplicate,
      ...(webhookUrl ? { webhookUrl } : {}),
    });
    return { accessToken };
  }

  async list(userId: string) {
    const rows = await this.prisma.bankConnection.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      include: { accounts: { orderBy: { createdAt: 'asc' } } },
    });
    return rows.map((c) => ({
      id: c.id,
      itemId: c.itemId,
      connector: c.connector,
      imageUrl: c.imageUrl,
      status: c.status,
      error: c.error,
      lastSyncAt: c.lastSyncAt?.toISOString() ?? null,
      accounts: c.accounts.map((a) => ({ id: a.id, label: a.label, balance: a.balance == null ? null : num(a.balance) })),
    }));
  }

  /** Depois do widget: confere que o item é deste usuário, guarda a conexão e sincroniza. */
  async register(userId: string, itemId: string) {
    const item = await this.pluggy().fetchItem(itemId).catch(() => null);
    if (!item || (item.clientUserId && item.clientUserId !== userId)) throw new NotFoundException('Conexão não encontrada');
    const other = await this.prisma.bankConnection.findUnique({ where: { itemId } });
    if (other && other.userId !== userId) throw new NotFoundException('Conexão não encontrada');
    if (!other) {
      // item novo de um banco que já está conectado aqui: revoga o novo em vez de duplicar lançamentos
      const same = await this.prisma.bankConnection.findFirst({ where: { userId, connector: item.connector.name } });
      if (same) {
        await this.pluggy()
          .deleteItem(itemId)
          .catch((e: unknown) => this.logger.warn(`deleteItem ${itemId}: ${e instanceof Error ? e.message : e}`));
        throw new ConflictException(`${item.connector.name} já está conectado. Usa “Atualizar” nele.`);
      }
    }
    const conn = await this.prisma.bankConnection.upsert({
      where: { itemId },
      create: { userId, itemId, connector: item.connector.name, imageUrl: item.connector.imageUrl, status: item.status },
      update: { connector: item.connector.name, imageUrl: item.connector.imageUrl, status: item.status },
    });
    return this.syncConnection(conn);
  }

  async sync(userId: string, id: string) {
    const conn = await this.prisma.bankConnection.findFirst({ where: { id, userId } });
    if (!conn) throw new NotFoundException('Conexão não encontrada');
    return this.syncConnection(conn);
  }

  /** Desconecta: apaga o item na Pluggy (revoga o acesso) e a conexão. Lançamentos já trazidos ficam. */
  async remove(userId: string, id: string): Promise<void> {
    const conn = await this.prisma.bankConnection.findFirst({ where: { id, userId } });
    if (!conn) throw new NotFoundException('Conexão não encontrada');
    await this.pluggy()
      .deleteItem(conn.itemId)
      .catch((e: unknown) => this.logger.warn(`deleteItem ${conn.itemId}: ${e instanceof Error ? e.message : e}`));
    await this.prisma.bankConnection.delete({ where: { id: conn.id } });
  }

  /** Webhook da Pluggy: só dispara sincronização de item que já conhecemos (dados vêm da API, não do payload). */
  async onWebhook(event: { event?: string; itemId?: string }) {
    if (!event.itemId || !/^item\/(created|updated|error|login_succeeded)$/.test(event.event ?? '')) return;
    const conn = await this.prisma.bankConnection.findUnique({ where: { itemId: event.itemId } });
    if (!conn) return;
    void this.syncConnection(conn).catch((e: unknown) =>
      this.logger.warn(`sync via webhook ${conn.itemId}: ${e instanceof Error ? e.message : e}`),
    );
  }

  /** 1ª sync: 90 dias; depois, 7 dias antes do último lançamento trazido (pega o que virou "postado"). */
  private async dateFrom(userId: string, pluggyAccountId: string): Promise<string> {
    const last = await this.prisma.transaction.findFirst({
      where: { userId, externalId: { not: null }, account: { externalId: pluggyAccountId } },
      orderBy: { date: 'desc' },
      select: { date: true },
    });
    const from = last ? last.date.getTime() - 7 * 86_400_000 : Date.now() - FIRST_SYNC_DAYS * 86_400_000;
    return isoDay(new Date(from));
  }

  private async own(userId: string, itemId: string): Promise<BankConnection> {
    const conn = await this.prisma.bankConnection.findFirst({ where: { itemId, userId } });
    if (!conn) throw new NotFoundException('Conexão não encontrada');
    return conn;
  }

  private async syncConnection(conn: BankConnection) {
    const pluggy = this.pluggy();
    const { userId } = conn;
    const item = await pluggy.fetchItem(conn.itemId);
    const slug = bankSlug(item.connector.name);
    const { results: accounts } = await pluggy.fetchAccounts(conn.itemId, 'BANK');
    let imported = 0;
    let linked = 0;

    for (const acc of accounts) {
      // MeuPluggy é um intermediário: o banco de verdade vem no nome da conta ("itau")
      const viaProxy = item.connector.id === MEU_PLUGGY;
      const bankName = viaProxy ? institutionName(acc.name) : item.connector.name;
      const slug = bankSlug(bankName);
      const label = `${bankName} · ${SUBTYPE[acc.subtype] ?? acc.marketingName ?? acc.name}${acc.number ? ` ${acc.number}` : ''}`;

      const txs = await pluggy.fetchAllTransactions(acc.id, { dateFrom: await this.dateFrom(userId, acc.id) });
      const candidates = toRows(txs, null);
      // re-sync revê os últimos dias: tira o que já está gravado
      const known = new Set(
        (
          await this.prisma.transaction.findMany({
            where: { userId, externalId: { in: candidates.map((r) => r.externalId) } },
            select: { externalId: true },
          })
        ).map((t) => t.externalId),
      );
      const rows = candidates.filter((r) => !known.has(r.externalId));

      // o que já veio por arquivo (PDF/OFX/JSON) no mesmo período é o mesmo lançamento com outra descrição
      const dates = rows.map((r) => r.date).sort();
      const fileTxs = dates.length
        ? (
            await this.prisma.transaction.findMany({
              where: {
                userId,
                externalId: null,
                date: { gte: dayAt(dates[0], -3), lte: dayAt(dates[dates.length - 1], 3) },
              },
              select: { id: true, date: true, amount: true, accountId: true, description: true },
              orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
            })
          ).map((t) => ({ id: t.id, date: isoDay(t.date), amount: num(t.amount), accountId: t.accountId, description: t.description }))
        : [];
      const { matches, fresh: unmatched, accountId: fileAccountId } = reconcile(rows, fileTxs);
      // repetidos legítimos (2 cafés iguais no dia) ganham "(2)" pra caber na chave única, como no upload
      const fresh = numberRepeats(unmatched);

      // conta: a já ligada a esta conta da Pluggy → a do extrato com mais pares → mesmo banco por nome → nova
      const unlinked = await this.prisma.bankAccount.findMany({ where: { userId, externalId: null } });
      const existing =
        (await this.prisma.bankAccount.findFirst({ where: { userId, externalId: acc.id } })) ??
        unlinked.find((a) => a.id === fileAccountId) ??
        (acc.subtype === 'CHECKING_ACCOUNT' ? unlinked.find((a) => slug.startsWith(a.bank)) : undefined);
      const data = { label, balance: acc.balance, lastSyncAt: new Date(), externalId: acc.id, connectionId: conn.id };
      const account = existing
        ? await this.prisma.bankAccount.update({ where: { id: existing.id }, data: { ...data, bank: slug } })
        : await this.prisma.bankAccount.create({ data: { userId, bank: slug, ...data } });

      // pares: o lançamento do arquivo passa a ser o do Open Finance (mantém descrição e categoria já revisadas)
      if (matches.length)
        await this.prisma.$transaction(
          matches.map((m) =>
            this.prisma.transaction.update({ where: { id: m.fileId }, data: { externalId: m.externalId, accountId: account.id } }),
          ),
        );
      linked += matches.length;
      if (!fresh.length) continue;

      const freshDates = fresh.map((r) => r.date).sort();
      const imp = await this.prisma.import.create({
        data: {
          userId,
          accountId: account.id,
          kind: 'EXTRATO',
          fileName: `Open Finance · ${bankName}`,
          periodStart: dayAt(freshDates[0]),
          periodEnd: dayAt(freshDates[freshDates.length - 1]),
        },
      });
      const { count } = await this.prisma.transaction.createMany({
        data: fresh.map((r) => ({
          userId,
          accountId: account.id,
          importId: imp.id,
          externalId: r.externalId,
          date: dayAt(r.date),
          description: r.description,
          amount: r.amount,
          category: categorize(r.description, r.amount),
        })),
        skipDuplicates: true,
      });
      await this.prisma.import.update({ where: { id: imp.id }, data: { status: 'DONE', count } });
      imported += count;
    }

    await this.prisma.bankConnection.update({
      where: { id: conn.id },
      data: {
        status: item.status,
        error: item.error?.message ?? null,
        lastSyncAt: new Date(),
        connector: item.connector.name,
        imageUrl: item.connector.imageUrl,
      },
    });
    return { status: item.status, accounts: accounts.length, imported, linked };
  }
}

/** URL pública do webhook (opcional): PLUGGY_WEBHOOK_URL + ?secret=PLUGGY_WEBHOOK_SECRET. */
function webhookUrlFromEnv(): string | null {
  const base = process.env.PLUGGY_WEBHOOK_URL;
  const secret = process.env.PLUGGY_WEBHOOK_SECRET;
  if (!base || !secret) return null;
  const url = new URL(base);
  url.searchParams.set('secret', secret);
  return url.toString();
}
