import { Suspense } from 'react';
import type { Metadata } from 'next';
import { Perfil } from '@/features/perfil/Perfil';

export const metadata: Metadata = { title: 'Saldim · Perfil' };

export default function PerfilPage() {
  return (
    <Suspense>
      <Perfil />
    </Suspense>
  );
}
