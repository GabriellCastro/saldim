'use client';
import { useState } from 'react';
import { Button } from '@/components/ui';
import { pctCss } from '@/components/charts/geometry';
import { ErrorState } from '@/components/ui/State';
import { money } from '@/lib/format';
import { dayMonthLong, monthShort } from '@/lib/months';
import s from '@/features/dashboard/screen.module.css';
import { GoalForms, tookLabel, type GoalModal } from './GoalForms';
import type { ReserveLevel } from './types';
import { useGoal, useGoalHistory } from './useGoal';
import st from './meta.module.css';

const TONE: Record<ReserveLevel['id'], string> = { min: 'var(--warn)', ideal: 'var(--gold)', dream: 'var(--pos)' };

/**
 * Guardado: um card só pra meta e reserva (as duas medem o mesmo dinheiro). O guardado sobe sozinho
 * com o que vai pro cofrinho; "Corrigir valor" acerta a base (rendimento, conta fora do app).
 * Meta batida: o card fica dourado e chama pra próxima, sem obrigar (a data já foi pro histórico).
 */
export function SavingsCard({ hidden }: { hidden: boolean }) {
  const { data, error, mutate } = useGoal();
  const [open, setOpen] = useState<GoalModal>(null);
  const history = useGoalHistory(!!data).data ?? [];
  if (error) return <div className={`${s.card} ${st.card}`}><ErrorState onRetry={() => mutate()} /></div>;
  if (!data) return <div className={`${s.card} ${st.card}`} aria-busy />;
  const g = data.goal;
  const p = data.plan;
  const levels = data.reserve.monthlyCost > 0 ? data.reserve.levels : [];
  const won = !!g && p?.status === 'reached';
  const took = history.find((h) => h.active);

  return (
    <div className={`${s.card} ${st.card} ${won ? st.won : ''}`}>
      <div className={st.head}>
        <span className={s.eyebrow}>Guardado</span>
        {data.savedMonth !== 0 && (
          <span className={`${st.monthFlow} ${data.savedMonth > 0 ? s.pos : s.neg}`}>
            {data.savedMonth > 0 ? '+' : '−'}
            {money(Math.abs(data.savedMonth), hidden)} no cofrinho este mês
          </span>
        )}
      </div>
      <p className={st.big}>{money(data.saved, hidden)}</p>

      {won ? (
        <div className={st.win}>
          <span className={st.winTitle}>
            <span className={st.winIcon} aria-hidden>🎉</span> Meta batida!
          </span>
          <p className={st.text}>
            <b>{g.name}</b> · {money(g.target, hidden)}
            {g.reachedAt && (
              <span className={st.muted}>
                {' '}· bateu em {dayMonthLong(g.reachedAt)}{took ? `, ${tookLabel(took.days).replace('bateu ', '')}` : ''}
              </span>
            )}
          </p>
          <p className={st.text}>Bora pra próxima? Tu define quanto somar em cima dessa.</p>
          <Button onClick={() => setOpen('next')}>Definir próxima meta</Button>
        </div>
      ) : !g || !p ? (
        <p className={st.text}>Cria uma meta: diz só o valor e eu calculo quando tu chega lá pelos teus gastos e limites.</p>
      ) : (
        <div className={st.goalBox}>
          <div className={st.goalHead}>
            <span>{g.name}</span>
            <span className={st.muted}>de {money(g.target, hidden)}</span>
          </div>
          <div className={st.track} role="progressbar" aria-label="Progresso da meta" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.min(100, (data.saved / g.target) * 100))}>
            <div style={{ width: pctCss(Math.min(100, (data.saved / g.target) * 100)) }} />
          </div>
          {p.status === 'tooSlow' ? (
            <p className={st.warn}>Com os limites de hoje não chega em 5 anos. Baixa os limites pra criar uma sobra.</p>
          ) : (
            <p className={st.text}>
              Tu bate em <b className={s.gold}>{monthShort(p.reachPlan!)}</b> guardando uns <b>{money(p.savePerMonth, hidden)}</b>/mês.
            </p>
          )}
        </div>
      )}

      {levels.length > 0 && (
        <div className={st.levels}>
          {levels.map((l) => (
            <div key={l.id} className={st.level}>
              <span className={st.levelName}>
                <span className={st.dot} style={{ background: TONE[l.id] }} />
                {l.label}
                <span className={st.muted}> · {money(l.target, hidden)}</span>
              </span>
              <span className={l.reached ? st.ok : st.muted}>{l.reached ? '✓ tem' : l.reachPlan ? monthShort(l.reachPlan) : '+5 anos'}</span>
            </div>
          ))}
        </div>
      )}

      <div className={st.actions}>
        {!g || !p ? (
          <Button onClick={() => setOpen('goal')}>Criar meta</Button>
        ) : null}
        {g && p && (
          <button type="button" className={st.edit} onClick={() => setOpen('goal')}>
            Editar meta
          </button>
        )}
        <button type="button" className={st.edit} onClick={() => setOpen('saved')}>
          Corrigir valor
        </button>
        {history.length > 0 && (
          <button type="button" className={st.edit} onClick={() => setOpen('history')}>
            Metas batidas ({history.length})
          </button>
        )}
      </div>
      <GoalForms open={open} data={data} history={history} hidden={hidden} onClose={() => setOpen(null)} />
    </div>
  );
}
