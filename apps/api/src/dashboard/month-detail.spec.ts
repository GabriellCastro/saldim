import { actualVsPlan, monthDetail, project } from './finance';
import { designInput } from './finance.fixture';

describe('monthDetail: detalhe de um mês da projeção', () => {
  const i = { ...designInput(), saved: 2000 };

  it('mês atual: real até hoje × plano (= projeção do mês 0), somas batendo com o real × plano', () => {
    const d = monthDetail(i, '2026-10')!;
    const a = actualVsPlan(i).at(-1)!;
    const m0 = project(i, { months: 1 })[0];
    expect(d.kind).toBe('current');
    expect(d.totals.plan.balance).toBe(m0.balance);
    expect(d.totals.real!.out).toBeCloseTo(a.real.out, 2);
    expect(d.reserve).toMatchObject({ real: 2000, plan: m0.reserve });
    expect(d.variable.lines.length).toBeGreaterThan(0);
    expect(d.prev).toBe('2026-09');
    expect(d.next).toBe('2026-11');
  });

  it('mês fechado: real completo, sem reserva', () => {
    const d = monthDetail(i, '2026-09')!;
    expect(d.kind).toBe('past');
    expect(d.totals.real!.out).toBeCloseTo(actualVsPlan(i)[1].real.out, 2);
    expect(d.reserve.plan).toBeNull();
  });

  it('mês futuro: sem real, plano e "como o mês passado" da projeção; 13º vira evento', () => {
    const d = monthDetail(i, '2026-11')!;
    const p = project(i, { months: 2 })[1];
    expect(d.kind).toBe('future');
    expect(d.totals.real).toBeNull();
    expect(d.totals.plan.balance).toBe(p.balance);
    expect(d.income.lines.find((l) => l.id === '13')!.plan).toBe(p.extra);
    expect(d.events.some((e) => e.includes('13º'))).toBe(true);
  });

  it('mês atual com saldo do banco: sobra real = saldo', () => {
    expect(monthDetail({ ...i, balance: 4331.25 }, '2026-10')!.totals.real!.balance).toBe(4331.25);
  });

  it('fora do intervalo → null', () => {
    expect(monthDetail(i, '2026-07')).toBeNull();
    expect(monthDetail(i, '2030-01')).toBeNull();
  });
});
