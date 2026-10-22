import { addMonths, loanKpis, loanStatus } from './loan-math';

const NOW = new Date(2026, 9, 8); // 08/10/2026
const LOANS = [
  { installment: 415.17, currentInstallment: 12, totalInstallments: 12 },
  { installment: 419.94, currentInstallment: 10, totalInstallments: 12 },
  { installment: 280.16, currentInstallment: 13, totalInstallments: 18 },
  { installment: 152.83, currentInstallment: 10, totalInstallments: 18 },
  { installment: 263.77, currentInstallment: 11, totalInstallments: 18 },
  { installment: 270.39, currentInstallment: 6, totalInstallments: 36 },
].map((l) => ({ ...l, source: 'FOLHA' as const }));

describe('loan-math', () => {
  it('addMonths vira o ano', () => {
    expect(addMonths('2026-10', 3)).toBe('2027-01');
    expect(addMonths('2026-10', 0)).toBe('2026-10');
  });

  it('restantes, saldo nominal e mês final como no design', () => {
    expect(loanStatus(LOANS[1], NOW)).toEqual({ remainingInstallments: 2, remainingAmount: 839.88, endMonth: '2026-12' });
    expect(loanStatus(LOANS[5], NOW).endMonth).toBe('2029-04');
    expect(loanStatus(LOANS[0], NOW).remainingInstallments).toBe(0);
  });

  it('kpis', () => {
    const k = loanKpis(LOANS, 500, NOW);
    expect(k.monthlyFolha).toBe(1802.26);
    expect(k.monthlyConta).toBe(500);
    expect(k.endsNext3Months).toBe(2);
    expect(k.totalRemaining).toBe(
      Math.round(LOANS.reduce((a, l) => a + (l.totalInstallments - l.currentInstallment) * l.installment, 0) * 100) / 100,
    );
  });
});
