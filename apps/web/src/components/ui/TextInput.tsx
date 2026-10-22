import styles from './controls.module.css';

/** Campo do design "Acesso e Perfil": rótulo 12px, input 50px com foco dourado. */
export function TextInput({
  label,
  labelAside,
  adornment,
  error,
  children,
  className = '',
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  /** sem rótulo visível: usa aria-label */
  label?: string;
  /** conteúdo à direita do rótulo (ex.: "Esqueci a senha") */
  labelAside?: React.ReactNode;
  /** botão dentro do input, à direita (ex.: "Mostrar") */
  adornment?: React.ReactNode;
  error?: string;
  /** conteúdo abaixo do input (ex.: barras de força) */
  children?: React.ReactNode;
}) {
  return (
    <label className={styles.field}>
      {(label || labelAside) && (
        <span className={styles.label}>
          <span>{label}</span>
          {labelAside}
        </span>
      )}
      <span className={styles.control}>
        <input
          className={`${styles.input} ${adornment ? styles.withAdornment : ''} ${className}`}
          aria-invalid={!!error || undefined}
          aria-label={label ? undefined : props.placeholder}
          {...props}
        />
        {adornment && <span className={styles.adornment}>{adornment}</span>}
      </span>
      {children}
      {error && <span className={styles.error}>{error}</span>}
    </label>
  );
}
