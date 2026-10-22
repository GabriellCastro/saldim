import styles from './controls.module.css';

/** Trilho 44×26 do design; dourado com brilho quando ligado. Puramente visual — o clique fica no pai. */
export function Switch({ on }: { on: boolean }) {
  return <span aria-hidden className={`${styles.switch} ${on ? styles.switchOn : ''}`} />;
}
