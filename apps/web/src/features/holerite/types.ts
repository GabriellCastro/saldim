export type PayslipItem = { code?: string; label: string; amount: number; kind: 'provento' | 'desconto' };
export type Payslip = { id: string; month: string; gross: number; net: number; items: PayslipItem[] };
export type PayslipInput = Omit<Payslip, 'id'>;
