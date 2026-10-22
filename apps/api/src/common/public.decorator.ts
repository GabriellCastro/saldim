import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'isPublic';
/** Marca rota como pública (sem JWT). Todas as outras exigem login. */
export const Public = () => SetMetadata(IS_PUBLIC, true);
