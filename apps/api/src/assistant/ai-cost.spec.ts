import { aiCostUsd, toBrl, usdBrlRate } from './ai-cost';

describe('custo da IA', () => {
  it('Sonnet 5.5: US$ 2/M entrada, US$ 10/M saída', () => {
    // 3.000 de entrada + 500 de saída = 0,006 + 0,005
    expect(aiCostUsd('claude-sonnet-5-5', { input_tokens: 3000, output_tokens: 500 })).toBeCloseTo(0.011, 6);
  });

  it('cache: leitura a US$ 0,20/M e escrita a 1,25× a entrada', () => {
    const usd = aiCostUsd('claude-sonnet-5-5', {
      input_tokens: 0,
      output_tokens: 0,
      cache_read_input_tokens: 1_000_000,
      cache_creation_input_tokens: 1_000_000,
    });
    expect(usd).toBeCloseTo(0.2 + 2.5, 6);
  });

  it('modelo desconhecido → null (guarda os tokens, sem inventar preço)', () => {
    expect(aiCostUsd('modelo-x', { input_tokens: 10, output_tokens: 10 })).toBeNull();
  });

  it('converte pra reais com a cotação do .env (padrão 5,40)', () => {
    expect(usdBrlRate(undefined)).toBe(5.4);
    expect(usdBrlRate('5.1')).toBe(5.1);
    expect(usdBrlRate('abc')).toBe(5.4);
    expect(toBrl(1.5, 5.4)).toBe(8.1);
  });
});
