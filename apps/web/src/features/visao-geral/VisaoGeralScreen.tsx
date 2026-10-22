'use client';
import Link from 'next/link';
import { AiMark } from '@/components/ui/Pill';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/State';
import { pctCss } from '@/components/charts/geometry';
import { money } from '@/lib/format';
import { monthLong, monthShort } from '@/lib/months';
import { useUser } from '@/lib/session';
import { useOverview, useProjection, useSpending } from '@/features/dashboard/hooks';
import { cap, saldo, tone } from '@/features/dashboard/fmt';
import { RichText } from '@/features/dashboard/RichText';
import type { Overview, Projection, Spending } from '@/features/dashboard/types';
import { SavingsCard } from '@/features/meta/SavingsCard';
import s from '@/features/dashboard/screen.module.css';
import st from './visao.module.css';

export function VisaoGeralScreen() {
  const { hidden } = useUser();
  const ov = useOverview();
  // projeção seguindo os limites: bate com o "fecha com" do card do mês
  const proj = useProjection(true);
  // gastos do mês atual por categoria: quanto dos fixos já caiu
  const sp = useSpending(ov.data?.month.slice(0, 7) ?? null);

  if (ov.error || proj.error)
    return (
      <ErrorState
        onRetry={() => {
          ov.mutate();
          proj.mutate();
        }}
      />
    );
  if (!ov.data || !proj.data)
    return (
      <div className={st.top}>
        <Skeleton h={320} className={st.skelMain} />
        <Skeleton h={320} className={st.skelSide} />
      </div>
    );
  if (!proj.data.months.length) return <EmptyState />;

  const main = proj.data;

  return (
    <>
      {/* mês em destaque (com a dica da IA no pé) + guardado; embaixo, os próximos meses */}
      <div className={st.top}>
        <MonthSpending ov={ov.data} spending={sp.data} hidden={hidden} />
        <div className={st.goal}>
          <SavingsCard hidden={hidden} />
        </div>
      </div>

      <NextMonths main={main} ov={ov.data} hidden={hidden} />
    </>
  );
}

/** "Próximos meses": sobra dos 6 meses depois do atual (o atual tá no card do mês), barras divergentes; no pé, quanto a folha libera. */
function NextMonths({ main, ov, hidden }: { main: Projection; ov: Overview; hidden: boolean }) {
  const ms = main.months.slice(1, 7);
  const after = ov.netAfterLoans;
  const maxAbs = Math.max(1, ...ms.map((m) => Math.abs(m.balance)));
  return (
    <div className={`${s.card} ${st.next}`}>
      <div className={s.head}>
        <span className={s.eyebrow}>Próximos meses · sobra nos limites</span>
        <Link href="/projecao" className={s.link}>
          Projeção →
        </Link>
      </div>
      <div className={st.nextList}>
        {ms.map((m) => {
          const notes = [m.extra > 0 ? '13º' : null, m.freed > 0 ? `+${money(m.freed, hidden)} na folha` : null].filter(Boolean).join(' · ');
          return (
            <div key={m.month} className={st.nextRow}>
              <div className={st.nextName}>
                <span>{monthLong(m.month)}</span>
                <span className={st.nextNote}>{notes}</span>
              </div>
              <div className={st.diverge}>
                <div className={st.divNeg}>
                  <div style={{ width: pctCss(m.balance < 0 ? (-m.balance / maxAbs) * 100 : 0) }} />
                </div>
                <div className={st.divPos}>
                  <div style={{ width: pctCss(m.balance > 0 ? (m.balance / maxAbs) * 100 : 0) }} />
                </div>
              </div>
              <span className={st.nextVal} style={{ color: tone(m.balance) }}>
                {saldo(m.balance, hidden)}
              </span>
            </div>
          );
        })}
      </div>
      {after && after.net > ov.income.net && (
        <span className={st.folhaNote}>
          Folha liberada: o líquido sobe de {money(ov.income.net, hidden)} pra <b>{money(after.net, hidden)}</b> até {monthShort(after.month)} com os empréstimos da folha acabando.
        </span>
      )}
    </div>
  );
}

/** "Outubro · dia 8 de 31": quanto já saiu no mês, variáveis no ritmo do limite, fixos que faltam cair e como fecha seguindo os limites. */
function MonthSpending({ ov, spending, hidden }: { ov: Overview; spending?: Spending; hidden: boolean }) {
  const v = ov.variable;
  const over = v.diff > 0;
  const paid = new Map((spending?.byCategory ?? []).filter((c) => c.kind === 'fixo').map((c) => [c.id, c.amount]));
  const fixedPaid = [...paid.values()].reduce((a, n) => a + n, 0);
  const fixedLeft = Math.max(0, ov.fixedTotal - fixedPaid);
  const pending = ov.fixed.filter((f) => !paid.has(f.id)).map((f) => f.label);
  const pct = (n: number, of: number) => pctCss(of ? Math.min(100, (n / of) * 100) : 0);
  return (
    <div className={`${s.card} ${st.monthCard}`}>
      <div className={s.eyebrow}>
        {cap(monthLong(ov.month))} · dia {ov.day} de {ov.daysInMonth}
      </div>
      <div className={st.kv}>
        <span className={st.kvLabel}>Já saiu</span>
        {spending ? <span className={st.kvVal}>{money(spending.total, hidden)}</span> : <Skeleton h={38} />}
      </div>

      <div className={st.fcRow}>
        <div className={st.fcVals}>
          <span className={st.fcLabel}>Variáveis</span>
          <span>
            <b className={st.fcNum}>{money(v.spent, hidden)}</b> de {money(v.limit, hidden)}
          </span>
        </div>
        <div className={st.track}>
          <div style={{ width: pct(v.spent, v.limit), background: over ? 'var(--neg)' : 'var(--gold)' }} />
          <i className={st.ideal} style={{ left: pct(v.idealToDate, v.limit) }} />
        </div>
        <span className={st.fcHint} style={{ color: over ? 'var(--neg)' : 'var(--pos)' }}>
          {over ? `${money(v.diff, hidden)} acima do esperado pra hoje` : `No ritmo · ${money(-v.diff, hidden)} abaixo do esperado pra hoje`}
        </span>
      </div>

      <div className={st.fcRow}>
        <div className={st.fcVals}>
          <span className={st.fcLabel}>Fixos</span>
          <span>
            <b className={st.fcNum}>{money(fixedPaid, hidden)}</b> de ~{money(ov.fixedTotal, hidden)}
          </span>
        </div>
        <div className={st.track}>
          <div style={{ width: pct(fixedPaid, ov.fixedTotal), background: 'var(--mu)' }} />
        </div>
        <span className={st.fcHint}>
          {!spending
            ? ' '
            : fixedLeft > 0
              ? `Faltam cair ~${money(fixedLeft, hidden)}${pending.length ? ` (${pending.join(', ')})` : ''}`
              : 'Os fixos do mês já caíram.'}
        </span>
      </div>

      <div className={st.closeRow}>
        <span className={st.fcLabel}>Seguindo os limites, fecha com</span>
        <b style={{ color: tone(ov.leftover) }}>{saldo(ov.leftover, hidden)}</b>
      </div>

      {ov.insight && (
        <div className={st.ai}>
          <AiMark />
          <p className={`${s.insight} ${st.aiTx}`}><RichText text={ov.insight} hidden={hidden} /></p>
          <Link href="/assistente" className={s.link}>
            Perguntar →
          </Link>
        </div>
      )}
    </div>
  );
}
