import type { Metadata } from 'next';
import { Assistente } from '@/features/assistente/Assistente';

export const metadata: Metadata = { title: 'Assistente IA · Saldim' };

export default function AssistentePage() {
  return <Assistente />;
}
