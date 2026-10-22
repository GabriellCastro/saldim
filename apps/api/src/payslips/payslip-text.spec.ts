import { parsePayslipText } from './payslip-text';

describe('parsePayslipText', () => {
  it('lê totais, competência e linhas', () => {
    const p = parsePayslipText(`Demonstrativo de Pagamento
Competência: Setembro/2026
001 Salário Base 30,00 5.800,00
903 INSS Folha 640,20
869 Desc. Empréstimo (Crédito Trabalhador) Parc. 13/18 255,30
Total de Vencimentos 5.800,37
Total de Descontos 2.800,37
Valor Líquido 3.000,00`);
    expect(p).toMatchObject({ month: '2026-09', gross: 5800.37, net: 3000 });
    expect(p.items).toEqual([
      { code: '001', label: 'Salário Base', amount: 5800, kind: 'provento' },
      { code: '903', label: 'INSS Folha', amount: 640.2, kind: 'desconto' },
      { code: '869', label: 'Desc. Empréstimo (Crédito Trabalhador) Parc. 13/18', amount: 255.3, kind: 'desconto' },
    ]);
  });

  it('calcula líquido por bruto − descontos e devolve vazio quando não acha', () => {
    expect(parsePayslipText('Total de Proventos 1.000,00\nTotal de Descontos 200,00').net).toBe(800);
    expect(parsePayslipText('foto borrada').gross).toBeUndefined();
  });
});
