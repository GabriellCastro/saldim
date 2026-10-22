import styles from './extra.module.css';

type Option<T extends string | boolean> = { value: T; label: string };

/**
 * Toggle em pílula (ex.: "Gastando como hoje / Com o plano da IA").
 * `stretch` divide a largura igualmente (versão mobile).
 */
export function Segmented<T extends string | boolean>({
  options,
  value,
  onChange,
  stretch = false,
  className = '',
}: {
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
  stretch?: boolean;
  className?: string;
}) {
  return (
    <div className={`${styles.seg} ${stretch ? styles.segStretch : ''} ${className}`} role="radiogroup">
      {options.map((o) => {
        const on = o.value === value;
        // a opção "ligada" de valor true (plano IA) fica dourada; as demais, cinza
        const tone = on ? (o.value === true ? styles.segGold : styles.segOn) : '';
        return (
          <button key={String(o.value)} type="button" role="radio" aria-checked={on} className={`${styles.segBtn} ${tone}`} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
