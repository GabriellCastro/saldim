import type { Metadata } from 'next';
import { Bancos } from '@/features/bancos/Bancos';

export const metadata: Metadata = { title: 'Conectar bancos · Saldim' };

export default function BancosPage() {
  return <Bancos />;
}
