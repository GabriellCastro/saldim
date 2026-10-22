import { readFileSync } from 'fs';
import { join } from 'path';
import { CATEGORY_BY_ID } from '../categories/categories';
import { categorize, parseRules, RULES } from './categorizer';

const sample = JSON.parse(readFileSync(join(__dirname, '../../prisma/data/extrato-itau.json'), 'utf8')) as {
  tx: [string, string, number, string][];
};

// o que o usuário do seed poria em CATEGORY_RULES
const DEMO_RULES = parseRules('PIX TRANSF LUCAS=propria;FINANC MOTO=moto;LOJA CELULAR=celular');

describe('categorize', () => {
  it('concorda com >= 95% das categorias do extrato de exemplo', () => {
    const hits = sample.tx.filter(([, desc, amount, cat]) => categorize(desc, amount, DEMO_RULES) === cat).length;
    expect(sample.tx.length).toBe(462);
    expect(hits / sample.tx.length).toBeGreaterThanOrEqual(0.95);
  });

  it('só usa categorias do catálogo', () => {
    for (const r of RULES) expect(CATEGORY_BY_ID.has(r.category)).toBe(true);
  });

  it('usa o sinal para separar entrada e saída', () => {
    expect(categorize('CREDITO CONSIGNADO 999', 500)).toBe('emprestimo_in');
    expect(categorize('CREDITO CONSIGNADO 999', -120)).toBe('emprestimo');
    expect(categorize('PIX TRANSF Fulano', 50)).toBe('outros_in');
    expect(categorize('PIX TRANSF Fulano', -50)).toBe('pessoas');
  });

  it('Open Finance: aplicação/resgate automático é movimento interno, não gasto nem renda', () => {
    expect(categorize('Aplicação APL APLIC AUT MAIS', -1500)).toBe('propria');
    expect(categorize('Resgate RES APLIC AUT MAIS', 254.76)).toBe('propria');
    expect(categorize('Entrada RES APLIC AUT MAIS AP', 254.76)).toBe('propria');
    expect(categorize('Rendimentos REND PAGO APLIC AUT MAIS', 0.01)).toBe('outros_in');
  });

  it('Open Finance: descrições no formato da API caem nas mesmas regras do extrato', () => {
    expect(categorize('Compra débito Versallesmix', -3.43)).toBe('lanches'); // = PAY Versa
    expect(categorize('Compra débito Ifd*charles Albuquerqu', -37.08)).toBe('delivery');
    expect(categorize('Compra débito Jr Distribuidora', -13)).toBe('lanches');
    expect(categorize('Pagamento de Pix QR Code DIO TELECOM', -110)).toBe('contas');
    expect(categorize('Pagamento de Pix QR Code FULANO DE TAL', -20)).toBe('compras'); // = PIX QRS
    expect(categorize('Pix enviado Imobiliaria Centro', -1600)).toBe('moradia');
    expect(categorize('Pix enviado Maria Souza', -50)).toBe('pessoas'); // = PIX TRANSF
    expect(categorize('Salário EMPRESA EXEMPLO', 3000)).toBe('salario');
    expect(categorize('Saída CREDITO CONSIG', -640.51)).toBe('emprestimo');
  });

  it('CATEGORY_RULES: regras pessoais do .env valem antes das genéricas', () => {
    const rules = parseRules(' PIX TRANSF FULANO=propria ; PIX TRANSF CICLANA=moradia:out;FINANCEIRA X=moto ');
    expect(categorize('Pix enviado Fulano de Tal', -900, rules)).toBe('propria');
    expect(categorize('Pix enviado Ciclana Souza', -1600, rules)).toBe('moradia');
    expect(categorize('PIX TRANSF CICLANA', 50, rules)).toBe('outros_in'); // :out não vale pra entrada
    expect(categorize('PAG BOLETO FINANCEIRA X', -800, rules)).toBe('moto');
    expect(categorize('Pix enviado Fulano de Tal', -900, [])).toBe('pessoas');
    expect(parseRules('')).toEqual([]);
    expect(() => parseRules('FULANO=nao_existe')).toThrow('CATEGORY_RULES');
    expect(() => parseRules('FULANO')).toThrow('CATEGORY_RULES');
  });

  it('guardar na caixinha/investimento não é gasto (nem o resgate é renda)', () => {
    expect(categorize('APLICACAO COFRINHOS', -2000)).toBe('investimento');
    expect(categorize('RESGATE COFRINHOS', 500)).toBe('investimento');
    expect(categorize('Aplicação Caixinha Viagem', -300)).toBe('investimento');
    expect(categorize('APLICACAO CDB', -1000)).toBe('investimento');
    expect(categorize('PIX TRANSF TESOURO DIRETO', -150)).toBe('investimento');
    // aplicação automática do Itaú continua como transferência própria
    expect(categorize('APL APLIC AUT MAIS', -2089.19)).toBe('propria');
    expect(categorize('Resgate RES APLIC AUT MAIS', 358.48)).toBe('propria');
  });
});
