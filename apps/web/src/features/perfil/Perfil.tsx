'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { nameInitials } from '@/lib/format';
import { useLogout, useUser } from '@/lib/session';
import { LoadError } from '@/components/ui/ScreenState';
import { PerfilMain } from './PerfilMain';
import { EditDados } from './EditDados';
import { EditEmail } from './EditEmail';
import { EditSenha } from './EditSenha';
import styles from './perfil.module.css';

export type View = 'main' | 'dados' | 'email' | 'senha';
export type Flash = (msg: string, tone?: 'ok' | 'err') => void;

const TABS: [Exclude<View, 'main'>, string][] = [
  ['dados', 'Dados pessoais'],
  ['email', 'E-mail'],
  ['senha', 'Senha'],
];

export function Perfil() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, error, mutate } = useUser();
  const [view, setView] = useState<View>('main');
  const [toast, setToast] = useState<{ msg: string; tone: 'ok' | 'err' } | null>(null);
  const { logout, leaving } = useLogout();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const flash: Flash = (msg, tone = 'ok') => {
    clearTimeout(timer.current);
    if (tone === 'ok') setView('main');
    setToast({ msg, tone });
    timer.current = setTimeout(() => setToast(null), 3500);
  };

  // volta do /facial?modo=recadastrar
  useEffect(() => {
    if (params.get('ok') === 'rosto') {
      flash('Rosto recadastrado neste dispositivo');
      router.replace('/perfil');
    }
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // skeleton só sem dados (o cache pode já ter o usuário vindo do login enquanto revalida)
  if (!user && !error)
    return (
      <div className={styles.page} aria-busy="true">
        <div className={styles.skeleton} style={{ height: 132 }} />
        <div className={styles.skeleton} style={{ height: 320 }} />
      </div>
    );
  if (error || !user)
    return (
      <div className={styles.page}>
        <LoadError message="Não deu para carregar teu perfil." onRetry={() => mutate()} />
      </div>
    );

  const go = (v: View) => {
    setToast(null);
    setView(v);
  };

  return (
    <div className={styles.page}>
      <header className={`${styles.glass} ${styles.header}`}>
        <div className={styles.avatar} aria-hidden>
          {nameInitials(user.name)}
        </div>
        <div className={styles.who}>
          <h1 className={styles.name}>{user.name}</h1>
          <span className={styles.since}>{user.email}</span>
          <div className={styles.badges}>
            <span className={`${styles.badge} ${user.faceEnabled ? styles.badgeOn : ''}`}>
              <span className={styles.badgeDot} />
              {user.faceEnabled ? 'Entrada pelo rosto ativa' : 'Entrada só com senha'}
            </span>
            {user.privacyMode && (
              <span className={styles.badge}>
                <span className={styles.badgeDot} />
                Valores ocultos
              </span>
            )}
          </div>
        </div>
        <button type="button" className={styles.logout} onClick={logout} disabled={leaving}>
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
            <path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3M16 17l5-5-5-5M21 12H9" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {leaving ? 'Saindo…' : 'Sair'}
        </button>
      </header>

      {toast && (
        <div className={`${styles.toast} ${toast.tone === 'err' ? styles.toastErr : ''}`} role="status">
          {toast.tone === 'ok' && <span className={styles.toastMark}>✓</span>}
          {toast.msg}
        </div>
      )}

      {view === 'main' ? (
        <PerfilMain user={user} go={go} flash={flash} />
      ) : (
        <div className={styles.edit}>
          <nav className={styles.nav} aria-label="Configurar conta">
            <button type="button" className={styles.navBack} onClick={() => go('main')}>
              ‹ Voltar ao perfil
            </button>
            {TABS.map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`${styles.tab} ${view === id ? styles.tabOn : ''}`}
                aria-current={view === id ? 'page' : undefined}
                onClick={() => go(id)}
              >
                <span className={styles.tabBar} />
                {label}
              </button>
            ))}
          </nav>
          <section className={`${styles.glass} ${styles.panel}`}>
            {view === 'dados' && <EditDados key="dados" user={user} onCancel={() => go('main')} flash={flash} />}
            {view === 'email' && <EditEmail key="email" user={user} flash={flash} />}
            {view === 'senha' && <EditSenha key="senha" onCancel={() => go('main')} flash={flash} />}
          </section>
        </div>
      )}
    </div>
  );
}
