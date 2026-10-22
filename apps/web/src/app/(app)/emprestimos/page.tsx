import type { Metadata } from 'next';
import { Emprestimos } from '@/features/emprestimos/Emprestimos';

export const metadata: Metadata = { title: 'Empréstimos · Saldim' };

export default function EmprestimosPage() {
  return <Emprestimos />;
}
