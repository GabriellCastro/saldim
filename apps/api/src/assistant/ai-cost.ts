/**
 * Custo das respostas da IA. Preços em US$ por milhão de tokens (tabela da Anthropic, out/2026).
 * Escrita de cache = 1,25× a entrada. O pensamento (thinking) já vem somado em output_tokens.
 * Modelo fora da tabela → custo null (os tokens ficam salvos; atualize aqui se trocar o ANTHROPIC_MODEL).
 */
const PRICES: Record<string, { input: number; output: number; cacheRead: number }> = {
  'claude-sonnet-5-5': { input: 2, output: 10, cacheRead: 0.2 },
  'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2 },
  // cache read do Haiku 5.5 estimado em 0,1× a entrada (prompts até 100K tokens)
  'claude-haiku-5-5': { input: 0.1, output: 0.5, cacheRead: 0.01 },
};

/** Campos de `response.usage` que entram na conta. */
export interface AiUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}

export function aiCostUsd(model: string, u: AiUsage): number | null {
  const p = PRICES[model];
  if (!p) return null;
  const perToken =
    u.input_tokens * p.input +
    u.output_tokens * p.output +
    (u.cache_read_input_tokens ?? 0) * p.cacheRead +
    (u.cache_creation_input_tokens ?? 0) * p.input * 1.25;
  return perToken / 1_000_000;
}

export const DEFAULT_USD_BRL = 5.4;

/** Cotação do .env (`USD_BRL`); inválida ou ausente → 5,40. */
export const usdBrlRate = (raw: string | undefined): number => {
  const v = Number(raw);
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_USD_BRL;
};

export const toBrl = (usd: number, rate: number): number => Math.round(usd * rate * 100) / 100;
