import { bankSlug, reconcile, signedAmount, toRows } from './mapping';

const tx = (over: Partial<Parameters<typeof toRows>[0][number]> = {}) => ({
  id: 't1',
  date: new Date('2026-10-05T12:00:00Z'),
  description: 'PIX TRANSF JOAO',
  type: 'DEBIT' as const,
  amount: 50,
  status: 'POSTED' as const,
  ...over,
});

describe('Open Finance → lançamentos', () => {
  it('sinal vem do tipo, não do número (bancos variam)', () => {
    expect(signedAmount('DEBIT', 50)).toBe(-50);
    expect(signedAmount('DEBIT', -50)).toBe(-50);
    expect(signedAmount('CREDIT', 3000)).toBe(3000);
    expect(signedAmount('CREDIT', -3000)).toBe(3000);
  });

  it('ignora pendentes e o que já veio por extrato (até a data de corte)', () => {
    const rows = toRows(
      [
        tx({ id: 'a', date: new Date('2026-10-01T12:00:00Z') }),
        tx({ id: 'b', date: new Date('2026-10-08T12:00:00Z') }),
        tx({ id: 'c', date: new Date('2026-10-09T12:00:00Z'), status: 'PENDING' }),
        tx({ id: 'd', date: new Date('2026-10-09T12:00:00Z'), type: 'CREDIT', amount: 100 }),
      ],
      '2026-10-08',
    );
    expect(rows).toEqual([{ externalId: 'd', date: '2026-10-09', description: 'PIX TRANSF JOAO', amount: 100 }]);
  });

  it('sem corte, entra tudo que não é pendente; descrição vazia vira "Lançamento"', () => {
    const rows = toRows([tx({ id: 'x', description: '  ' })], null);
    expect(rows).toEqual([{ externalId: 'x', date: '2026-10-05', description: 'Lançamento', amount: -50 }]);
  });

  it('slug do banco a partir do nome do conector', () => {
    expect(bankSlug('Itaú')).toBe('itau');
    expect(bankSlug('Banco do Brasil')).toBe('banco-do-brasil');
    expect(bankSlug('Nubank (Sandbox)')).toBe('nubank-sandbox');
  });

  it('data no fuso de Brasília (compra às 22h não vira o dia seguinte)', () => {
    const [r] = toRows([tx({ date: new Date('2026-10-09T01:30:00Z') })], null);
    expect(r.date).toBe('2026-10-08');
  });

  describe('reconcile: casa Open Finance com o que já veio por arquivo (mesma data e valor)', () => {
    const of = (externalId: string, date: string, amount: number, description = 'x') => ({ externalId, date, description, amount });
    const file = (id: string, date: string, amount: number, accountId = 'acc-pdf', description = 'x') => ({ id, date, amount, accountId, description });

    it('um pra um, inclusive com repetidos no mesmo dia', () => {
      const r = reconcile(
        [of('a', '2026-10-07', -5.9), of('b', '2026-10-07', -5.9), of('c', '2026-10-07', -7.92), of('d', '2026-10-09', -1)],
        [file('f1', '2026-10-07', -5.9), file('f2', '2026-10-07', -7.92)],
      );
      expect(r.matches).toEqual([
        { externalId: 'a', fileId: 'f1' },
        { externalId: 'c', fileId: 'f2' },
      ]);
      expect(r.fresh.map((x) => x.externalId)).toEqual(['b', 'd']);
    });

    it('aceita 1 dia de diferença (compra postada no dia seguinte) quando não há par exato', () => {
      const r = reconcile([of('a', '2026-10-08', -37.08)], [file('f1', '2026-10-07', -37.08)]);
      expect(r.matches).toEqual([{ externalId: 'a', fileId: 'f1' }]);
    });

    it('2–3 dias de diferença (fim de semana) só casa se a descrição parecer a mesma', () => {
      const r = reconcile(
        [
          of('multi', '2026-10-03', -56.5, 'Compra débito Multiplex Via'),
          of('seg', '2026-09-17', -0.92, 'Pagamento de seguro Itau Seg'),
          of('amanda', '2026-09-26', -19, 'Pix enviado AMANDA BEATRIZ V'),
          of('nutri', '2026-08-12', -17, 'Compra débito Mp *nutrialves'),
        ],
        [
          file('f1', '2026-10-05', -56.5, 'acc', 'PAY MULTI'),
          file('f2', '2026-09-15', -0.92, 'acc', 'ITAU SEGURO CREDITO'),
          file('f3', '2026-09-28', -19, 'acc', 'PIX TRANSF AMANDA'),
          file('f4', '2026-08-10', -17, 'acc', 'PAY PuroF'),
        ],
      );
      expect(r.matches).toEqual([
        { externalId: 'multi', fileId: 'f1' },
        { externalId: 'seg', fileId: 'f2' },
        { externalId: 'amanda', fileId: 'f3' },
      ]);
      expect(r.fresh.map((x) => x.externalId)).toEqual(['nutri']);
    });

    it('conta de arquivo mais casada é a sugerida pra adotar', () => {
      const r = reconcile(
        [of('a', '2026-10-07', -1), of('b', '2026-10-07', -2), of('c', '2026-10-07', -3)],
        [file('f1', '2026-10-07', -1, 'itau'), file('f2', '2026-10-07', -2, 'itau'), file('f3', '2026-10-07', -3, 'outra')],
      );
      expect(r.accountId).toBe('itau');
    });
  });
});

