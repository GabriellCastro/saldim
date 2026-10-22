import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { FinanceDataService } from '../dashboard/finance-data.service';
import { GoalsService, historyItem } from './goals.service';

const D = (v: number) => new Prisma.Decimal(v);

function setup(active: { target: number } | null, saved: number, race = false, deposits: number[] = []) {
  const goal = active && {
    id: 'g1',
    userId: 'u1',
    name: 'Reserva',
    target: D(active.target),
    deadline: new Date('2026-12-31'),
    createdAt: new Date(),
    achievedAt: null,
  };
  const created: unknown[] = [];
  const tx = {
    goal: {
      updateMany: jest.fn(() => Promise.resolve({ count: race ? 0 : 1 })),
      create: jest.fn(({ data }: { data: object }) => {
        created.push(data);
        return Promise.resolve({
          id: 'g2',
          createdAt: new Date(),
          achievedAt: null,
          ...data,
        });
      }),
    },
  };
  const prisma = {
    goal: { findFirst: jest.fn(() => Promise.resolve(goal)) },
    user: {
      findUniqueOrThrow: jest.fn(() =>
        Promise.resolve({ savedAmount: D(saved), savedAt: new Date('2026-10-19T20:47:00Z') }),
      ),
    },
    transaction: { findMany: jest.fn(() => Promise.resolve(deposits.map((v) => ({ amount: D(-v), date: new Date('2026-10-20'), createdAt: new Date('2026-10-20T15:00:00Z') })))) },
    $transaction: jest.fn((fn: (t: typeof tx) => unknown) =>
      Promise.resolve(fn(tx)),
    ),
  };
  const svc = new GoalsService(prisma as never, new FinanceDataService(prisma as never));
  jest
    .spyOn(svc, 'current')
    .mockResolvedValue({ goal: null, saved, savedAt: null, savedMonth: 0, plan: null, reserve: { saved, essential: 0, monthlyCost: 0, levels: [] } });
  return { svc, tx, created };
}

describe('GoalsService.next: nova meta somando na atual', () => {
  it('soma o incremento no alvo anterior (não no guardado) e marca a atual como batida', async () => {
    const { svc, tx, created } = setup({ target: 10000 }, 12000);
    await svc.next('u1', { increment: 5000 });
    expect(tx.goal.updateMany).toHaveBeenCalledWith({
      where: { id: 'g1', achievedAt: null },
      data: { achievedAt: expect.any(Date), reachedAt: expect.any(Date) },
    });
    expect(created[0]).toMatchObject({
      userId: 'u1',
      name: 'Reserva',
      target: 15000,
      deadline: null,
    });
  });

  it('recusa se a meta atual não foi batida', async () => {
    const { svc } = setup({ target: 10000 }, 9000);
    await expect(
      svc.next('u1', { increment: 5000 }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('conta o que foi pro cofrinho depois do guardado informado', async () => {
    const { svc, created } = setup({ target: 10000 }, 9000, false, [600, 400]);
    await svc.next('u1', { increment: 5000 });
    expect(created).toHaveLength(1);
  });

  it('duas abas ao mesmo tempo: a segunda não cria outra meta ativa', async () => {
    const { svc, created } = setup({ target: 10000 }, 12000, true);
    await expect(svc.next('u1', { increment: 5000 })).rejects.toBeInstanceOf(ConflictException);
    expect(created).toHaveLength(0);
  });
});

describe('GoalsService.save: uma meta ativa por usuário', () => {
  it('se outra aba criou a meta ao mesmo tempo (índice único), responde 409', async () => {
    const dup = new Prisma.PrismaClientKnownRequestError('Unique constraint', { code: 'P2002', clientVersion: 'x' });
    const prisma = {
      goal: {
        findFirst: jest.fn(() => Promise.resolve(null)),
        create: jest.fn(() => Promise.reject(dup)),
      },
    };
    const svc = new GoalsService(prisma as never, new FinanceDataService(prisma as never));
    await expect(svc.save('u1', { name: 'Reserva', target: 1000 })).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('reachedAt: o dia em que a meta bateu', () => {
  const goal = { id: 'g1', userId: 'u1', name: 'Reserva', target: D(10000), deadline: null, createdAt: new Date('2026-06-01T12:00:00Z'), achievedAt: null };

  function svcWith(row: { reachedAt: Date | null }, count = 1) {
    const prisma = {
      goal: {
        findFirst: jest.fn(() => Promise.resolve({ ...goal, ...row })),
        updateMany: jest.fn(() => Promise.resolve({ count })),
        update: jest.fn(() => Promise.resolve({})),
      },
    };
    const svc = new GoalsService(prisma as never, new FinanceDataService(prisma as never));
    return { svc, prisma };
  }
  const stamp = (svc: GoalsService, saved: number) =>
    (svc as unknown as { stampReached: (u: string, id: string, t: number, s: number) => Promise<Date | null> }).stampReached('u1', 'g1', 10000, saved);

  it('carimba quando o guardado chega no alvo', async () => {
    const { svc, prisma } = svcWith({ reachedAt: null });
    expect(await stamp(svc, 10000)).toBeInstanceOf(Date);
    expect(prisma.goal.updateMany).toHaveBeenCalledWith({ where: { id: 'g1', userId: 'u1', reachedAt: null }, data: { reachedAt: expect.any(Date) } });
  });

  it('não mexe se ainda falta, nem se já tinha data (resgatou depois de bater)', async () => {
    const a = svcWith({ reachedAt: null });
    expect(await stamp(a.svc, 9999)).toBeNull();
    const when = new Date('2026-09-10T12:00:00Z');
    const b = svcWith({ reachedAt: when });
    expect(await stamp(b.svc, 5000)).toBe(when);
    expect(a.prisma.goal.updateMany).not.toHaveBeenCalled();
    expect(b.prisma.goal.updateMany).not.toHaveBeenCalled();
  });

  it('mudar o alvo zera a data; mudar só o nome mantém', async () => {
    const { svc, prisma } = svcWith({ reachedAt: new Date() });
    jest.spyOn(svc, 'current').mockResolvedValue(null as never);
    await svc.save('u1', { name: 'Reserva', target: 15000 });
    expect(prisma.goal.update).toHaveBeenLastCalledWith({ where: { id: 'g1' }, data: expect.objectContaining({ target: 15000, reachedAt: null }) });
    await svc.save('u1', { name: 'Viagem', target: 10000 });
    expect(prisma.goal.update).toHaveBeenLastCalledWith({ where: { id: 'g1' }, data: expect.not.objectContaining({ reachedAt: null }) });
  });

  it('histórico: dias até bater; metas antigas sem reachedAt usam achievedAt', () => {
    expect(historyItem({ ...goal, reachedAt: new Date('2026-09-30T12:00:00Z'), achievedAt: null })).toMatchObject({ reachedAt: '2026-09-30', days: 121, active: true });
    expect(historyItem({ ...goal, reachedAt: null, achievedAt: new Date('2026-07-01T12:00:00Z') })).toMatchObject({ reachedAt: '2026-07-01', days: 30, active: false });
  });
});
