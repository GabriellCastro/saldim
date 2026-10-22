import { reconcile, type FileTx } from '../open-finance/mapping';
import type { ParsedRow } from './parsers';

export const txKey = (date: string, description: string, amount: number) =>
  `${date}|${description}|${Math.round(amount * 100)}`;

/**
 * Lançamentos idênticos no mesmo arquivo (mesmo dia, descrição e valor) são reais — ex.: dois cafés.
 * Para que caibam na chave única e o re-import continue idempotente, a 2ª ocorrência vira "DESC (2)", etc.
 */
export function numberRepeats<T extends ParsedRow>(rows: T[]): T[] {
  const seen = new Map<string, number>();
  return rows.map((r) => {
    const k = txKey(r.date, r.description, r.amount);
    const n = (seen.get(k) ?? 0) + 1;
    seen.set(k, n);
    return n === 1 ? r : { ...r, description: `${r.description} (${n})` };
  });
}

/**
 * Linhas do arquivo que ainda não estão na conta. Primeiro pela chave exata (reimportar o mesmo arquivo);
 * o resto casa por data e valor como o Open Finance ({@link reconcile}): o mesmo lançamento vem com
 * descrição diferente em cada fonte ("PAY Versa 08/10" no PDF, "Compra débito Versallesmix" na API).
 */
export function onlyNew<T extends ParsedRow>(rows: T[], existing: (FileTx & { description: string })[]): T[] {
  const rowKeys = new Set(rows.map((r) => txKey(r.date, r.description, r.amount)));
  const existingKeys = new Set(existing.map((t) => txKey(t.date, t.description, t.amount)));
  const pool = existing.filter((t) => !rowKeys.has(txKey(t.date, t.description, t.amount)));
  const pending = rows.filter((r) => !existingKeys.has(txKey(r.date, r.description, r.amount)));
  const { fresh } = reconcile(
    pending.map((r, i) => ({ ...r, externalId: String(i) })),
    pool,
  );
  return fresh.map((f) => pending[Number(f.externalId)]);
}
