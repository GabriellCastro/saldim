'use client';
import { patch, post } from '@/lib/api';
import type { User } from '@/lib/session';
/**
 * Lembra quem entrou neste dispositivo (só nome + se o rosto está ativo) para mostrar
 * "Entrar com reconhecimento facial · neste dispositivo" no login. Nada sensível.
 */
const KEY = 'saldim_device_user';
export type DeviceUser = { name: string; faceEnabled: boolean };

export function readDeviceUser(): DeviceUser | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as DeviceUser) : null;
  } catch {
    return null;
  }
}

export function saveDeviceUser(u: DeviceUser) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ name: u.name, faceEnabled: u.faceEnabled }));
  } catch {
    /* modo privado: ignora */
  }
}

/** Só aceita caminhos internos ("/x"), nunca "//host" — evita open redirect no ?next=. */
export const safeNext = (next: string | null, fallback = '/visao-geral') =>
  next && next.startsWith('/') && !next.startsWith('//') ? next : fallback;

/**
 * Liga "entrar com o rosto" e lembra ESTE aparelho (cookie `saldim_device` na API).
 * Use em todo lugar que ativa o rosto: cadastro, recadastro e perfil.
 */
export async function enableFaceOnThisDevice(): Promise<User> {
  const user = await patch<User>('/me/settings', { faceEnabled: true });
  await post('/auth/device');
  saveDeviceUser(user);
  return user;
}
