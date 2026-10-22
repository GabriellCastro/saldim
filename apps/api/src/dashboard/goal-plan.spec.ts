import { budgetItems, goalPlan, goalPlanFor, limitOf, project, recurringCharges, type BudgetItem, type FinTx, type GoalPlanInput } from './finance';
import { designInput } from './finance.fixture';

const item = (category: string, avg: number, limit: number, committed = 0): BudgetItem => ({
  category,
  label: category,
  avg,
  limit,
  committed,
  spent: 0,
  ratio: 0,
  status: 'ok',
});
/** 60 meses a partir de out/26 com saldo fixo; reserva acumulada parte do guardado (como `project`). */
const months = (balance: number, saved = 0) =>
  Array.from({ length: 60 }, (_, i) => ({
    month: new Date(Date.UTC(2026, 9 + i, 1)).toISOString().slice(0, 7),
    balance,
    reserve: saved + balance * (i + 1),
  }));
const base: GoalPlanInput = {
  target: 10000,
  saved: 0,
  plan: months(2500),
  noPlan: months(-400),
  items: [item('lanches', 1700, 700), item('mercado', 1200, 1200), item('compras', 1200, 300)],
};

describe('goalPlan: quando bate a meta seguindo os limites', () => {
  it('data pela projeção com limites; no ritmo de hoje, nunca (gastos passam da renda)', () => {
    const r = goalPlan(base);
    expect(r.status).toBe('onTrack');
    expect(r.reachPlan).toBe('2027-01'); // 4 × 2500
    expect(r.monthsPlan).toBe(4);
    expect(r.savePerMonth).toBe(2500);
    expect(r.reachToday).toBeNull();
    expect(r.paceToday).toBe(-400);
    expect(r.missing).toBe(10000);
  });

  it('o guardado adianta a data (a reserva da projeção já parte dele)', () => {
    const r = goalPlan({ ...base, saved: 5000, plan: months(2500, 5000), noPlan: months(-400, 5000) });
    expect(r.reachPlan).toBe('2026-11');
    expect(r.missing).toBe(5000);
  });

  it('onde o plano corta: categorias acima do limite, maior corte primeiro', () => {
    expect(goalPlan(base).cuts).toEqual([
      { category: 'lanches', label: 'lanches', avg: 1700, limit: 700, committed: 0, cut: 1000 },
      { category: 'compras', label: 'compras', avg: 1200, limit: 300, committed: 0, cut: 900 },
    ]);
  });

  it('não corta conta recorrente: o limite do plano nunca fica abaixo dela', () => {
    const r = goalPlan({ ...base, items: [item('educacao', 600, 136, 500), item('assinaturas', 100, 110, 150)] });
    expect(r.cuts).toEqual([{ category: 'educacao', label: 'educacao', avg: 600, limit: 500, committed: 500, cut: 100 }]);
  });

  it('meta batida quando o guardado chega no alvo', () => {
    const r = goalPlan({ ...base, saved: 10000 });
    expect(r.status).toBe('reached');
    expect(r.cuts).toEqual([]);
  });

  it('nem com os limites chega em 5 anos: tooSlow, sem data', () => {
    const r = goalPlan({ ...base, plan: months(-50) });
    expect(r.status).toBe('tooSlow');
    expect(r.reachPlan).toBeNull();
    expect(r.monthsPlan).toBeNull();
  });

  it('ritmo de hoje = mês "normal" (sem 13º), igual ao texto da IA', () => {
    const noPlan = months(-400).map((m, i) => (i === 1 ? { ...m, balance: 3000, extra: 3400 } : m));
    expect(goalPlan({ ...base, noPlan }).paceToday).toBe(-400);
  });

  it('no ritmo de hoje também chega: mostra as duas datas', () => {
    const r = goalPlan({ ...base, noPlan: months(1000) });
    expect(r.reachToday).toBe('2027-07'); // 10 × 1000
  });
});

