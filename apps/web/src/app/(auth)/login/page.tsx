import { Suspense } from 'react';
import type { Metadata } from 'next';
import { LoginForm } from '@/features/auth/LoginForm';
import { registrationOpen } from '@/lib/registration';

export const metadata: Metadata = { title: 'Saldim · Entrar' };

export default async function LoginPage() {
  const signup = await registrationOpen();
  return (
    <Suspense>
      <LoginForm signup={signup} />
    </Suspense>
  );
}
