import styles from './ui.module.css';

/** Superfície "glass" padrão do design (borda dourada sutil). */
export function Card({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`${styles.card} ${className}`} {...props} />;
}

/** Rótulo em caixa alta espaçada (ex.: "RESERVA PROJETADA EM"). */
export function Eyebrow({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`${styles.eyebrow} ${className}`} {...props} />;
}
