'use client';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import type { Overview, Projection, Spending } from './types';

export const useOverview = () => useSWR<Overview>('/dashboard/overview', fetcher);

/** Projeção com/sem o plano da IA; `alt` traz a outra linha do gráfico. */
export const useProjection = (plan: boolean, months?: number) =>
  useSWR<Projection>(`/dashboard/projection?plan=${plan}${months ? `&months=${months}` : ''}`, fetcher, { keepPreviousData: true });

/**
 * Gastos por categoria. `month`: 'YYYY-MM', 'all' (todos) ou omitido (a API usa o mês anterior a "hoje").
 * `null` = ainda não sei o mês: não busca.
 */
export const useSpending = (month?: string | null) =>
  useSWR<Spending>(month === null ? null : month ? `/dashboard/spending?month=${month}` : '/dashboard/spending', fetcher, {
    keepPreviousData: true,
  });

/** Índice do mês 'YYYY-MM' na projeção (ou -1). */
export const monthIndex = (p: Projection, ym: string | null | undefined) => (ym ? p.months.findIndex((m) => m.month.slice(0, 7) === ym.slice(0, 7)) : -1);

/** Rótulo do mês em que a meta bate ("dez/26") ou "após dez/27". */
export const reachedLabel = (p: Projection, ym: string | null | undefined) => {
  const i = monthIndex(p, ym);
  return i >= 0 ? p.months[i].label : `após ${p.months[p.months.length - 1]?.label ?? ''}`;
};
