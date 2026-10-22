import styles from './ui.module.css';

export function Field({
  label,
  hint,
  error,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string }) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <input className={styles.input} aria-invalid={!!error} {...props} />
      {error ? <span className={styles.fieldError}>{error}</span> : hint && <span className={styles.fieldHint}>{hint}</span>}
    </label>
  );
}

export function SelectField({
  label,
  hint,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; hint?: string }) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <select className={`${styles.input} ${styles.select}`} {...props}>
        {children}
      </select>
      {hint && <span className={styles.fieldHint}>{hint}</span>}
    </label>
  );
}

export function TextAreaField({
  label,
  hint,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string }) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <textarea className={`${styles.input} ${styles.textarea}`} {...props} />
      {hint && <span className={styles.fieldHint}>{hint}</span>}
    </label>
  );
}
