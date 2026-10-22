import { readFileSync } from 'fs';
import { join } from 'path';
import { numberRepeats, onlyNew } from '../dedupe';
import { detectFormat, parseCsvStatement, parseItauText, parseJsonStatement, parseOfxStatement } from '.';
import { parseBrNumber } from './util';

describe('parsers de extrato', () => {
  it('JSON de exemplo: 462 lançamentos com ano 2026 e saldo', () => {
    const text = readFileSync(join(__dirname, '../../../prisma/data/extrato-itau.json'), 'utf8');
    const p = parseJsonStatement(text);
    expect(p.rows).toHaveLength(462);
    expect(p.rows[0]).toEqual({ date: '2026-10-07', description: 'PAY APPLE', amount: -5.86, category: 'assinaturas' });
    expect(p.periodStart).toBe('2026-08-08');
    expect(p.balance).toBe(1520.4);
    expect(p.accountLabel).toBe('Itaú · ag. 0001');
  });

  it('CSV pt-BR com cabeçalho', () => {
    const p = parseCsvStatement('data;descricao;valor\n07/10/2026;PAY APPLE;-5,90\n05/10/2026;REMUNERACAO/SALARIO;3.000,00\n06/10/2026;SALDO DO DIA;100,00');
    expect(p.rows).toEqual([
      { date: '2026-10-07', description: 'PAY APPLE', amount: -5.9 },
      { date: '2026-10-05', description: 'REMUNERACAO/SALARIO', amount: 3000 },
    ]);
    expect(p.periodStart).toBe('2026-10-05');
  });

  it('OFX', () => {
    const ofx = `OFXHEADER:100
<OFX><BANKTRANLIST><DTSTART>20261001<DTEND>20261007
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261007120000[-3:BRT]<TRNAMT>-5.90<MEMO>PAY APPLE</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261005<TRNAMT>3000.00<MEMO>REMUNERACAO/SALARIO</STMTTRN>
</BANKTRANLIST><LEDGERBAL><BALAMT>1520.40<DTASOF>20261007</LEDGERBAL></OFX>`;
    expect(detectFormat(Buffer.from(ofx))).toBe('ofx');
    const p = parseOfxStatement(ofx);
    expect(p.rows).toHaveLength(2);
    expect(p.rows[0]).toEqual({ date: '2026-10-07', description: 'PAY APPLE', amount: -5.9 });
    expect(p.periodEnd).toBe('2026-10-07');
    expect(p.balance).toBe(1520.4);
  });

  it('texto de PDF Itaú: ignora saldos e lê colunas coladas', () => {
    const text = `Extrato conta corrente agência 0001 conta 12345-6
lançamentos período: 08/08/2026 até 07/10/2026
data lançamentos valor (R$) saldo (R$)
06/10/2026 SALDO DO DIA 1.530,00
06/10/2026 PIX QRS FIBRA NET -110,00
06/10/2026 CREDITO CONSIGNADO 101-640,51
07/10/2026 PAY APPLE -5,90
07/10/2026 REMUNERACAO/SALARIO 3.000,00 5.009,75
07/10/2026 SALDO DO DIA 1.520,40`;
    const p = parseItauText(text);
    expect(p.rows.map((r) => [r.date, r.description, r.amount])).toEqual([
      ['2026-10-06', 'PIX QRS FIBRA NET', -110],
      ['2026-10-06', 'CREDITO CONSIGNADO 101', -640.51],
      ['2026-10-07', 'PAY APPLE', -5.9],
      ['2026-10-07', 'REMUNERACAO/SALARIO', 3000],
    ]);
    expect(p.balance).toBe(1520.4);
    expect(p.accountLabel).toBe('Itaú · ag. 0001');
  });

  it('texto de PDF Itaú: data no fim da descrição colada no valor não vira parte do número', () => {
    const text = `10/09/2026 PIX TRANSF LUCAS10/096.903,86
28/09/2026 PIX TRANSF Lucas27/09370,00
08/10/2026 PAY QUIOSQ 08/10 -3,43
08/10/2026 PAY IFD C08/10-37,08`;
    expect(parseItauText(text).rows.map((r) => [r.description, r.amount])).toEqual([
      ['PIX TRANSF LUCAS10/09', 6903.86],
      ['PIX TRANSF Lucas27/09', 370],
      ['PAY QUIOSQ 08/10', -3.43],
      ['PAY IFD C08/10', -37.08],
    ]);
  });

  it('números pt-BR', () => {
    expect(parseBrNumber('-1.234,56')).toBe(-1234.56);
    expect(parseBrNumber('1.234,56-')).toBe(-1234.56);
    expect(parseBrNumber('12.5')).toBe(12.5);
  });
});

describe('dedupe', () => {
  it('numera repetições do mesmo arquivo e ignora o que já existe', () => {
    const rows = [
      { date: '2026-10-06', description: 'PAY CANTINA', amount: -10 },
      { date: '2026-10-06', description: 'PAY CANTINA', amount: -10 },
      { date: '2026-10-06', description: 'PAY CANTINA', amount: -12 },
    ];
    const numbered = numberRepeats(rows);
    expect(numbered.map((r) => r.description)).toEqual(['PAY CANTINA', 'PAY CANTINA (2)', 'PAY CANTINA']);
    const existing = numbered.map((r, i) => ({ ...r, id: `t${i}`, accountId: 'acc' }));
    expect(onlyNew(numberRepeats(rows), existing)).toHaveLength(0);
  });
});
