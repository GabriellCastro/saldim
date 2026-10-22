import { createHash, randomBytes } from 'node:crypto';

/** Por quanto tempo um aparelho fica lembrado sem uso (cada uso renova). */
export const DEVICE_TTL_MS = 90 * 24 * 60 * 60 * 1000;

/** Token opaco que vai no cookie `saldim_device` (256 bits, base64url). */
export const newDeviceToken = (): string => randomBytes(32).toString('base64url');

/** O banco guarda só o hash: vazar a tabela não permite entrar. */
export const hashDeviceToken = (token: string): string => createHash('sha256').update(token).digest('hex');

export const deviceExpiry = (now = new Date()): Date => new Date(now.getTime() + DEVICE_TTL_MS);
