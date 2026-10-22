'use client';
import { monthLong, prevMonth } from '@/lib/months';
import { cap } from '@/features/dashboard/fmt';
import st from './gastos.module.css';

/** 'YYYY-MM' ou 'all' (todos os meses). */
export type Period = string;
export const ALL: Period = 'all';

const monthName = (ym: string) => `${cap(monthLong(ym))} ${ym.slice(0, 4)}`;

/** Rótulo do período pra títulos: "outubro", "todos os meses". */
export const periodLabel = (p: Period) => (p === ALL ? 'todos os meses' : monthLong(p));

/** Filtro de período da tela Gastos: Este mês · Mês passado · Outro mês ▾ · Todos. */
export function PeriodFilter({
  value,
  onChange,
  thisMonth,
  months,
}: {
  value: Period;
  onChange: (p: Period) => void;
  /** mês corrente (do lançamento mais recente) */
  thisMonth: string;
  /** meses com lançamentos, mais recente primeiro */
  months: string[];
}) {
  const lastMonth = prevMonth(thisMonth);
  const others = months.filter((m) => m !== thisMonth && m !== lastMonth);
  const isOther = value !== ALL && value !== thisMonth && value !== lastMonth;
  const quick: [Period, string][] = [
    [thisMonth, 'Este mês'],
    [lastMonth, 'Mês passado'],
  ];

  const btn = (p: Period, label: string) => (
    <button key={p} type="button" role="radio" aria-checked={value === p} className={`${st.periodBtn} ${value === p ? st.periodOn : ''}`} onClick={() => onChange(p)}>
      {label}
    </button>
  );

  return (
    <div className={st.period} role="radiogroup" aria-label="Período">
      {quick.map(([p, label]) => btn(p, label))}
      {others.length > 0 && (
        <label className={`${st.periodBtn} ${st.periodSelect} ${isOther ? st.periodOn : ''}`}>
          <span>{isOther ? monthName(value) : 'Outro mês'}</span>
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
            <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <select aria-label="Escolher mês" value={isOther ? value : ''} onChange={(e) => e.target.value && onChange(e.target.value)}>
            <option value="" disabled>
              Escolher mês
            </option>
            {others.map((m) => (
              <option key={m} value={m}>
                {monthName(m)}
              </option>
            ))}
          </select>
        </label>
      )}
      {btn(ALL, 'Todos')}
    </div>
  );
}
