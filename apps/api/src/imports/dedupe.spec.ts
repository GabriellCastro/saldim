import { onlyNew } from './dedupe';

const row = (date: string, description: string, amount: number) => ({ date, description, amount });
const tx = (id: string, date: string, description: string, amount: number) => ({ id, date, description, amount, accountId: 'acc' });

describe('onlyNew: o que do arquivo ainda não está na conta', () => {
  it('reimportar o mesmo arquivo não traz nada (chave exata, inclusive repetidos numerados)', () => {
    const rows = [row('2026-10-06', 'PAY CANTINA', -9), row('2026-10-06', 'PAY CANTINA (2)', -9)];
    const existing = [tx('t1', '2026-10-06', 'PAY CANTINA', -9), tx('t2', '2026-10-06', 'PAY CANTINA (2)', -9)];
    expect(onlyNew(rows, existing)).toEqual([]);
  });

  it('descrição diferente (PDF x Open Finance) casa por data e valor, um pra um', () => {
    const rows = [row('2026-10-08', 'PAY Versa 08/10', -3.43), row('2026-10-08', 'PAY Versa 08/10 (2)', -3.43), row('2026-10-09', 'PAY PIZZA 09/10', -20)];
    const existing = [tx('t1', '2026-10-08', 'Compra débito Versallesmix', -3.43)];
    expect(onlyNew(rows, existing).map((r) => r.description)).toEqual(['PAY Versa 08/10 (2)', 'PAY PIZZA 09/10']);
  });

  it('aceita 1 dia de diferença; 2–3 dias só com estabelecimento parecido', () => {
    const rows = [row('2026-10-05', 'PAY FORTE 03/10', -15), row('2026-10-05', 'PAY Ingre 03/10', -54.5), row('2026-10-05', 'PIX TRANSF ANA', -30)];
    const existing = [
      tx('t1', '2026-10-04', 'Compra débito Forte Bar', -15),
      tx('t2', '2026-10-03', 'Compra débito Ingresso Rapido', -54.5),
      tx('t3', '2026-10-02', 'Pix enviado Joao', -30),
    ];
    expect(onlyNew(rows, existing).map((r) => r.description)).toEqual(['PIX TRANSF ANA']);
  });

  it('um lançamento já casado por chave exata não absorve outro do arquivo', () => {
    const rows = [row('2026-10-06', 'PAY CANTINA', -9), row('2026-10-06', 'PAY PIZZA', -9)];
    const existing = [tx('t1', '2026-10-06', 'PAY CANTINA', -9)];
    expect(onlyNew(rows, existing).map((r) => r.description)).toEqual(['PAY PIZZA']);
  });
});
