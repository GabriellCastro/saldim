/** Rosca de participações (circunferência = 100, como no design). */
const R = 15.9155;

export type DonutSlice = { value: number; color: string };

export function Donut({
  slices,
  active = null,
  size = 172,
  children,
}: {
  slices: DonutSlice[];
  active?: number | null;
  size?: number | string;
  children?: React.ReactNode;
}) {
  const total = slices.reduce((a, s) => a + s.value, 0) || 1;
  const gap = 0.6;
  let cum = 0;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg viewBox="0 0 42 42" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
        <circle cx="21" cy="21" r={R} fill="none" stroke="var(--s3)" strokeWidth="4.2" />
        {slices.map((s, i) => {
          const sh = (s.value / total) * 100;
          const el = (
            <circle
              key={i}
              cx="21"
              cy="21"
              r={R}
              fill="none"
              stroke={s.color}
              strokeWidth={active === i ? 5.6 : 4.2}
              strokeDasharray={`${Math.max(0, sh - gap).toFixed(2)} ${(100 - sh + gap).toFixed(2)}`}
              strokeDashoffset={(-cum).toFixed(2)}
              style={{ transition: 'stroke-width .15s' }}
            />
          );
          cum += sh;
          return el;
        })}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, textAlign: 'center' }}>
        {children}
      </div>
    </div>
  );
}

/** Paleta categórica do donut (tokens). */
export const DONUT_COLORS = ['var(--gold)', 'var(--chart-2)', 'var(--red)', 'var(--chart-4)', 'var(--bar)', 'var(--chart-6)'];
