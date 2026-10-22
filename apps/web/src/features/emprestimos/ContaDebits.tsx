'use client';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { ddmm } from '@/lib/format';
import { monthShort } from '@/features/holerite/month';
import styles from './Emprestimos.module.css';

type Tx = { id: string; date: string; description: string; amount: number };
type Page = { items: Tx[]; nextCursor: string | null };

/**
 * Débitos de empréstimo que aparecem no extrato (categoria `emprestimo`) agrupados por contrato,
 * e os créditos de empréstimo recebidos (`emprestimo_in`). Só agrupa/soma o que a API devolve.
 */
export function ContaDebits({ f }: { f: (v: number) => string }) {
  const debits = useSWR<Page>('/transactions?category=emprestimo&take=200', fetcher);
  const credits = useSWR<Page>('/transactions?category=emprestimo_in&take=200', fetcher);

  const groups = new Map<string, { total: number; last: string }>();
  for (const t of debits.data?.items ?? []) {
    const name = t.description.replace(/CREDITO CONSIGNADO/i, 'Consignado');
    const g = groups.get(name) ?? { total: 0, last: t.date };
    g.total += t.amount;
    if (t.date > g.last) g.last = t.date;
    groups.set(name, g);
  }
  const inItems = credits.data?.items ?? [];
  const inTotal = inItems.reduce((s, t) => s + t.amount, 0);
  const months = inItems.map((t) => t.date.slice(0, 7)).sort();
  const span =
    months.length === 0
      ? ''
      : months[0] === months[months.length - 1]
        ? monthShort(months[0]).slice(0, 3)
        : `${monthShort(months[0]).slice(0, 3)}–${monthShort(months[months.length - 1]).slice(0, 3)}`;

  if (!groups.size && !inTotal) return null;
  return (
    <>
      {inTotal > 0 && (
        <span className={styles.contaIn}>
          {f(inTotal)} em novos créditos ({span})
        </span>
      )}
      {[...groups].map(([name, g]) => (
        <div key={name} className={styles.contaRow}>
          <span>
            {name} <span className={styles.muted}>· último {ddmm(g.last)}</span>
          </span>
          <span className={styles.strong}>{f(g.total)}</span>
        </div>
      ))}
    </>
  );
}
