'use client';
import Link from 'next/link';
import useSWR from 'swr';
import { pctCss } from '@/components/charts/geometry';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/State';
import { fetcher } from '@/lib/api';
import { ddmm, money } from '@/lib/format';
import { monthLong, nextMonth, prevMonth } from '@/lib/months';
import { useUser } from '@/lib/session';
import { cap, saldo, tone } from '@/features/dashboard/fmt';
import type { DetailGroup, MonthDetail } from '@/features/dashboard/types';
import { useScreenHead } from '@/features/shell/ShellContext';
import s from '@/features/dashboard/screen.module.css';
import { SavingNote } from './RealVsPlan';
import st from './monthDetail.module.css';

/** real ÷ plano em %; sem % quando o real é negativo (sobra no vermelho) ou o plano é zero */
const pct = (real: number | null, plan: number) => (real != null && real >= 0 && plan > 0 ? Math.round((real / plan) * 100) : null);
const KIND_TAG = { past: 'mês fechado · real', current: 'real até hoje', future: 'projeção' } as const;

/** Detalhe de um mês da tabela da Projeção: o que entra, o que sai e onde, real × plano da IA. */
export function MonthDetailScreen({ month }: { month: string }) {
  const { hidden } = useUser();
  const valid = /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
  const { data, error, mutate } = useSWR<MonthDetail>(valid ? `/dashboard/month/${month}` : null, fetcher, { keepPreviousData: true });
  const name = valid ? `${cap(monthLong(month))} ${month.slice(0, 4)}` : 'Mês';
  useScreenHead(`Projeção · ${name}`, name);

  if (!valid) return <EmptyState message="Mês inválido." />;
  if (error) return <ErrorState onRetry={() => mutate()} />;
  if (!data) return <Skeleton h={480} />;

  const d = data;
  const real = d.kind !== 'future';
  // "como o mês passado" = variáveis iguais ao mês anterior ao ATUAL (mês atual = este − offset)
  let ref = month;
  for (let k = d.offset; k > 0; k--) ref = prevMonth(ref);
  for (let k = d.offset; k < 0; k++) ref = nextMonth(ref);
  const asToday = `como ${monthLong(prevMonth(ref))}`;
  const t = d.totals;

  return (
    <div className={st.screen}>
      <div className={`${s.card} ${st.nav}`}>
        <Link href="/projecao" className={st.back}>
          ← Projeção
        </Link>
        <span className={st.kind}>{KIND_TAG[d.kind]}</span>
        <div className={st.arrows}>
          {d.prev ? (
            <Link href={`/projecao/${d.prev}`} aria-label="Mês anterior">
              ‹
            </Link>
          ) : (
            <span aria-hidden>‹</span>
          )}
          <b>{d.label}</b>
          {d.next ? (
            <Link href={`/projecao/${d.next}`} aria-label="Próximo mês">
              ›
            </Link>
          ) : (
            <span aria-hidden>›</span>
          )}
        </div>
      </div>

      <div className={st.kpis}>
        <Kpi label="Entra" main={real ? t.real!.income : t.plan.income} sub={real ? `IA ${money(t.plan.income, hidden)}` : `${asToday}: ${money(t.noPlan.income, hidden)}`} p={real ? pct(t.real!.income, t.plan.income) : null} pText="do previsto" hidden={hidden} />
        <Kpi
          label={real ? 'Saiu' : 'Sai'}
          main={real ? t.real!.out : t.plan.out}
          sub={real ? `plano IA ${money(t.plan.out, hidden)}` : `${asToday}: ${money(t.noPlan.out, hidden)}`}
          p={real ? pct(t.real!.out, t.plan.out) : null}
          pText="do plano usado"
          goodLow
          hidden={hidden}
        />
        <Kpi
          label={d.kind === 'current' ? 'Sobra na conta' : 'Sobra'}
          main={real ? t.real!.balance : t.plan.balance}
          signed
          sub={real ? `IA ${saldo(t.plan.balance, hidden)}` : `${asToday}: ${saldo(t.noPlan.balance, hidden)}`}
          p={real ? pct(t.real!.balance, t.plan.balance) : null}
          pText="da sobra do plano"
          note={d.saving && d.saving.extra > 0 ? <SavingNote sv={d.saving} hidden={hidden} /> : undefined}
          hidden={hidden}
        />
        {d.reserve.plan != null && (
          <Kpi
            label="Reserva"
            main={d.reserve.real ?? d.reserve.plan}
            sub={d.reserve.real != null ? `IA espera ${money(d.reserve.plan, hidden)} no fim do mês` : `${asToday}: ${money(d.reserve.noPlan ?? 0, hidden)}`}
            p={d.reserve.real != null ? pct(d.reserve.real, d.reserve.plan) : null}
            pText="do objetivo"
            hidden={hidden}
          />
        )}
      </div>

      {d.events.length > 0 && (
        <div className={st.events}>
          {d.events.map((e) => (
            <span key={e}>{e}</span>
          ))}
        </div>
      )}

      <div className={st.groups}>
        <div className={st.col}>
          <Group title="Entradas" g={d.income} real={real} asToday={asToday} kind="in" hidden={hidden} />
          <Group title="Fixos" g={d.fixed} real={real} asToday={asToday} kind="out" hidden={hidden} />
        </div>
        <div className={st.col}>
        <Group title="Variáveis" g={d.variable} real={real} asToday={asToday} kind="out" bars hidden={hidden} />
        {d.unexpected.items.length > 0 && (
          <div className={`${s.card} ${st.group}`}>
            <div className={s.head}>
              <span className={s.eyebrow}>Imprevistos</span>
              <span className={st.groupTotal} style={{ color: 'var(--warn)' }}>
                {money(d.unexpected.total, hidden)}
              </span>
            </div>
            <ul className={st.unexp}>
              {d.unexpected.items.map((u) => (
                <li key={`${u.date}${u.description}${u.amount}`}>
                  <span className={st.uName}>{u.description}</span>
                  <span className={st.uVal}>{money(u.amount, hidden)}</span>
                  <span className={st.uMeta}>
                    {ddmm(u.date)} · {u.label}
                  </span>
                  {u.note && <span className={st.uNote}>“{u.note}”</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
        </div>
      </div>

      <div className={s.note}>
        {real
          ? `Real = o que entrou e saiu da conta (sem caixinha, transferência entre contas tuas e crédito de empréstimo)${d.kind === 'current' ? '; a sobra é o saldo da tua conta agora' : ''}. Plano IA = fixos estimados + limite de cada categoria`
          : `Projeção: plano IA = gastar até o limite de cada categoria; ${asToday} = variáveis iguais ao mês passado`}
        {d.kind === 'past' ? ' (com os limites de hoje).' : '.'}
      </div>
    </div>
  );
}

function Kpi({ label, main, sub, p, pText, signed = false, goodLow = false, note, hidden }: {
  label: string;
  main: number;
  sub: string;
  p: number | null;
  pText: string;
  signed?: boolean;
  goodLow?: boolean;
  note?: React.ReactNode;
  hidden: boolean;
}) {
  const good = p == null ? true : goodLow ? p <= 100 : p >= 100;
  return (
    <div className={`${s.card} ${st.kpi}`}>
      <span className={s.eyebrow}>{label}</span>
      <span className={st.kpiVal} style={signed ? { color: tone(main) } : undefined}>
        {signed ? saldo(main, hidden) : money(main, hidden)}
      </span>
      <span className={st.kpiSub}>{sub}</span>
      {p != null && (
        <>
          <div className={st.bar}>
            <div style={{ width: pctCss(Math.min(100, Math.max(0, p))), background: good ? 'var(--pos)' : 'var(--gold)' }} />
          </div>
          <span className={st.kpiSub}>
            <b>{p}%</b> {pText}
          </span>
        </>
      )}
      {note && <span className={st.kpiNote}>{note}</span>}
    </div>
  );
}

/** Tabela de um grupo (entradas, fixos, variáveis): real × plano (ou plano × como o mês passado no futuro). */
function Group({ title, g, real, asToday, kind, bars = false, hidden }: {
  title: string;
  g: DetailGroup;
  real: boolean;
  asToday: string;
  kind: 'in' | 'out';
  bars?: boolean;
  hidden: boolean;
}) {
  if (!g.lines.length) return null;
  const colA = real ? 'Real' : 'Plano IA';
  const colB = real ? 'Plano IA' : cap(asToday);
  return (
    <div className={`${s.card} ${st.group}`}>
      <div className={s.head}>
        <span className={s.eyebrow}>{title}</span>
        <span className={st.groupTotal}>{money(real ? g.real ?? 0 : g.plan, hidden)}</span>
      </div>
      <div className={`${st.row} ${st.rowHead}`}>
        <span />
        <span>{colA}</span>
        <span>{colB}</span>
      </div>
      {g.lines.map((l) => {
        const a = real ? l.real ?? 0 : l.plan;
        const b = real ? l.plan : l.noPlan;
        const over = kind === 'out' && a > b + 0.005;
        const p = real ? pct(l.real, l.plan) : null;
        return (
          <div key={l.id} className={st.row}>
            <span className={st.label}>
              {l.label}
              {bars && real && l.plan > 0 && (
                <span className={st.lineBar}>
                  <span style={{ width: pctCss(Math.min(100, (a / l.plan) * 100)), background: over ? 'var(--neg)' : 'var(--gold)' }} />
                </span>
              )}
            </span>
            <span className={st.val} style={real && b > 0 ? { color: over ? 'var(--neg)' : undefined } : undefined}>
              {money(a, hidden)}
              {p != null && <small>{p}%</small>}
            </span>
            <span className={st.valB}>{money(b, hidden)}</span>
          </div>
        );
      })}
      <div className={`${st.row} ${st.rowTotal}`}>
        <span>Total</span>
        <span>{money(real ? g.real ?? 0 : g.plan, hidden)}</span>
        <span>{money(real ? g.plan : g.noPlan, hidden)}</span>
      </div>
    </div>
  );
}
