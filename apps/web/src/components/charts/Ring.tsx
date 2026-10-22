/** Anel de progresso (0..1) com traço opcional marcando o ritmo esperado (0..1). */
const R = 15.9155;

export function Ring({
  ratio,
  color,
  size = 84,
  stroke = 3.4,
  tick,
  children,
}: {
  ratio: number;
  color: string;
  /** px ou CSS (ex.: '100%' para o pai controlar o tamanho) */
  size?: number | string;
  stroke?: number;
  tick?: number;
  children?: React.ReactNode;
}) {
  const pc = Math.max(0, Math.min(100, ratio * 100));
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg viewBox="0 0 42 42" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
        <circle cx="21" cy="21" r={R} fill="none" stroke="var(--s3)" strokeWidth={stroke} />
        {pc > 0 && (
          <circle cx="21" cy="21" r={R} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${pc.toFixed(2)} ${(100 - pc).toFixed(2)}`} />
        )}
        {tick != null && (
          <circle cx="21" cy="21" r={R} fill="none" stroke="var(--tx)" strokeWidth="5" strokeDasharray="0.6 99.4" strokeDashoffset={(-(tick * 100) + 0.3).toFixed(2)} />
        )}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>{children}</div>
    </div>
  );
}
