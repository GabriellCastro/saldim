import { LogoGlyph } from './LogoGlyph';
import styles from './controls.module.css';

/** Logo (símbolo do Saldim) dourado com brilho + nome. */
export function BrandMark({ small, showName = true }: { small?: boolean; showName?: boolean }) {
  return (
    <div className={styles.brand}>
      <div className={`${styles.logo} ${small ? styles.logoSm : ''}`}><LogoGlyph size={small ? 18 : 20} /></div>
      {showName && <div className={styles.brandName}>Saldim</div>}
    </div>
  );
}
