import { Prisma } from '@prisma/client';

/** Converte Decimal do Prisma em number com 2 casas. Use em toda resposta da API. */
export const num = (v: Prisma.Decimal | number | null | undefined): number =>
  v == null ? 0 : Math.round(Number(v) * 100) / 100;