describe('goalPlanFor: com os dados do design', () => {
  it('sem meta → null', () => {
    expect(goalPlanFor({ ...designInput(), goal: null })).toBeNull();
  });
  it('com meta → data seguindo os limites, guardado incluso', () => {
    const r = goalPlanFor({ ...designInput(), saved: 4000 })!;
    expect(r.missing).toBe(6000); // fixture: alvo 10 mil
    expect(r.status).toBe('onTrack');
    expect(r.reachPlan).toMatch(/^\d{4}-\d{2}$/);
  });
});

const tx = (date: string, description: string, amount: number, category: string): FinTx => ({ date, description, amount, category });

describe('recurringCharges: contas que se repetem dentro dos variáveis', () => {
  const txs = [
    // faculdade todo mês (boleto) → recorrente
    tx('2026-08-10', 'PAG BOLETO FASUL EDUCACIONAL 08', -480, 'educacao'),
    tx('2026-09-10', 'PAG BOLETO FASUL EDUCACIONAL 09', -480, 'educacao'),
    tx('2026-10-05', 'PAG BOLETO FASUL EDUCACIONAL 10', -500, 'educacao'),
    // mercado toda semana → hábito, não conta
    ...['08', '09'].flatMap((m) => [3, 10, 17, 24].map((d) => tx(`2026-${m}-${String(d).padStart(2, '0')}`, 'PAY ASSAI ATACADISTA', -150, 'mercado'))),
    // delivery nunca é conta, mesmo se repetir
    tx('2026-08-12', 'IFOOD', -40, 'delivery'),
    tx('2026-09-12', 'IFOOD', -40, 'delivery'),
    // só um mês → não dá pra saber
    tx('2026-09-20', 'PAY LOJA X', -300, 'compras'),
    // valor muito diferente entre os meses → não é conta
    tx('2026-08-15', 'PIX TRANSF MARIA', -50, 'pessoas'),
    tx('2026-09-15', 'PIX TRANSF MARIA', -400, 'pessoas'),
  ];
  it('pega só a faculdade, com a média dos 2 meses mais recentes', () => {
    expect(recurringCharges(txs, '2026-10-07')).toEqual([{ category: 'educacao', name: 'Fasul Educacional', amount: 490 }]);
  });
  it('vira o piso do plano na categoria', () => {
    const edu = budgetItems(txs, { educacao: 100 }, '2026-10-07').find((b) => b.category === 'educacao')!;
    expect(edu).toMatchObject({ limit: 100, committed: 490 });
  });
});

describe('limite sugerido (sem limite salvo): corte gradual', () => {
  it('no máximo 20% abaixo da média, nunca abaixo do padrão do catálogo', () => {
    expect(limitOf({}, 'lanches', 1658.27)).toBe(1330); // 80% de 1659 → arredonda pra cima de 10
    expect(limitOf({}, 'lanches', 500)).toBe(700); // gasta menos que o padrão: fica o padrão
    expect(limitOf({ lanches: 400 }, 'lanches', 1658.27)).toBe(400); // salvo pelo usuário: respeita
  });
  it('sem limites salvos a meta corta bem menos que com os padrões do design', () => {
    const soft = goalPlanFor(designInput({ limits: {} }))!;
    const hard = goalPlanFor(designInput())!;
    const total = (p: typeof soft) => p.cuts.reduce((a, c) => a + c.cut, 0);
    expect(total(soft)).toBeLessThan(total(hard));
    for (const c of soft.cuts) expect(c.cut).toBeLessThanOrEqual(c.avg * 0.2 + 10);
  });
  it('a projeção com limites usa o piso das recorrentes', () => {
    const base = designInput();
    const edu = budgetItems(base.txs, base.limits, base.today).find((b) => b.category === 'educacao')!;
    expect(edu.committed).toBeGreaterThan(0);
    const out = (educacao: number) => project(designInput({ limits: { ...base.limits, educacao } }), { months: 1 })[0].out;
    expect(out(0)).toBe(out(edu.committed)); // limite zero na faculdade não "economiza" a mensalidade
  });
});
