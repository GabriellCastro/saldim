import styles from './ui.module.css';

type Variant = 'gold' | 'ghost' | 'outline';

export function Button({
  variant = 'gold',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={`${styles.btn} ${styles[variant]} ${className}`} {...props} />;
}
