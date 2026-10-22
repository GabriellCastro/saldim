'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { patch } from '@/lib/api';
import { useUser, type User } from '@/lib/session';

/** Estado compartilhado do shell: `head` = kicker/título do header; telas sobrescrevem com `useScreenHead`. */
type Head = { kicker?: string; title?: string };
type ShellState = {
  head: Head & { path?: string };
  setHead: (h: Head & { path: string }) => void;
};

const ShellCtx = createContext<ShellState | null>(null);

export function ShellProvider({ children }: { children: React.ReactNode }) {
  const [head, setHead] = useState<Head & { path?: string }>({});
  const value = useMemo(() => ({ head, setHead }), [head]);
  return <ShellCtx.Provider value={value}>{children}</ShellCtx.Provider>;
}

function useShell() {
  const ctx = useContext(ShellCtx);
  if (!ctx) throw new Error('useShell fora do ShellProvider');
  return ctx;
}


/** Sobrescreve kicker/título do header para a rota atual (ex.: período do extrato em Gastos). */
export function useScreenHead(kicker?: string, title?: string) {
  const { setHead } = useShell();
  const path = usePathname();
  useEffect(() => {
    if (kicker || title) setHead({ path, kicker, title });
  }, [path, kicker, title, setHead]);
}

export function useHeadOverride() {
  const { head } = useShell();
  const path = usePathname();
  return head.path === path ? head : {};
}

/** "Ocultar valores": PATCH /me/settings {privacyMode} e atualiza o useUser. */
export function usePrivacyToggle() {
  const { user, hidden, mutate } = useUser();
  const [busy, setBusy] = useState(false);
  const toggle = useCallback(async () => {
    if (!user || busy) return;
    setBusy(true);
    const next = !hidden;
    await mutate({ ...user, privacyMode: next }, false);
    try {
      const updated = await patch<User>('/me/settings', { privacyMode: next });
      await mutate(updated, false);
    } catch {
      await mutate();
    } finally {
      setBusy(false);
    }
  }, [user, hidden, mutate, busy]);
  return { hidden, toggle, busy };
}
