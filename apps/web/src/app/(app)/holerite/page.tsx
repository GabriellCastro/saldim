import type { Metadata } from 'next';
import { Holerite } from '@/features/holerite/Holerite';

export const metadata: Metadata = { title: 'Holerite · Saldim' };

export default function HoleritePage() {
  return <Holerite />;
}
