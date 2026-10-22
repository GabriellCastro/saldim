import {
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { num } from '../common/money';
import { PrismaService } from '../prisma/prisma.service';
import { FinanceDataService } from '../dashboard/finance-data.service';
import { goalPlanFor, r2, reserveLevels, savedAtMonthStart, type GoalPlanCalc, type ReserveCalc } from '../dashboard/finance';
import type { NextGoalDto, SaveGoalDto } from './dto/goal.dto';

export interface GoalCurrentDto {
  /** reachedAt: dia em que o guardado bateu o alvo (null = ainda não) */
  goal: { id: string; name: string; target: number; reachedAt: string | null } | null;
  /** guardado de agora: base informada + caixinha/investimento importado depois */
  saved: number;
  /** quando a base foi informada */
  savedAt: string | null;
  /** quanto entrou (−saiu) da caixinha neste mês */
  savedMonth: number;
  plan: GoalPlanCalc | null;
  /** reservas mínima, ideal e dos sonhos (independe de ter meta) */
  reserve: ReserveCalc;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const DAY = 86_400_000;

export interface GoalHistoryItem {
  id: string;
  name: string;
  target: number;
  createdAt: string;
  reachedAt: string;
  /** dias entre criar a meta e bater */
  days: number;
  /** ainda é a meta ativa (bateu, mas a próxima não foi criada) */
  active: boolean;
}

export function historyItem(g: { id: string; name: string; target: Prisma.Decimal; createdAt: Date; reachedAt: Date | null; achievedAt: Date | null }): GoalHistoryItem {
  const reached = (g.reachedAt ?? g.achievedAt)!;
  return {
    id: g.id,
    name: g.name,
    target: num(g.target),
    createdAt: iso(g.createdAt),
    reachedAt: iso(reached),
    days: Math.max(0, Math.round((reached.getTime() - g.createdAt.getTime()) / DAY)),
    active: !g.achievedAt,
  };
}

/** Uma meta ativa por vez (`achievedAt` null) + quanto o usuário já guardou. */
@Injectable()
export class GoalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly data: FinanceDataService,
  ) {}

  async current(userId: string): Promise<GoalCurrentDto> {
    const input = await this.data.load(userId);
    const g = input.goal;
    const reachedAt = g ? await this.stampReached(userId, g.id!, g.target, input.saved ?? 0) : null;
    return {
      goal: g
        ? { id: g.id!, name: g.name, target: g.target, reachedAt: reachedAt && iso(reachedAt) }
        : null,
      saved: input.saved ?? 0,
      savedAt: input.savedAt ?? null,
      savedMonth: r2((input.saved ?? 0) - savedAtMonthStart(input)),
      plan: goalPlanFor(input),
      reserve: reserveLevels(input),
    };
  }

  /**
   * Grava o dia em que a meta ativa bateu (a primeira vez que o guardado chega no alvo), pro histórico.
   * Se depois resgatar e cair abaixo, a data fica: ela bateu naquele dia.
   */
  private async stampReached(userId: string, id: string, target: number, saved: number): Promise<Date | null> {
    const goal = await this.prisma.goal.findFirst({ where: { id, userId }, select: { reachedAt: true } });
    if (goal?.reachedAt || saved < target) return goal?.reachedAt ?? null;
    const now = new Date();
    // só carimba se ninguém carimbou antes (duas abas abrindo juntas ficam com a mesma data)
    const { count } = await this.prisma.goal.updateMany({ where: { id, userId, reachedAt: null }, data: { reachedAt: now } });
    if (count) return now;
    return (await this.prisma.goal.findFirst({ where: { id, userId }, select: { reachedAt: true } }))?.reachedAt ?? now;
  }

  private active(userId: string) {
    return this.prisma.goal.findFirst({
      where: { userId, achievedAt: null },
      orderBy: { createdAt: 'asc' },
    });
  }


  /** Cria a meta ativa, ou edita a que existe. */
  async save(userId: string, dto: SaveGoalDto): Promise<GoalCurrentDto> {
    const data = {
      name: dto.name.trim(),
      target: dto.target,
      deadline: null, // a data vem do cálculo
    };
    const goal = await this.active(userId);
    // mudou o alvo: é outra meta, a data em que bateu não vale mais
    if (goal) await this.prisma.goal.update({ where: { id: goal.id }, data: { ...data, ...(num(goal.target) !== dto.target ? { reachedAt: null } : {}) } });
    else
      await this.prisma.goal.create({ data: { userId, ...data } }).catch((e: unknown) => {
        // índice único "uma ativa por usuário": outra aba criou junto
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')
          throw new ConflictException('Tu já tem uma meta ativa. Recarrega a tela.');
        throw e;
      });
    return this.current(userId);
  }

  /** Bateu: a atual vai pro histórico e nasce a próxima com alvo = alvo anterior + incremento. */
  async next(userId: string, dto: NextGoalDto): Promise<GoalCurrentDto> {
    const [goal, user] = await Promise.all([
      this.active(userId),
      this.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    ]);
    if (!goal || (await this.data.saved(userId, user)) < num(goal.target))
      throw new ConflictException('Bate a meta atual antes de criar a próxima');
    await this.prisma.$transaction(async (tx) => {
      // só quem ainda vê a meta ativa passa (duas abas ao mesmo tempo → a segunda leva 409)
      const now = new Date();
      const { count } = await tx.goal.updateMany({ where: { id: goal.id, achievedAt: null }, data: { achievedAt: now, reachedAt: goal.reachedAt ?? now } });
      if (!count) throw new ConflictException('Essa meta já foi atualizada. Recarrega a tela.');
      await tx.goal.create({
        data: {
          userId,
          name: dto.name?.trim() || goal.name,
          target: r2(num(goal.target) + dto.increment),
          deadline: null, // a data vem do cálculo
        },
      });
    });
    return this.current(userId);
  }

  async setSaved(userId: string, amount: number): Promise<GoalCurrentDto> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { savedAmount: amount, savedAt: new Date() },
    });
    return this.current(userId);
  }

  /** Metas batidas (inclusive a ativa, se já bateu), mais recentes primeiro. */
  async history(userId: string): Promise<GoalHistoryItem[]> {
    const rows = await this.prisma.goal.findMany({
      where: { userId, OR: [{ reachedAt: { not: null } }, { achievedAt: { not: null } }] },
    });
    return rows.map(historyItem).sort((a, b) => b.reachedAt.localeCompare(a.reachedAt) || Number(b.active) - Number(a.active));
  }
}
