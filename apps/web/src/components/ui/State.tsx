import Link from 'next/link';
import styles from './extra.module.css';

/** Bloco cinza de carregamento. */
export function Skeleton({ h = 120, className = '' }: { h?: number | string; className?: string }) {
  return <div className={`${styles.skel} ${className}`} style={{ height: h }} aria-busy="true" />;
}

/** Erro curto + tentar de novo. */
export function ErrorState({ onRetry, message = 'Não deu pra carregar agora.' }: { onRetry?: () => void; message?: string }) {
  return (
    <div className={styles.state}>
      <span>{message}</span>
      {onRetry && (
        <button type="button" className={styles.stateBtn} onClick={() => onRetry()}>
          Tentar de novo
        </button>
      )}
    </div>
  );
}

/** Vazio com CTA (ex.: sem extrato -> Carregar extrato). */
export function EmptyState({
  message = 'Ainda não tem extrato por aqui.',
  cta = 'Carregar extrato',
  href = '/bancos',
}: {
  message?: string;
  cta?: string;
  href?: string;
}) {
  return (
    <div className={styles.state}>
      <span>{message}</span>
      <Link href={href} className={styles.stateCta}>
        {cta}
      </Link>
    </div>
  );
}
