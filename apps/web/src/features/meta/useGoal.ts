import useSWR, { useSWRConfig } from 'swr';
import { fetcher } from '@/lib/api';
import type { GoalCurrent, GoalHistoryItem } from './types';

export const GOAL_KEY = '/goals/current';
export const HISTORY_KEY = '/goals/history';
export const useGoal = () => useSWR<GoalCurrent>(GOAL_KEY, fetcher);
/** `ready`: só busca depois do /goals/current, que é quem grava o dia em que a meta bateu */
export const useGoalHistory = (ready = true) => useSWR<GoalHistoryItem[]>(ready ? HISTORY_KEY : null, fetcher);

/** Grava (PUT/POST que devolve GoalCurrent), põe no cache e recalcula painel/projeção. */
export function useApplyGoal() {
  const { mutate } = useSWRConfig();
  return async (req: Promise<GoalCurrent>) => {
    const next = await req;
    await mutate(GOAL_KEY, next, { revalidate: false });
    mutate((k) => typeof k === 'string' && (k.startsWith('/dashboard/') || k === HISTORY_KEY));
  };
}
