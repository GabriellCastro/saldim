/** Símbolo do Saldim: duas metades de moeda que formam um S. Herda a cor do texto. */
export function LogoGlyph({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.5 3A4.5 4.5 0 0 0 12.5 12Z" />
      <path d="M11.5 12A4.5 4.5 0 0 1 11.5 21Z" />
    </svg>
  );
}
