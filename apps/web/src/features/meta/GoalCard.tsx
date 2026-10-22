'use client';
import { money } from '@/lib/format';
import { monthShort } from '@/lib/months';
import s from '@/features/dashboard/screen.module.css';
import { useGoal } from './useGoal';
import st from './meta.module.css';

/** Resumo pra tela Limites: com esses limites, quando a meta chega. */
export function GoalSummary({ hidden }: { hidden: boolean }) {
  const { data } = useGoal();
  const p = data?.plan;
  if (!data?.goal || !p || p.status === 'reached') return null;
  return (
    <div className={`${s.card} ${st.summary}`}>
      <div>
        <span className={s.eyebrow}>{data.goal.name}</span>
        {p.status === 'onTrack' ? (
          <p className={st.text}>
            Com esses limites, tu bate {money(data.goal.target, hidden)} em <b className={s.gold}>{monthShort(p.reachPlan!)}</b>, guardando uns{' '}
            {money(p.savePerMonth, hidden)} por mês. Baixa um limite e a data chega mais cedo.
          </p>
        ) : (
          <p className={st.warn}>Com esses limites a meta não chega em 5 anos. Baixa os limites das categorias que mais pesam.</p>
        )}
      </div>
    </div>
  );
}
