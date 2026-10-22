import styles from './extra.module.css';

type Tone = 'pos' | 'warn' | 'neg' | 'mu' | 'gold';

/** Etiqueta de status contornada (ex.: "ESTOUROU", "NO RITMO"). */
export function Pill({ tone = 'mu', className = '', ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return <span className={`${styles.pill} ${styles[`t_${tone}`]} ${className}`} {...props} />;
}

/** Chip clicável (ex.: atalhos "Fim do ano", "6 meses"). */
export function Chip({ active = false, className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return <button type="button" className={`${styles.chip} ${active ? styles.chipOn : ''} ${className}`} {...props} />;
}

/** Marcador "• IA" dourado usado nos cards de insight. */
export function AiMark({ className = '' }: { className?: string }) {
  return (
    <div className={`${styles.ai} ${className}`}>
      <span className={styles.aiDot} />
      <span>IA</span>
    </div>
  );
}
