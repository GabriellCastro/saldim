'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ApiError } from '@/lib/api';
import { nameInitials } from '@/lib/format';
import { useLogout, useUser } from '@/lib/session';
import { AUTH_ROUTES, MAIS, NAV, PERFIL } from '@/lib/routes';
import { dayMonth, firstName, greeting, hhmm, longDate, monthShort } from '@/lib/months';
import { LogoGlyph } from '@/components/ui/LogoGlyph';
import { HEADS, TAB_LABEL } from './heads';
import { NavIcon } from './NavIcon';
import { ShellProvider, useHeadOverride, usePrivacyToggle } from './ShellContext';
import { useShellData } from './useShellData';
import styles from './shell.module.css';

/** "Lucas M. da Rocha" → "Lucas Rocha" (cabe na sidebar). */
const shortName = (name: string) => {
  const w = name.trim().split(/\s+/);
  return w.length > 1 ? `${w[0]} ${w[w.length - 1]}` : w[0];
};
const isActive = (path: string, href: string) => path === href || path.startsWith(`${href}/`);
const NAV_KEY = 'saldim:nav-collapsed';

/** Sidebar recolhida ou aberta, lembrada por navegador (só conveniência). */
function useNavCollapsed() {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(NAV_KEY) === '1');
    } catch {}
  }, []);
  const toggle = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem(NAV_KEY, c ? '0' : '1');
      } catch {}
      return !c;
    });
  return { collapsed, toggle };
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ShellProvider>
      <Shell>{children}</Shell>
    </ShellProvider>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { user, error } = useUser();
  const unauth = error instanceof ApiError && error.status === 401;
  useEffect(() => {
    if (unauth) router.replace(`${AUTH_ROUTES.login}?next=${encodeURIComponent(path)}`);
  }, [unauth, router, path]);

  const data = useShellData(!!user);
  const { hidden, toggle } = usePrivacyToggle();
  const { logout, leaving } = useLogout();
  const override = useHeadOverride();
  const nav = useNavCollapsed();
  const mini = nav.collapsed;

  const isHome = path === '/visao-geral';
  const name = firstName(user?.name);
  // relógio só no cliente (evita divergência de hidratação no greeting/data)
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);
  const today = now ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}` : null;
  const defHead =
    path === MAIS
      ? { kicker: user?.name ?? '', title: 'Mais' }
      : isHome
        ? { kicker: today ? longDate(today) : '', title: now ? `${greeting(now.getHours())}${name ? `, ${name}` : ''}` : '' }
        : (HEADS[path] ?? { kicker: '', title: NAV.find((n) => isActive(path, n.href))?.label ?? '' });
  const head = { kicker: override.kicker || defHead.kicker, title: override.title || defHead.title };
  const mobileTitle = isHome ? (name ? `Oi, ${name}` : 'Oi') : head.title;

  const sync = data.account?.lastSyncAt;
  const bank = data.bankName;
  const until = data.extrato?.periodEnd ?? sync;

  const mobileTabs = NAV.filter((n) => n.mobile);
  const inMore = !mobileTabs.some((n) => isActive(path, n.href));
  const isSub = inMore && path !== MAIS;

  if (unauth) return null;

  return (
    <div className={styles.page}>
      <div className={styles.frame}>
        <aside className={`${styles.side} ${mini ? styles.sideMini : ''}`}>
          <div className={styles.brand}>
            <div className={styles.logo}><LogoGlyph size={19} /></div>
            <div className={styles.brandName}>Saldim</div>
          </div>
          <button
            type="button"
            className={styles.collapseBtn}
            onClick={nav.toggle}
            aria-label={mini ? 'Abrir menu' : 'Fechar menu'}
            aria-expanded={!mini}
            title={mini ? 'Abrir menu' : 'Fechar menu'}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
              <path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <nav className={styles.nav}>
            {NAV.map((n) => {
              const on = isActive(path, n.href);
              const badge = 'badge' in n && n.badge === 'alerts' ? data.alertsCount : 0;
              return (
                <Link key={n.href} href={n.href} className={`${styles.navItem} ${on ? styles.navOn : ''}`} aria-current={on ? 'page' : undefined} title={mini ? n.label : undefined}>
                  <span className={styles.navDot} />
                  <NavIcon href={n.href} className={styles.navIcon} />
                  <span className={styles.navLabel}>{n.label}</span>
                  {badge > 0 && <span className={styles.badge}>{badge}</span>}
                </Link>
              );
            })}
          </nav>
          <div className={styles.sideFoot}>
            <div className={styles.sources}>
              <div className={styles.source}>
                <span className={until ? styles.dotOk : styles.dotOff} />
                {until ? `Extrato ${bank} · até ${dayMonth(until)}` : 'Sem extrato ainda'}
              </div>
              <div className={styles.source}>
                <span className={data.payslip ? styles.dotOk : styles.dotOff} />
                {data.payslip ? `Holerite ${monthShort(data.payslip.month)}` : 'Sem holerite'}
              </div>
              <Link href="/bancos" className={styles.sourceLink}>
                <span className={styles.dotOff} />
                Carregar extrato
              </Link>
            </div>
            <button
              type="button"
              className={styles.privBtn}
              onClick={toggle}
              disabled={!user}
              aria-label={hidden ? 'Mostrar valores' : 'Ocultar valores'}
              title={mini ? (hidden ? 'Mostrar valores' : 'Ocultar valores') : undefined}
            >
              {mini ? <EyeIcon off={hidden} /> : hidden ? 'Mostrar valores' : 'Ocultar valores'}
            </button>
            <div className={styles.userRow}>
            <Link
              href={PERFIL}
              className={`${styles.userCard} ${isActive(path, PERFIL) ? styles.userCardOn : ''}`}
              aria-current={isActive(path, PERFIL) ? 'page' : undefined}
              aria-label="Abrir perfil"
              title={mini ? 'Ver perfil' : undefined}
            >
              <span className={styles.userAvatar} aria-hidden>
                {user ? nameInitials(user.name) : ''}
              </span>
              <span className={styles.userTx}>
                <span className={styles.userName}>{user ? shortName(user.name) : '…'}</span>
                <span className={styles.userSub}>Ver perfil</span>
              </span>
              <svg className={styles.userChevron} viewBox="0 0 24 24" width="16" height="16" aria-hidden>
                <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <button type="button" className={styles.logoutBtn} onClick={logout} disabled={leaving} aria-label="Sair da conta" title="Sair">
              <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden>
                <path
                  d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3M16 17l5-5-5-5M21 12H9"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            </div>
          </div>
        </aside>

        <main className={styles.main}>
          <header className={styles.header}>
            <div className={styles.headTx}>
              <div className={styles.kicker}>{head.kicker}</div>
              <h1 className={styles.title}>{head.title}</h1>
            </div>
            <div className={styles.headRight}>
              <div className={styles.syncPill}>
                <span className={sync ? styles.syncDot : styles.dotOff} />
                {sync ? `${bank} sincronizado · ${hhmm(sync) || dayMonth(sync)}` : 'Sem extrato'}
              </div>
            </div>
          </header>

          <header className={styles.mHeader}>
            <div className={styles.mHeadLeft}>
              {isSub && (
                <button type="button" className={styles.back} onClick={() => router.push(MAIS)} aria-label="Voltar">
                  ‹
                </button>
              )}
              <div className={styles.mHeadTx}>
                <span className={styles.mKicker}>{head.kicker}</span>
                <span className={styles.mTitle}>{mobileTitle}</span>
              </div>
            </div>
            <button type="button" className={styles.mPriv} onClick={toggle} disabled={!user}>
              {hidden ? 'Mostrar' : 'Ocultar'}
            </button>
          </header>
          {isHome && (
            <div className={`${styles.syncPill} ${styles.mSync}`}>
              <span className={sync ? styles.syncDot : styles.dotOff} />
              {sync ? `${bank} sincronizado · ${hhmm(sync) || dayMonth(sync)}` : 'Sem extrato'}
            </div>
          )}

          {children}
        </main>
      </div>

      <nav className={styles.tabbar} aria-label="Navegação">
        {mobileTabs.map((n) => (
          <Tab key={n.href} href={n.href} label={TAB_LABEL[n.href] ?? n.label} on={isActive(path, n.href)} />
        ))}
        <Tab href={MAIS} label="Mais" on={inMore} dots />
      </nav>
    </div>
  );
}

function Tab({ href, label, on, dots }: { href: string; label: string; on: boolean; dots?: boolean }) {
  return (
    <Link href={href} className={`${styles.tab} ${on ? styles.tabOn : ''}`} aria-current={on ? 'page' : undefined}>
      <span className={styles.tabIcon}>
        {dots ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <circle cx="6" cy="12" r="1.3" />
            <circle cx="12" cy="12" r="1.3" />
            <circle cx="18" cy="12" r="1.3" />
          </svg>
        ) : (
          <NavIcon href={href} size={22} />
        )}
      </span>
      <span>{label}</span>
    </Link>
  );
}

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="M4 4l16 16" />}
    </svg>
  );
}
