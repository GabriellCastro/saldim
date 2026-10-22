import Link from 'next/link';
import styles from './controls.module.css';

type Variant = 'gold' | 'outline' | 'ghost';
type Size = 'lg' | 'md' | 'sm';
type Common = { variant?: Variant; size?: Size; block?: boolean; className?: string };

const cls = ({ variant = 'gold', size = 'lg', block, className = '' }: Common) =>
  `${styles.pill} ${styles[size]} ${styles[variant]} ${block ? styles.block : ''} ${className}`;

/** Botão pílula do design (CTA dourado 52px com brilho, contorno ou fantasma). */
export function PillButton({
  variant,
  size,
  block,
  className,
  type = 'button',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & Common) {
  return <button type={type} className={cls({ variant, size, block, className })} {...props} />;
}

/** Mesmo visual do PillButton, como link do Next. */
export function PillLink({
  variant,
  size,
  block,
  className,
  ...props
}: React.ComponentProps<typeof Link> & Common) {
  return <Link className={cls({ variant, size, block, className })} {...props} />;
}
