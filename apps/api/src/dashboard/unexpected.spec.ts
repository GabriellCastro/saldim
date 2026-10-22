import { actualVsPlan, flowAfterBase, incomeOf, savedAtMonthStart, savedTotal, budgetItems, fixedCosts, goalPlanFor, project, reserveLevels, unexpectedIn, type FinInput } from './finance';
import { designInput } from './finance.fixture';

/** Marca como imprevisto o maior gasto de uma categoria num mês. */
function markBiggest(input: FinInput, category: string, month: string, type = 'saude', note = 'dente quebrou'): FinInput {
  const t = input.txs.filter((x) => x.category === category && x.date.startsWith(month) && x.amount < 0).sort((a, b) => a.amount - b.amount)[0];
  return { ...input, txs: input.txs.map((x) => (x === t ? { ...x, unexpected: type, unexpectedNote: note } : x)) };
}

describe('imprevistos', () => {
  const base = designInput();

  it('fora da média e do gasto do limite da categoria', () => {
    const marked = markBiggest(base, 'compras', '2026-09');
    const before = budgetItems(base.txs, base.limits, base.today).find((b) => b.category === 'compras')!;
    const after = budgetItems(marked.txs, marked.limits, marked.today).find((b) => b.category === 'compras')!;
    expect(after.avg).toBeLessThan(before.avg);
  });

  it('fora da estimativa dos fixos', () => {
    const marked = markBiggest(base, 'contas', '2026-09', 'casa');
    const f = (i: FinInput) => fixedCosts(i.txs, i.today).find((x) => x.id === 'contas')?.amount ?? 0;
    expect(f(marked)).toBeLessThan(f(base));
  });

  it('o do mês atual sai uma vez da projeção (só no mês 0) e empurra a meta', () => {
    const marked = markBiggest(base, 'lanches', '2026-10', 'eletronico');
    const amount = unexpectedIn(marked.txs, '2026-10');
    expect(amount).toBeGreaterThan(0);
    const [m0, m1] = project(marked, { months: 2 });
    const [n0, n1] = project(marked, { months: 2, unexpected: false });
    expect(m0.unexpected).toBe(amount);
    expect(Math.round((n0.balance - m0.balance) * 100) / 100).toBe(amount);
    expect(m1.balance).toBe(n1.balance);
    const p = goalPlanFor(marked)!;
    expect(p.unexpected.amount).toBe(amount);
    expect(p.unexpected.delayMonths).toBeGreaterThanOrEqual(0);
  });

  it('imprevisto grande atrasa a meta em meses', () => {
    const big: FinInput = { ...base, txs: [...base.txs, { date: '2026-10-05', description: 'PAY OFICINA', amount: -8000, category: 'compras', unexpected: 'veiculo' }] };
    expect(goalPlanFor(big)!.unexpected.delayMonths).toBeGreaterThan(0);
  });
});

describe('reservas mínima, ideal e dos sonhos', () => {
  it('3 meses do essencial, 6 e 12 do custo de vida; datas em ordem', () => {
    const r = reserveLevels(designInput());
    const [min, ideal, dream] = r.levels;
    expect(r.essential).toBeLessThan(r.monthlyCost);
    expect(min.target).toBeCloseTo(3 * r.essential, 1);
    expect(ideal.target).toBeCloseTo(6 * r.monthlyCost, 1);
    expect(dream.target).toBeCloseTo(12 * r.monthlyCost, 1);
    if (min.reachPlan && ideal.reachPlan) expect(min.reachPlan <= ideal.reachPlan).toBe(true);
  });
  it('o guardado conta: quem já tem marca como batida', () => {
    const i = designInput();
    const r = reserveLevels({ ...i, saved: reserveLevels(i).levels[0].target });
    expect(r.levels[0]).toMatchObject({ reached: true, reachPlan: null });
  });
});

describe('real × plano da IA (tela Projeção)', () => {
  it('mês atual até hoje + meses fechados; plano do mês atual = projeção do mês 0', () => {
    const i = designInput();
    const a = actualVsPlan(i);
    expect(a.map((m) => m.month)).toEqual(['2026-08', '2026-09', '2026-10']);
    const [, sep, oct] = a;
    expect(sep.partial).toBe(false);
    expect(sep.real.balance).toBeCloseTo(sep.real.income - sep.real.out, 2);
    expect(oct.partial).toBe(true);
    const m0 = project(i, { months: 1 })[0];
    expect(oct.plan.balance).toBe(m0.balance);
    expect(oct.pct.out).toBe(Math.round((oct.real.out / oct.plan.out) * 100));
  });

  it('reserva real = o guardado × a reserva que a IA espera no fim do mês; sobra = o que tá na conta', () => {
    const i = { ...designInput(), saved: 2000 };
    const oct = actualVsPlan(i).at(-1)!;
    const m0 = project(i, { months: 1 })[0];
    expect(oct.reserve).toEqual({ real: 2000, plan: m0.reserve, pct: m0.reserve > 0 ? Math.round((2000 / m0.reserve) * 100) : null });
    expect(oct.real.balance).toBeCloseTo(oct.real.income - oct.real.out, 2); // sem saldo do banco: entrou − saiu
    expect(actualVsPlan(i)[0].reserve).toBeNull();
  });

  it('com saldo do banco, a sobra do mês atual é o saldo da conta (os fechados seguem entrou − saiu)', () => {
    const i = { ...designInput(), balance: 4331.25 };
    const a = actualVsPlan(i);
    expect(a.at(-1)!.real.balance).toBe(4331.25);
    expect(a.at(-1)!.pct.balance).toBe(a.at(-1)!.plan.balance > 0 ? Math.round((4331.25 / a.at(-1)!.plan.balance) * 100) : null);
    expect(a[1].real.balance).toBeCloseTo(a[1].real.income - a[1].real.out, 2);
  });

  it('caixinha e transferência própria não contam como saída real; crédito de empréstimo não é entrada', () => {
    const i = designInput();
    const base = actualVsPlan(i).at(-1)!.real;
    const more = actualVsPlan({
      ...i,
      txs: [
        ...i.txs,
        { date: '2026-10-06', description: 'APLICACAO COFRINHOS', amount: -2000, category: 'investimento' },
        { date: '2026-10-06', description: 'CREDITO CONSIGNADO', amount: 5000, category: 'emprestimo_in' },
      ],
    }).at(-1)!.real;
    expect(more.out).toBe(base.out);
    expect(more.income).toBe(base.income);
  });
});

