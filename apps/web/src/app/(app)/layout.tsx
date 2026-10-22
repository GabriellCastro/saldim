import { AppShell } from '@/features/shell/AppShell';

/** Telas logadas: sidebar (≥768px) ou tab bar (<768px). */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
