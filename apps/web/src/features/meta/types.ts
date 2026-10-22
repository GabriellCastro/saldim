export type GoalStatus = 'reached' | 'onTrack' | 'tooSlow';
/** categoria que o plano segura: média do mês passado → limite (contas recorrentes `committed` ficam fora do corte) */
export type GoalCut = { category: string; label: string; avg: number; limit: number; committed: number; cut: number };
export type GoalPlan = {
  missing: number;
  status: GoalStatus;
  /** YYYY-MM em que bate seguindo os limites (null = não chega em 5 anos) */
  reachPlan: string | null;
  monthsPlan: number | null;
  savePerMonth: number;
  /** gastando como o mês passado */
  reachToday: string | null;
  paceToday: number;
  cuts: GoalCut[];
  /** imprevistos do mês atual e quantos meses empurraram a meta */
  unexpected: { amount: number; delayMonths: number };
};
export type ReserveLevel = {
  id: 'min' | 'ideal' | 'dream';
  label: string;
  months: number;
  /** essencial = fixos + mercado + saúde; custo = fixos + todos os variáveis (nos limites) */
  base: 'essencial' | 'custo';
  target: number;
  reached: boolean;
  /** YYYY-MM seguindo os limites; null = já tem ou não chega em 5 anos */
  reachPlan: string | null;
};
export type Reserve = { saved: number; essential: number; monthlyCost: number; levels: ReserveLevel[] };
/** meta batida (GET /goals/history); active = bateu mas a próxima ainda não foi criada */
export type GoalHistoryItem = { id: string; name: string; target: number; createdAt: string; reachedAt: string; days: number; active: boolean };
export type GoalCurrent = {
  /** reachedAt: YYYY-MM-DD em que o guardado bateu o alvo (null = ainda não) */
  goal: { id: string; name: string; target: number; reachedAt: string | null } | null;
  /** guardado de agora: base informada + o que foi pro cofrinho depois */
  saved: number;
  savedAt: string | null;
  /** quanto entrou (−saiu) do cofrinho neste mês */
  savedMonth: number;
  plan: GoalPlan | null;
  reserve: Reserve;
};
