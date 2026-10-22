'use client';
import Link from 'next/link';
import { Card, Eyebrow } from '@/components/ui/Card';
import { NAV, PERFIL } from '@/lib/routes';
import { dayMonth, monthShort } from '@/lib/months';
import { useUser } from '@/lib/session';
import { MORE_SUB } from './heads';
import { useShellData } from './useShellData';
import { NavIcon } from './NavIcon';
import styles from './shell.module.css';

/** Tela "Mais" (só mobile): itens fora da tab bar + perfil + fontes de dados. */
export function MaisScreen() {
  const { user } = useUser();
  const { account, bankName, extrato, payslip } = useShellData(!!user);
  const until = extrato?.periodEnd ?? account?.lastSyncAt;
  const items = [...NAV.filter((n) => !n.mobile).map((n) => ({ href: n.href, label: n.label })), { href: PERFIL, label: 'Perfil' }];
  return (
    <>
      <Card className={styles.moreList}>
        {items.map((i) => (
          <Link key={i.href} href={i.href} className={styles.moreItem}>
            <span className={`${styles.moreIcon} ${i.href === '/emprestimos' ? styles.moreIconNeg : ''}`}>
              <NavIcon href={i.href} />
            </span>
            <span className={styles.moreTx}>
              <span className={styles.moreLabel}>{i.label}</span>
              <span className={styles.moreSub}>{MORE_SUB[i.href] ?? ''}</span>
            </span>
            <span className={styles.moreChevron}>›</span>
          </Link>
        ))}
      </Card>
      <Card className={styles.sourcesCard}>
        <Eyebrow>Fontes</Eyebrow>
        <div className={styles.sourceRow}>
          <span>Extrato {bankName}</span>
          {until ? <span className={styles.sourceOk}>até {dayMonth(until)}</span> : <Link href="/bancos">Carregar</Link>}
        </div>
        <div className={styles.sourceRow}>
          <span>Holerite</span>
          {payslip ? <span className={styles.sourceOk}>{monthShort(payslip.month)}</span> : <Link href="/holerite">Enviar</Link>}
        </div>
      </Card>
    </>
  );
}
