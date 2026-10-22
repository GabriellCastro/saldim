'use client';
import Link from 'next/link';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { money } from '@/lib/format';
import { dayMonth } from '@/lib/months';
import type { Account } from '@/features/dashboard/types';
import s from '@/features/dashboard/screen.module.css';
import st from './gastos.module.css';

/**
 * Saldo atual = soma dos saldos que vieram nos extratos (PDF Itaú, OFX ou JSON gravam o saldo final;
 * CSV não traz). Ao lado, quanto saiu no período escolhido no filtro.
 */
export function BalanceCard({
  extratoUntil,
  spent,
  periodName,
  hidden,
}: {
  /** fim do período do último extrato (YYYY-MM-DD) */
  extratoUntil?: string | null;
  spent: number;
  /** "outubro", "todos os meses" */
  periodName: string;
  hidden: boolean;
}) {
  const { data: accounts } = useSWR<Account[]>('/accounts', fetcher);
  const withBalance = accounts?.filter((a) => a.balance != null) ?? [];
  const total = withBalance.reduce((acc, a) => acc + (a.balance ?? 0), 0);
  const asOf = extratoUntil ? `conforme extrato até ${dayMonth(extratoUntil)}` : 'conforme o último extrato';

  return (
    <div className={`${s.card} ${st.balance}`}>
      <div className={st.balanceMain}>
        <span className={s.eyebrow}>Saldo atual</span>
        {!accounts ? (
          <span className={st.balanceBig}>…</span>
        ) : withBalance.length ? (
          <>
            <span className={st.balanceBig} style={{ color: total < 0 ? 'var(--neg)' : undefined }}>
              {money(total, hidden)}
            </span>
            <span className={s.small}>
              {withBalance.length === 1 ? withBalance[0].label : `${withBalance.length} contas`} · {asOf}
            </span>
          </>
        ) : (
          <>
            <span className={st.balanceBig}>—</span>
            <span className={s.small}>
              Teu extrato não trouxe o saldo. Envia em PDF ou OFX do banco pra ele aparecer aqui.{' '}
              <Link href="/bancos" className={s.link}>
                Carregar extrato
              </Link>
            </span>
          </>
        )}
      </div>
      <div className={st.balanceSide}>
        <span className={s.eyebrow}>Gastos em {periodName}</span>
        <span className={st.balanceMid}>{money(spent, hidden)}</span>
        <span className={s.small}>fixos + variáveis, sem transferências entre contas tuas</span>
      </div>
    </div>
  );
}
