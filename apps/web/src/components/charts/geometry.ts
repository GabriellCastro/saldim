/** Helpers de geometria para os gráficos SVG feitos à mão (sem lib de chart). */

/** Escala linear [d0,d1] -> [r0,r1]. */
export const scale = (d0: number, d1: number, r0: number, r1: number) => (v: number) =>
  d1 === d0 ? r0 : r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);

/** "M x y L x y …" a partir de pontos. */
export const linePath = (pts: [number, number][]) =>
  pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');

/** Área fechada sob a linha até `baseY`. */
export const areaPath = (pts: [number, number][], baseY: number) =>
  pts.length ? `${linePath(pts)} L${pts[pts.length - 1][0].toFixed(1)} ${baseY.toFixed(1)} L${pts[0][0].toFixed(1)} ${baseY.toFixed(1)} Z` : '';

/** Limita 0..100 e formata como "%" para width/height CSS. */
export const pctCss = (v: number) => `${Math.max(0, Math.min(100, v)).toFixed(2)}%`;
