import { isHoliday, paydayOf, salaryCycle, type FinTx } from './finance';
import { designInput } from './finance.fixture';

describe('paydayOf: 5º dia útil (sábado conta; caiu no sábado, paga na sexta)', () => {
  it.each([
    ['2026-10', '2026-10-06'], // qui 1, sex 2, sáb 3, seg 5, ter 6
    ['2026-09', '2026-09-04'], // 5º dia útil = sáb 5 → sexta 4
    ['2026-11', '2026-11-06'], // seg 2 é Finados; 5º = sáb 7 → sexta 6
    ['2027-01', '2027-01-07'], // sex 1 é feriado
    ['2026-04', '2026-04-07'], // sex 3 é Sexta-feira Santa
  ])('%s → %s', (month, day) => expect(paydayOf(month)).toBe(day));

  it('feriados nacionais', () => {
    expect(isHoliday('2026-12-25')).toBe(true);
    expect(isHoliday('2026-04-03')).toBe(true); // Sexta Santa 2026
    expect(isHoliday('2026-10-07')).toBe(false);
  });
});

const tx = (date: string, amount: number, category = 'lanches', description = 'PAY X'): FinTx => ({ date, description, amount, category });

describe('salaryCycle: de salário a salário', () => {
  it('antes do salário do mês, o ciclo começa no salário do mês passado', () => {
    const txs = [tx('2026-09-30', -100), tx('2026-09-03', -999), tx('2026-10-02', -50)];
    const c = salaryCycle(txs, 3000, '2026-10-03');
    expect(c).toMatchObject({ start: '2026-09-04', nextPayday: '2026-10-06', days: 32, day: 30, daysLeft: 3, spent: 150, remaining: 2850, perDay: 950 });
  });

  it('usa o dia em que o salário entrou de verdade (empresa adiantou)', () => {
    const txs = [tx('2026-10-05', 3000, 'salario', 'REMUNERACAO'), tx('2026-10-05', -40), tx('2026-10-04', -500)];
    const c = salaryCycle(txs, 3000, '2026-10-07');
    expect(c.start).toBe('2026-10-05');
    expect(c.nextPayday).toBe('2026-11-06');
    expect(c.spent).toBe(40); // o gasto do dia 4 foi no ciclo anterior
    expect(c.daily).toEqual([0, 40, 40, 40]);
  });

  it('passou do limite: remaining negativo e nada por dia', () => {
    const c = salaryCycle([tx('2026-10-06', -3500)], 3000, '2026-10-07');
    expect(c.remaining).toBe(-500);
    expect(c.perDay).toBe(0);
  });

  it('com os dados do design', () => {
    const i = designInput();
    const c = salaryCycle(i.txs, 3596, i.today);
    expect(c.start <= i.today && i.today < c.nextPayday).toBe(true);
    expect(c.daily.length).toBe(c.day + 1);
  });
});
