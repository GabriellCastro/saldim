'use client';
import { pctCss } from '@/components/charts/geometry';
import { ErrorState, Skeleton } from '@/components/ui/State';
import { ddmm, money } from '@/lib/format';
import s from '@/features/dashboard/screen.module.css';
import type { Tx } from '@/features/dashboard/types';
import { useUnexpected } from './useUnexpected';
import st from './imprevistos.module.css';

/** Card "Imprevistos": total do período, quanto foi em cada tipo e a lista com a justificativa. */
export function UnexpectedCard({ month, periodName, hidden, onPick }: {
  /** 'YYYY-MM' ou 'all' */
  month: string;
  periodName: string;
  hidden: boolean;
  onPick: (tx: Tx) => void;
}) {
  const { data, error, mutate } = useUnexpected(month);
  if (error) return <div className={s.card}><ErrorState onRetry={() => mutate()} /></div>;
  if (!data) return <Skeleton h={180} />;
  const max = data.byType[0]?.amount || 1;
  return (
    <div className={`${s.card} ${st.card}`}>
      <div className={s.head}>
        <span className={s.eyebrow}>Imprevistos · {periodName}</span>
        {data.count > 0 && (
          <span className={st.count}>
            {data.count} {data.count === 1 ? 'gasto' : 'gastos'}
          </span>
        )}
      </div>
      {!data.count ? (
        <p className={s.small}>
          Nada marcado como imprevisto. Gasto que pegou tu de surpresa (remédio, conserto, multa)? Toca nele na lista de lançamentos e marca: ele sai da média
          e dos limites, e eu ajusto a data da meta.
        </p>
      ) : (
        <>
          <div className={st.total}>
            <span className={st.big}>{money(data.total, hidden)}</span>
            <span className={st.of}>fora do plano</span>
          </div>
          <div className={st.types}>
            {data.byType.map((g) => (
              <div key={g.type} className={st.typeRow}>
                <div className={st.typeName}>
                  <span>{g.label}</span>
                  <span className={st.typeVal}>{money(g.amount, hidden)}</span>
                </div>
                <div className={st.typeBar}>
                  <div style={{ width: pctCss((g.amount / max) * 100) }} />
                </div>
              </div>
            ))}
          </div>
          <ul className={st.items}>
            {data.items.map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => onPick(t)}>
                  <span className={st.itemName}>{t.description}</span>
                  <span className={st.itemVal}>{money(Math.abs(t.amount), hidden)}</span>
                  <span className={st.itemMeta}>
                    {ddmm(t.date)} · {t.unexpectedLabel}
                  </span>
                  {t.unexpectedNote && <span className={st.note}>“{t.unexpectedNote}”</span>}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
