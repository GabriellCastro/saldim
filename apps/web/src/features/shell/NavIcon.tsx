import { NAV_ICONS } from './heads';

/** Ícone de uma tela (por href), em traço, herda a cor do texto. */
export function NavIcon({ href, size = 18, className }: { href: string; size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={NAV_ICONS[href] ?? 'M5 12h14'} />
    </svg>
  );
}
