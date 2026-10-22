'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR, { mutate as globalMutate } from 'swr';
import { fetcher, post } from './api';
import { AUTH_ROUTES } from './routes';

export type User = {
  id: string;
  name: string;
  email: string;
  cpfMasked: string;
  phone: string | null;
  faceEnabled: boolean;
  privacyMode: boolean;
  notifications: boolean;
  netIncome: number | null;
  grossIncome: number | null;
  otherIncome: number | null;
};

/** Usuário logado (SWR em /auth/me). `hidden` = modo "Ocultar valores". */
export function useUser() {
  const { data, error, isLoading, mutate } = useSWR<User>('/auth/me', fetcher, { shouldRetryOnError: false });
  return { user: data, error, isLoading, mutate, hidden: !!data?.privacyMode };
}

/** Encerra a sessão: derruba o cookie na API, limpa todo o cache SWR e volta pro login. */
export function useLogout() {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  async function logout() {
    setLeaving(true);
    try {
      await post('/auth/logout');
    } catch {
      /* mesmo se falhar, sai da tela */
    }
    await globalMutate(() => true, undefined, { revalidate: false });
    router.replace(AUTH_ROUTES.login);
    router.refresh();
  }
  return { logout, leaving };
}
