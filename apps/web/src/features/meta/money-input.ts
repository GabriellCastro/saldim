/** "10.000,50" | "10000.5" | "1.000" | "R$ 1.000,00" → número (NaN se inválido). Mesmo critério do LoanForm. */
export const toNum = (s: string) => {
  const t = s.trim().replace(/^R\$\s*/, '');
  if (t.includes(',')) return Number(t.replace(/\./g, '').replace(',', '.'));
  return /^\d{1,3}(\.\d{3})+$/.test(t) ? Number(t.replace(/\./g, '')) : Number(t);
};

const brl = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Máscara de dinheiro enquanto digita: só dígitos, os 2 últimos são centavos ("1000050" → "10.000,50"). */
export const maskMoney = (raw: string) => {
  const digits = raw.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 13);
  return digits ? brl.format(Number(digits) / 100) : '';
};

/** 1234.5 → "1.234,50" pra preencher o campo */
export const toField = (v: number) => maskMoney(String(Math.round(v * 100)));
