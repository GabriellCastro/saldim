import { Suspense } from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Register } from '@/features/auth/Register';
import { registrationOpen } from '@/lib/registration';
import { AUTH_ROUTES } from '@/lib/routes';

export const metadata: Metadata = { title: 'Saldim · Criar conta' };

/** Com REGISTRATION_OPEN=false (instância pessoal) volta pro login; a API também recusa o POST. */
export default async function RegistroPage() {
  if (!(await registrationOpen())) redirect(AUTH_ROUTES.login);
  return (
    <Suspense>
      <Register />
    </Suspense>
  );
}
