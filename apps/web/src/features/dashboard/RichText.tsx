import { Fragment } from 'react';

const TOKEN = /([−-]?R\$\s?[\d.]+,\d{2})|(\b(?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\/\d{2}\b)/g;

/**
 * Texto de insight da API com os números em negrito, como no design:
 * valores negativos em vermelho, o valor depois de "sobra" em verde, meses em dourado.
 * Em modo privacidade os valores viram "R$ ••••".
 */
export function RichText({ text, hidden = false }: { text: string; hidden?: boolean }) {
  const out: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    const i = m.index ?? 0;
    const before = text.slice(last, i);
    out.push(before);
    if (m[1]) {
      const neg = /^[−-]/.test(m[1]);
      const pos = !neg && /sobra\s*$/i.test(before);
      out.push(
        <b style={{ fontWeight: 700, color: neg ? 'var(--neg)' : pos ? 'var(--pos)' : undefined }}>{hidden ? 'R$ ••••' : m[1]}</b>,
      );
    } else {
      out.push(<b style={{ fontWeight: 700, color: 'var(--goldTx)' }}>{m[2]}</b>);
    }
    last = i + m[0].length;
  }
  out.push(text.slice(last));
  return (
    <>
      {out.map((n, k) => (
        <Fragment key={k}>{n}</Fragment>
      ))}
    </>
  );
}
