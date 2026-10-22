import type { CookieOptions, Response } from 'express';
import type { JwtService } from '@nestjs/jwt';
import { AUTH_COOKIE } from '../common/jwt-auth.guard';

import { DEVICE_TTL_MS } from './trusted-device';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
/** Cookie do aparelho lembrado: sobrevive ao logout e só vai pras rotas /auth/device. */
export const DEVICE_COOKIE = 'saldim_device';
/** Em produção a API fica atrás do Caddy em `/api` (API_BASE_PATH): o navegador vê `/api/auth/device`. */
const DEVICE_COOKIE_PATH = `${process.env.API_BASE_PATH ?? ''}/auth/device`;

export const authCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
});

/** Assina o JWT ({sub, email}) e grava o cookie httpOnly `saldim_token` (7 dias). */
export async function setAuthCookie(
  res: Response,
  jwt: JwtService,
  user: { id: string; email: string },
): Promise<void> {
  const token = await jwt.signAsync({ sub: user.id, email: user.email });
  res.cookie(AUTH_COOKIE, token, { ...authCookieOptions(), maxAge: SEVEN_DAYS_MS });
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(AUTH_COOKIE, authCookieOptions());
}

export function setDeviceCookie(res: Response, token: string): void {
  res.cookie(DEVICE_COOKIE, token, { ...authCookieOptions(), path: DEVICE_COOKIE_PATH, maxAge: DEVICE_TTL_MS });
}

export function clearDeviceCookie(res: Response): void {
  res.clearCookie(DEVICE_COOKIE, { ...authCookieOptions(), path: DEVICE_COOKIE_PATH });
}
