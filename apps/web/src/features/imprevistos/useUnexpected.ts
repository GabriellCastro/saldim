'use client';
import useSWR, { useSWRConfig } from 'swr';
import { fetcher } from '@/lib/api';
import type { Tx } from '@/features/dashboard/types';

export type UnexpectedType = { id: string; label: string };
export type UnexpectedSummary = {
  /** 'YYYY-MM' ou 'all' */
  month: string;
  total: number;
  count: number;
  byType: { type: string; label: string; count: number; amount: number }[];
  items: Tx[];
};

/** Tipos de imprevisto (catálogo da API). */
export const useUnexpectedTypes = () => useSWR<UnexpectedType[]>('/categories/unexpected', fetcher, { revalidateOnFocus: false });

/** Imprevistos do período (`null` = ainda não sei o período: não busca). */
export const useUnexpected = (month: string | null) =>
  useSWR<UnexpectedSummary>(month === null ? null : `/transactions/unexpected?month=${month}`, fetcher, { keepPreviousData: true });

/** Depois de marcar/desmarcar: lançamentos, imprevistos, painel e meta mudam juntos. */
export function useRefreshAfterTx() {
  const { mutate } = useSWRConfig();
  return () =>
    mutate((k) => typeof k === 'string' && (k.includes('/transactions') || k.startsWith('/dashboard/') || k.startsWith('/goals/')));
}
