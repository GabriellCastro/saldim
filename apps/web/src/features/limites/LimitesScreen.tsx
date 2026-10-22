'use client';
import useSWR, { useSWRConfig } from 'swr';
import { Pill } from '@/components/ui/Pill';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/State';
import { Ring } from '@/components/charts/Ring';
import { fetcher, put } from '@/lib/api';
import { money } from '@/lib/format';
import { monthLong } from '@/lib/months';
import { useUser } from '@/lib/session';
import { cap } from '@/features/dashboard/fmt';
import type { BudgetItem, Budgets } from '@/features/dashboard/types';
import { GoalSummary } from '@/features/meta/GoalCard';
import { GOAL_KEY } from '@/features/meta/useGoal';
import { useScreenHead } from '@/features/shell/ShellContext';
import s from '@/features/dashboard/screen.module.css';
import st from './limites.module.css';

const STEP = 10;
const STATUS = {
  over: { label: 'Estourou', tone: 'neg', color: 'var(--neg)' },
  warn: { label: 'Atenção', tone: 'warn', color: 'var(--warn)' },
  ok: { label: 'No ritmo', tone: 'pos', color: 'var(--pos)' },
} as const;

export function LimitesScreen() {
  const { hidden } = useUser();
  const { mutate: mutateKey } = useSWRConfig();
  const budgets = useSWR<Budgets>('/budgets', fetcher);
  const b = budgets.data;
  useScreenHead(b ? `${cap(monthLong(b.month))} · dia ${b.day} de ${b.daysInMonth}` : undefined);

  if (budgets.error) return <ErrorState onRetry={() => budgets.mutate()} />;
  if (!b)
    return (
      <>
        <Skeleton h={180} />
        <div className={st.grid}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} h={220} />
          ))}
        </div>
      </>
    );

  const setLimit = async (item: BudgetItem, delta: number) => {
    const amount = Math.max(0, item.limit + delta);
    // otimista: só o limite muda na hora; status/ratio vêm do servidor
    await budgets.mutate(
      async (cur) => {
        const saved = await put<BudgetItem>(`/budgets/${item.category}`, { amount });
        return cur && { ...cur, items: cur.items.map((i) => (i.category === item.category ? saved : i)) };
      },
      {
        optimisticData: (cur) => cur! && { ...cur, items: cur.items.map((i) => (i.category === item.category ? { ...i, limit: amount } : i)) },
        rollbackOnError: true,
        revalidate: true,
      },
    );
    // limites mudam o plano: projeção/painel e a data da meta recalculam no servidor
    mutateKey((k) => typeof k === 'string' && k.startsWith('/dashboard/'));
    mutateKey(GOAL_KEY);
  };


  return (
    <>
      <GoalSummary hidden={hidden} />

      {!b.items.length ? (
        <EmptyState message="Sem categorias variáveis com limite ainda." />
      ) : (
        <div className={st.grid}>
          {b.items.map((it) => {
            const sc = STATUS[it.status] ?? STATUS.ok;
            return (
              <div key={it.category} className={`${s.card} ${st.limit}`}>
                <div className={st.ringBox}>
                  <Ring ratio={it.ratio} color={sc.color} size="100%" tick={b.day / b.daysInMonth}>
                    <span className={st.pct}>{Math.round(it.ratio * 100)}%</span>
                  </Ring>
                </div>
                <div className={st.title}>
                  <span className={st.label}>{it.label}</span>
                  <Pill tone={sc.tone} className={st.pill}>
                    {sc.label}
                  </Pill>
                </div>
                <div className={st.values}>
                  <span className={st.spent}>{money(it.spent, hidden)}</span>
                  <span className={st.avg}>
                    <span className={st.dot}>· </span>média {money(it.avg, hidden)}
                  </span>
                </div>
                <div className={st.stepper}>
                  <button type="button" onClick={() => setLimit(it, -STEP)} disabled={it.limit <= 0} aria-label={`Diminuir limite de ${it.label}`}>
                    −
                  </button>
                  <span>
                    limite <b>{money(it.limit, hidden)}</b>
                  </span>
                  <button type="button" onClick={() => setLimit(it, STEP)} aria-label={`Aumentar limite de ${it.label}`}>
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className={`${s.note} ${s.dOnly}`}>O traço no anel marca o ritmo esperado para o dia {b.day}. Gastos fixos ficam fora dos limites.</div>
    </>
  );
}
