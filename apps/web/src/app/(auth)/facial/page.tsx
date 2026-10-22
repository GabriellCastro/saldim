import { Suspense } from 'react';
import type { Metadata } from 'next';
import { FacialScreen } from '@/features/auth/FacialScreen';

export const metadata: Metadata = { title: 'Saldim · Reconhecimento facial' };

export default function FacialPage() {
  return (
    <Suspense>
      <FacialScreen />
    </Suspense>
  );
}
