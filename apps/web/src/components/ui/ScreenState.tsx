import styles from './ScreenState.module.css';

/** Placeholder de carregamento: blocos `var(--s2)` com as alturas dadas. */
export function Skeleton({ heights = [120, 320] }: { heights?: number[] }) {
  return (
    <div className={styles.skeleton} aria-busy="true" aria-label="Carregando">
      {heights.map((h, i) => (
        <div key={i} className={styles.block} style={{ height: h }} />
      ))}
    </div>
  );
}

/** Erro de carregamento com "Tentar de novo". */
export function LoadError({ message = 'Não deu pra carregar agora.', onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className={styles.error} role="alert">
      <span>{message}</span>
      {onRetry && (
        <button type="button" className={styles.retry} onClick={onRetry}>
          Tentar de novo
        </button>
      )}
    </div>
  );
}