describe('guardado no início do mês (sem contar a caixinha duas vezes)', () => {
  const cofre = { date: '2026-10-06', description: 'APLICACAO COFRINHOS', amount: -2000, category: 'investimento' };

  it('depósito na caixinha no mês: desconta do guardado no início do mês', () => {
    const i = { ...designInput(), txs: [...designInput().txs, cofre], saved: 2000 };
    expect(savedAtMonthStart(i)).toBe(0);
    const m0 = project(i, { months: 1 })[0];
    expect(m0.reserve).toBe(m0.balance); // parte do zero + sobra do mês
    const oct = actualVsPlan(i).at(-1)!;
    expect(oct.reserve).toMatchObject({ real: 2000, plan: m0.reserve });
    // sobra esperada perde só o excedente (guardado no mês − meta de guardar)
    const extra = Math.max(0, Math.round((2000 - Math.max(0, m0.balance)) * 100) / 100);
    expect(oct.saving).toEqual({ month: 2000, planned: m0.balance, extra });
    expect(oct.plan.balance).toBe(Math.max(0, Math.round((m0.balance - extra) * 100) / 100));
  });

  it('exemplo: meta de guardar 1.500, guardou 2.000 → excedente 500, sobra 1.500 vira 1.000', () => {
    const base = { ...designInput(), txs: [...designInput().txs, cofre], saved: 2000 };
    // ajusta a renda da outra conta pra sobra do plano no mês dar exatamente 1.500
    const m0 = project(base, { months: 1 })[0];
    const i = { ...base, otherIncome: incomeOf(base).other + 1500 - m0.balance };
    expect(project(i, { months: 1 })[0].balance).toBeCloseTo(1500, 2);
    const oct = actualVsPlan(i).at(-1)!;
    expect(oct.saving!.extra).toBeCloseTo(500, 2);
    expect(oct.plan.balance).toBeCloseTo(1000, 2);
  });

  it('guardou menos que a meta: sem excedente, sobra esperada fica a do plano', () => {
    const i = { ...designInput(), txs: [...designInput().txs, { ...cofre, amount: -1 }], saved: 1 };
    const m0 = project(i, { months: 1 })[0];
    const oct = actualVsPlan(i).at(-1)!;
    expect(oct.saving!.extra).toBe(m0.balance >= 1 ? 0 : oct.saving!.extra);
    if (m0.balance >= 1) expect(oct.plan.balance).toBe(m0.balance);
  });

  it('resgate da caixinha no mês: no início do mês tinha mais guardado', () => {
    const i = { ...designInput(), txs: [...designInput().txs, { ...cofre, description: 'RESGATE COFRINHOS', amount: 500 }], saved: 1000 };
    expect(savedAtMonthStart(i)).toBe(1500);
  });

  it('sem caixinha no mês: usa o guardado como está', () => {
    expect(savedAtMonthStart({ ...designInput(), saved: 500 })).toBe(500);
  });
});

describe('guardado automático (base informada + caixinha lançada depois)', () => {
  it('depósito na caixinha soma, resgate tira', () => {
    expect(savedTotal(1000, [-300, -200])).toBe(1500);
    expect(savedTotal(1000, [-300, 100])).toBe(1200);
  });

  it('resgate maior que o guardado não deixa negativo', () => {
    expect(savedTotal(100, [500])).toBe(0);
  });
});

describe('caixinha que já tava no guardado informado não soma de novo', () => {
  const base = '2026-10-19T20:47:16.582Z'; // 19/10 17:47 em Brasília

  it('guardou e informou no mesmo dia, banco mandou 3 dias depois: não conta', () => {
    expect(flowAfterBase({ date: '2026-10-19', createdAt: '2026-10-22T17:25:28.250Z' }, base)).toBe(false);
  });

  it('já aparecia (pendente, com data de lançamento futura) quando informou: não conta', () => {
    expect(flowAfterBase({ date: '2026-10-13', createdAt: '2026-10-10T16:52:25.781Z' }, '2026-10-10T21:00:00.000Z')).toBe(false);
  });

  it('depósito no dia seguinte à base: conta', () => {
    expect(flowAfterBase({ date: '2026-10-20', createdAt: '2026-10-20T15:00:00.000Z' }, base)).toBe(true);
  });

  it('dia da base no horário de Brasília (21h de lá já é outro dia em UTC)', () => {
    // base 19/10 22:00 em Brasília = 20/10 01:00 UTC; depósito do dia 20 é depois
    expect(flowAfterBase({ date: '2026-10-20', createdAt: '2026-10-20T15:00:00.000Z' }, '2026-10-20T01:00:00.000Z')).toBe(true);
  });
});
