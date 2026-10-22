import {
  alerts,
  brl,
  budgetItems,
  dailyVariable,
  fixedCosts,
  incomeOf,
  netAt,
  overview,
  overviewInsight,
  paceOf,
  project,
  prompts,
  r2,
  reachMonth,
  resolveToday,
  ruleReply,
  spendingByCategory,
  spendingInsight,
  thirteenth,
  topMerchant,
  recentWindow,
} from './finance';
import { DESIGN_LOANS, designInput, loadDesignTxs } from './finance.fixture';

describe('finance (números do design Controle Financeiro v3)', () => {
  const input = designInput();

  it('"hoje" = data do lançamento mais recente', () => {
    expect(resolveToday(loadDesignTxs())).toBe('2026-10-07');
    expect(resolveToday([], '2026-01-02')).toBe('2026-01-02');
  });

  it('renda: líquido do holerite + outra conta (média das transferências próprias)', () => {
    expect(incomeOf(input)).toEqual({ net: 3000, gross: 5800.37, other: 6158.43, total: 9158.43 });
    expect(incomeOf(input, false).other).toBe(0);
    expect(incomeOf({ ...input, otherIncome: 500 }).other).toBe(500);
  });

  it('fixos estimados como no design', () => {
    expect(fixedCosts(input.txs, input.today).map((f) => [f.label, f.amount])).toEqual([
      ['Aluguel', 1450],
      ['Moto', 878.18],
      ['Celular', 658.78],
      ['Contas da casa', 651.32],
      ['Empréstimos na conta', 808.76],
    ]);
  });

  it('gastos de setembro por categoria', () => {
    const by = Object.fromEntries(spendingByCategory(input.txs, '2026-09', 9158.43).map((c) => [c.id, c.amount]));
    expect(by.lanches).toBe(1658.27);
    expect(by.moradia).toBe(1450);
    expect(by.mercado).toBe(1255.44);
    expect(by.compras).toBe(1216.98);
    expect(by.pessoas).toBe(1172.68);
    expect(by.propria).toBeUndefined();
    expect(by.salario).toBeUndefined();
  });

  it('gastos por categoria em todos os meses = soma de cada mês', () => {
    const months = [...new Set(input.txs.map((t) => t.date.slice(0, 7)))];
    const all = spendingByCategory(input.txs, null, 0);
    const lanches = months.reduce((a, m) => a + (spendingByCategory(input.txs, m, 0).find((c) => c.id === 'lanches')?.amount ?? 0), 0);
    expect(all.find((c) => c.id === 'lanches')?.amount).toBeCloseTo(lanches, 2);
    expect(all.find((c) => c.id === 'propria')).toBeUndefined();
    expect(all[0].amount).toBeGreaterThanOrEqual(all[all.length - 1].amount);
  });

  it('variáveis de outubro: R$ 633,04 de R$ 3.596,00, R$ 178,96 abaixo do ritmo no dia 7', () => {
    const items = budgetItems(input.txs, input.limits, input.today);
    const limit = items.reduce((a, i) => a + i.limit, 0);
    const daily = dailyVariable(input.txs, input.today);
    expect(daily).toEqual([0, 26.45, 52.84, 52.84, 52.84, 487.1, 617.32, 633.04]);
    expect(limit).toBe(3596);
    const pace = paceOf(daily, limit, input.today);
    expect(pace.spent).toBe(633.04);
    expect(brl(Math.abs(pace.diff))).toBe('R$ 178,96');
    expect(pace.word).toBe('abaixo');
    const lanches = items.find((i) => i.category === 'lanches')!;
    expect(lanches).toMatchObject({ limit: 700, spent: 173.15, avg: 1658.27, status: 'ok' });
    expect(items.find((i) => i.category === 'assinaturas')!.status).toBe('warn');
  });

  it('folha libera conforme os empréstimos terminam; 13º pelo salário base', () => {
    expect(netAt(0, 3000, DESIGN_LOANS)).toBe(3000);
    expect(netAt(1, 3000, DESIGN_LOANS)).toBe(3380);
    expect(netAt(9, 3000, DESIGN_LOANS)).toBe(4418.7);
    expect(thirteenth(input.payslip, incomeOf(input))).toEqual({ first: 2900, second: 1768.5 });
  });

  it('projeção de 15 meses com e sem o plano da IA', () => {
    const plan = project(input, { plan: true });
    const no = project(input, { plan: false });
    expect(plan).toHaveLength(15);
    expect(plan[0]).toMatchObject({ month: '2026-10', label: 'out/26', income: 9158.43, out: 8043.04, balance: 1115.39 });
    expect(plan[1]).toMatchObject({ label: 'nov/26', extra: 2900, balance: 4395.39, freed: 380 });
    expect(plan[3].balance).toBe(1897.89);
    expect(no[3].balance).toBe(-2150.38);
    expect(plan[14].reserve).toBe(41041.85);
    expect(no[14].reserve).toBe(-19682.2);
    expect(reachMonth(plan, 10000)).toBe('2027-01');
    expect(reachMonth(no, 10000)).toBeNull();
    expect(reachMonth(plan, 4447.04)).toBe('2026-11');
    // a reserva parte do que o usuário já guardou
    const withSaved = project({ ...input, saved: 1000 }, { plan: true });
    expect(withSaved[0].reserve).toBe(r2(1000 + plan[0].balance));
    expect(withSaved[14].reserve).toBe(r2(1000 + 41041.85));
  });

  it('visão geral', () => {
    const ov = overview(input);
    expect(ov).toMatchObject({ month: '2026-10', day: 7, daysInMonth: 31, fixedTotal: 4447.04, leftover: 1115.39, payslipFreed: 1418.7 });
    expect(ov.netAfterLoans).toEqual({ month: '2027-07', net: 4418.7 });
    expect(ov.variable).toMatchObject({ spent: 633.04, limit: 3596, avg: 7644.27, idealToDate: 812, diff: -178.96 });
    expect(ov.insight).toBe(
      'Fica de olho em Assinaturas, Bares e restaurantes e Delivery: tão andando mais rápido que o mês (Assinaturas já usou 54% do limite e o mês tá em 23%).',
    );
  });

  it('insight da visão geral: estourou > acima do ritmo > tudo no ritmo', () => {
    const item = (label: string, spent: number, limit: number, avg: number, status: 'ok' | 'warn' | 'over') =>
      ({ category: label, label, spent, limit, avg, committed: 0, ratio: spent / limit, status });
    expect(overviewInsight([item('Mercado', 900, 800, 1000, 'over'), item('Delivery', 200, 250, 300, 'warn')], 10, 30)).toBe(
      'Mercado já estourou o limite do mês. Segura o resto pra não comer a sobra.',
    );
    expect(overviewInsight([item('Delivery', 200, 250, 300, 'warn'), item('Mercado', 100, 800, 1000, 'ok')], 10, 30)).toBe(
      'Fica de olho em Delivery: tá andando mais rápido que o mês (Delivery já usou 80% do limite e o mês tá em 33%).',
    );
    expect(overviewInsight([item('Mercado', 100, 800, 1000, 'ok'), item('Lanches', 50, 700, 1700, 'ok')], 10, 30)).toBe(
      'Tudo no ritmo. O que mais pesa no plano é Lanches: média R$ 1.700,00 → limite R$ 700,00.',
    );
    expect(overviewInsight([item('Mercado', 100, 800, 500, 'ok')], 10, 30)).toBe('Tudo no ritmo dos limites. Segue assim.');
  });

  it('insight de gastos (estabelecimento campeão / delivery / vazamentos)', () => {
    const m = topMerchant(recentWindow(input.txs, input.today))!;
    expect(m.count).toBe(52);
    expect(m.total).toBe(476.26);
    expect(spendingInsight(input.txs, input.today, '2026-09')).toBe(
      'Foram 52 compras na Cantina Central em 2 meses, somando R$ 476,26. Somando lanches, delivery (34 pedidos) e Pix pra pessoas, setembro passou de R$ 3.435,43. É aí que o limite mais rende.',
    );
  });

  it('insight de gastos em todos os meses fala do período todo', () => {
    expect(spendingInsight(input.txs, input.today, null)).toMatch(/no período todo passou de R\$ [\d.]+,\d{2}\./);
  });

  it('alertas do design: DÍVIDA, INCOMUM, FOLHA', () => {
    expect(alerts(input)).toEqual([
      {
        tag: 'DÍVIDA',
        tone: 'neg',
        title: 'R$ 6.025,50 em novos empréstimos',
        body: 'Entre 24/08 e 15/09 entraram 6 créditos consignados na conta. Além dos 6 da folha, já tem R$ 808,76/mês debitando na conta.',
      },
      { tag: 'INCOMUM', tone: 'warn', title: 'Compra de R$ 3.926,93 na Loja Notebook', body: 'Em 25/08, no mesmo dia de um crédito de R$ 3.533,00.' },
      { tag: 'FOLHA', tone: 'pos', title: 'Contrato de 12x terminou', body: 'Novembro entra R$ 3.380,00 líquido.' },
    ]);
  });

  it('sugestões e respostas por regras usam os números do usuário', () => {
    expect(prompts(input)).toEqual([
      'Onde estou gastando mais?',
      'E se eu quitar o contrato de 36x?',
      'Quanto guardar por mês pra 10 mil?',
      'Posso trocar de celular?',
    ]);
    expect(ruleReply(input, 'E se eu quitar o contrato de 36x?')).toContain('30 parcelas de R$ 248,75');
    const meta = ruleReply(input, 'Quanto guardar por mês pra 10 mil?');
    expect(meta).toMatch(/Seguindo teus limites, a meta de R\$ 10\.000,00 chega em [a-z]{3}\/\d{2}/);
    expect(meta).toContain('teus gastos passam da renda em R$');
    expect(meta).not.toMatch(/sobra −/);
    expect(meta).not.toContain('NaN');
    expect(meta).not.toContain('undefined');
    expect(meta).toContain('No ritmo de setembro não chega');
    expect(ruleReply(input, 'Onde estou gastando mais?')).toContain('Lanches e pequenos gastos (R$ 1.658,27)');
    expect(ruleReply(input, 'Posso trocar de celular?')).toContain('nov/26');
    expect(ruleReply(input, 'oi')).toContain('os fixos levam R$ 4.447,04');
  });
});
