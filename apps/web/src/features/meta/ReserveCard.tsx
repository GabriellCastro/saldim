'use client';
import { pctCss } from '@/components/charts/geometry';
import { money } from '@/lib/format';
import { monthShort } from '@/lib/months';
import s from '@/features/dashboard/screen.module.css';
import type { ReserveLevel } from './types';
import { useGoal } from './useGoal';
import st from './reserve.module.css';

/** Cor de cada degrau (mínima → ideal → sonhos). */
const TONE: Record<ReserveLevel['id'], string> = { min: 'var(--warn)', ideal: 'var(--gold)', dream: 'var(--pos)' };
const WHAT: Record<ReserveLevel['id'], string> = {
  min: 'segura um aperto',
  ideal: 'perder a renda sem desespero',
  dream: 'liberdade pra escolher',
};

/** Reserva mínima, ideal e dos sonhos: régua com o guardado e quando chega em cada uma. */
export function ReserveCard({ hidden }: { hidden: boolean }) {
  const { data } = useGoal();
  const r = data?.reserve;
  if (!r || !r.levels.length || r.monthlyCost <= 0) return null;
  const top = r.levels[r.levels.length - 1].target || 1;
  const at = (v: number) => pctCss(Math.min(100, (v / top) * 100));
  const next = r.levels.find((l) => !l.reached);

  return (
    <div className={`${s.card} ${st.card}`}>
      <div className={s.head}>
        <span className={s.eyebrow}>Reserva</span>
        <span className={st.saved}>
          guardado <b>{money(r.saved, hidden)}</b>
        </span>
      </div>

      <p className={st.lead}>
        {next ? (
          <>
            Próximo degrau: <b style={{ color: TONE[next.id] }}>{next.label.toLowerCase()}</b>, faltam {money(next.target - r.saved, hidden)}.
          </>
        ) : (
          <>Tu chegou na reserva dos sonhos. 🎉</>
        )}
      </p>

      <div className={st.ruler} aria-hidden>
        <div className={st.fill} style={{ width: at(r.saved) }} />
        {r.levels.map((l) => (
          <span key={l.id} className={`${st.mark} ${l.reached ? st.markOn : ''}`} style={{ left: at(l.target), color: TONE[l.id] }} />
        ))}
      </div>

      <div className={st.levels}>
        {r.levels.map((l) => (
          <div key={l.id} className={st.level} style={{ borderTopColor: TONE[l.id] }}>
            <span className={st.name}>
              <span className={st.dot} style={{ background: TONE[l.id] }} />
              {l.label}
            </span>
            <span className={st.value}>{money(l.target, hidden)}</span>
            <span className={st.sub}>
              {l.months} meses {l.base === 'essencial' ? 'do essencial' : 'do custo de vida'} · {WHAT[l.id]}
            </span>
            <span className={l.reached ? st.ok : st.when}>
              {l.reached ? '✓ Tu já tem' : l.reachPlan ? `Chega em ${monthShort(l.reachPlan)} seguindo os limites` : 'Não chega em 5 anos com os limites de hoje'}
            </span>
          </div>
        ))}
      </div>

      <span className={s.small}>
        Custo de vida nos teus limites: {money(r.monthlyCost, hidden)}/mês (essencial: fixos, mercado e saúde, {money(r.essential, hidden)}).
      </span>
    </div>
  );
}
