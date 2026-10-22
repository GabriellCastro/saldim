import { SCORE_COLOR } from '@/lib/password';
import styles from './auth.module.css';

/** 4 barras de força da senha (cor por pontuação 0–4, como no design). */
export function PasswordBars({ score }: { score: number }) {
  return (
    <span className={styles.bars} aria-label={`Força da senha: ${score} de 4`}>
      {[1, 2, 3, 4].map((i) => (
        <span key={i} className={styles.bar} style={i <= score ? { background: SCORE_COLOR[score] } : undefined} />
      ))}
    </span>
  );
}
