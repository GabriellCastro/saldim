'use client';
import Link from 'next/link';
import { useId, useState } from 'react';
import { Chip } from '@/components/ui/Pill';
import { Segmented } from '@/components/ui/Segmented';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/State';
import { linePath, scale } from '@/components/charts/geometry';
import { money } from '@/lib/format';
import { dayMonth, monthLong, monthShort, prevMonth } from '@/lib/months';
import { useUser } from '@/lib/session';
import { useOverview, useProjection } from '@/features/dashboard/hooks';
import { cap, moneyShort, saldo, tone } from '@/features/dashboard/fmt';
import type { ProjMonth } from '@/features/dashboard/types';
import { ReserveCard } from '@/features/meta/ReserveCard';
import { useGoal } from '@/features/meta/useGoal';
import { useScreenHead } from '@/features/shell/ShellContext';
import { useShellData } from '@/features/shell/useShellData';
import s from '@/features/dashboard/screen.module.css';
import { DualCell, RealVsPlanCard } from './RealVsPlan';
import st from './projecao.module.css';

type Period = '6' | '12' | 'meta' | '24';
type Scenario = 'hoje' | 'plano' | 'comparar';

const W = 600;
const H = 240;

/** Quantos meses mostrar: o período escolhido, ou até o prazo da meta (API aceita até 36). */
function periodMonths(period: Period, goalMonths: number | null) {
  if (period === 'meta') return Math.max(3, Math.min(36, goalMonths ?? 12));
  return Number(period);
}

export function ProjecaoScreen() {
  const { user, hidden } = useUser();
  const goal = useGoal();
  const g = goal.data?.goal;
  const gp = goal.data?.plan;
  const canMeta = !!g && !!gp && gp.status === 'onTrack';
  const [period, setPeriod] = useState<Period>('12');
  const [scenario, setScenario] = useState<Scenario>('hoje');
  const months = periodMonths(period === 'meta' && !canMeta ? '12' : period, gp?.monthsPlan ?? null);
  // "comparar" busca com plano; a linha "como o mês passado" vem em `alt`
  const proj = useProjection(scenario !== 'hoje', months);
  const ov = useOverview();
  const { bankName, extrato, payslip } = useShellData(!!user);
  const [hov, setHov] = useState<number | null>(null);
  const gid = useId().replace(/:/g, '');
  const ms = proj.data?.months ?? [];
  useScreenHead(ms.length ? `${cap(ms[0].label)} a ${ms[ms.length - 1].label}` : undefined);

  if (proj.error) return <ErrorState onRetry={() => proj.mutate()} />;
  if (!proj.data)
    return (
      <>
        <Skeleton h={60} />
        <Skeleton h={110} />
        <Skeleton h={360} />
      </>
    );
  if (!ms.length) return <EmptyState />;

  const prevName = monthLong(prevMonth(ms[0].month));
  const asTodayLabel = `Como ${prevName}`;
  const scenarios = [
    { value: 'hoje' as const, label: asTodayLabel },
    { value: 'plano' as const, label: 'Com plano IA' },
    { value: 'comparar' as const, label: 'Comparar' },
  ];
  const periods: { value: Period; label: string }[] = [
    { value: '6', label: '6 meses' },
    { value: '12', label: '1 ano' },
    ...(canMeta ? [{ value: 'meta' as const, label: `Até a meta (${monthShort(gp.reachPlan!)})` }] : []),
    { value: '24', label: '2 anos' },
  ];

  const n = ms.length;
  const last = ms[n - 1];
  const alt = scenario === 'comparar' ? proj.data.alt : [];
  const altLast = alt[alt.length - 1];
  const target = g?.target ?? null;
  const after = ov.data?.netAfterLoans;

  // gráfico: barras = sobra do mês; linha = reserva acumulada (parte do guardado)
  const vals = [...ms.flatMap((m) => [m.reserve, m.balance]), ...alt.map((a) => a.reserve), ...(target ? [target] : []), 0];
  const ymax = Math.max(...vals) * 1.08 || 1;
  const ymin = Math.min(...vals) * 1.12;
  const Y = scale(ymin, ymax, H, 0);
  const cx = (i: number) => ((i + 0.5) / n) * W;
  const bw = Math.min(26, (W / n) * 0.5);
  const line = (arr: { reserve: number }[]) => linePath(arr.map((m, i) => [cx(i), Y(m.reserve)]));
  const pctX = (i: number) => `${((cx(i) / W) * 100).toFixed(2)}%`;
  const pctY = (v: number) => `${((Y(v) / H) * 100).toFixed(2)}%`;
  const h = hov != null ? ms[hov] : null;
  const tipTx = hov == null ? '' : hov < 2 ? 'translateX(0)' : hov > n - 3 ? 'translateX(-100%)' : 'translateX(-50%)';
  const cols = { gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` };
  const tags = (m: ProjMonth) => [...(m.extra > 0 ? ['13º'] : []), ...(m.freed > 0 ? ['folha'] : [])];
  const mainLabel = scenario === 'hoje' ? `gastando como ${prevName}` : 'com o plano da IA';
  // real × plano: meses fechados viram linhas de histórico; o atual ganha o "real até hoje" embaixo
  const actual = proj.data.actual ?? [];
  const curReal = actual.find((a) => a.partial);
  const history = actual.filter((a) => !a.partial);
  const comparing = scenario === 'comparar';
  const pctTxt = (p: number | null) => (p != null ? ` · ${p}%` : '');
  const realLine = (m: ProjMonth, v: (a: NonNullable<typeof curReal>) => string) =>
    curReal && curReal.month === m.month.slice(0, 7) ? <small className={st.realSub}>real {v(curReal)}</small> : null;

  return (
    <>
      <div className={`${s.card} ${st.filters}`}>
        <div className={st.chips} role="group" aria-label="Período">
          {periods.map((p) => (
            <Chip key={p.value} active={period === p.value} onClick={() => setPeriod(p.value)}>
              {p.label}
            </Chip>
          ))}
        </div>
        <Segmented options={scenarios} value={scenario} onChange={setScenario} className={st.seg} />
      </div>

      <div className={st.kpis}>
        <div className={`${s.card} ${st.kpi}`}>
          <span className={s.eyebrow}>Reserva em {last.label}</span>
          <span className={st.kpiVal} style={{ color: last.reserve < 0 ? 'var(--neg)' : 'var(--goldTx)' }}>
            {money(last.reserve, hidden)}
          </span>
          <span className={st.kpiSub}>
            {scenario === 'comparar' && altLast ? `com o plano · ${asTodayLabel.toLowerCase()}: ${money(altLast.reserve, hidden)}` : mainLabel}
          </span>
        </div>
        <div className={`${s.card} ${st.kpi}`}>
          <span className={s.eyebrow}>{g ? g.name : 'Meta'}</span>
          {!g || !gp ? (
            <>
              <span className={st.kpiVal}>—</span>
              <span className={st.kpiSub}>define tua meta na visão geral</span>
            </>
          ) : gp.status === 'reached' ? (
            <>
              <span className={st.kpiVal} style={{ color: 'var(--pos)' }}>Batida 🎉</span>
              <span className={st.kpiSub}>cria a próxima na visão geral</span>
            </>
          ) : gp.status === 'tooSlow' ? (
            <>
              <span className={st.kpiVal} style={{ color: 'var(--warn)' }}>Não chega</span>
              <span className={st.kpiSub}>nem com os limites, em 5 anos: baixa os limites</span>
            </>
          ) : (
            <>
              <span className={st.kpiVal}>Bate em {monthShort(gp.reachPlan!)}</span>
              <span className={st.kpiSub}>
                seguindo os limites ({money(gp.savePerMonth, hidden)}/mês) · {asTodayLabel.toLowerCase()}{' '}
                {gp.reachToday ? `chega em ${monthShort(gp.reachToday)}` : 'não chega'}
              </span>
            </>
          )}
        </div>
        {after && (
          <div className={`${s.card} ${st.kpi}`}>
            <span className={s.eyebrow}>Líquido em {monthShort(after.month)}</span>
            <span className={st.kpiVal}>{money(after.net, hidden)}</span>
            <span className={st.kpiSub}>empréstimos da folha quitados</span>
          </div>
        )}
      </div>

      {curReal && <RealVsPlanCard a={curReal} day={ov.data?.day} hidden={hidden} />}

      <div className={`${s.card} ${st.chartCard}`}>
        <div className={st.chartHead}>
          <span className={`${s.eyebrow} ${s.dOnly}`}>
            Reserva e sobra · {ms[0].label} a {last.label}
          </span>
          <div className={st.legend}>
            <span>
              <i className={st.legLine} />
              Reserva{scenario === 'comparar' ? ' com plano' : ''}
            </span>
            {scenario === 'comparar' && (
              <span>
                <i className={st.legDash} />
                Reserva {asTodayLabel.toLowerCase()}
              </span>
            )}
            <span>
              <i style={{ background: 'var(--pos)' }} />
              Sobra
            </span>
            <span>
              <i style={{ background: 'var(--neg)' }} />
              Falta
            </span>
          </div>
        </div>

        <div className={st.chart} onMouseLeave={() => setHov(null)}>
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={st.svg} aria-hidden>
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="var(--gold)" stopOpacity="0.22" />
                <stop offset="1" stopColor="var(--gold)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <line x1="0" x2={W} y1={Y(0)} y2={Y(0)} stroke="var(--ln2)" vectorEffect="non-scaling-stroke" />
            {target != null && <line x1="0" x2={W} y1={Y(target)} y2={Y(target)} stroke="var(--gold)" strokeOpacity="0.5" strokeDasharray="4 5" vectorEffect="non-scaling-stroke" />}
            {/* área da reserva até o zero (atrás das barras) */}
            <path d={`${line(ms)} L${cx(n - 1)} ${Y(0)} L${cx(0)} ${Y(0)} Z`} fill={`url(#${gid})`} />
            {ms.map((m, i) => (
              <rect
                key={m.month}
                x={cx(i) - bw / 2}
                width={bw}
                y={Math.min(Y(0), Y(m.balance))}
                height={Math.max(1, Math.abs(Y(0) - Y(m.balance)))}
                rx="3"
                fill={m.balance < 0 ? 'var(--neg)' : 'var(--pos)'}
                opacity={hov == null || hov === i ? 0.75 : 0.35}
              />
            ))}
            {alt.length > 0 && <path d={line(alt)} fill="none" stroke="var(--mu)" strokeWidth="2" strokeDasharray="5 5" vectorEffect="non-scaling-stroke" />}
            <path d={line(ms)} fill="none" stroke="var(--gold)" strokeWidth="2.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </svg>
          {target != null && (
            <div className={st.goalTag} style={{ top: pctY(target) }}>
              Meta {hidden ? '' : moneyShort(target)}
            </div>
          )}
          {h && hov != null && (
            <>
              <div className={st.hovDot} style={{ left: pctX(hov), top: pctY(h.reserve) }} />
              <div className={`${s.tooltip} ${st.tip}`} style={{ left: pctX(hov), transform: tipTx }}>
                <span className={s.tipLabel}>
                  {h.label}
                  {tags(h).length ? ` · ${tags(h).join(' · ')}` : ''}
                </span>
                <div className={st.tipRow}>
                  <span className={s.muted}>Entra</span>
                  <span>{money(h.income + h.extra, hidden)}</span>
                </div>
                {h.extra > 0 && (
                  <div className={st.tipRow}>
                    <span className={s.muted}>· 13º</span>
                    <span>{money(h.extra, hidden)}</span>
                  </div>
                )}
                <div className={st.tipRow}>
                  <span className={s.muted}>Sai</span>
                  <span>{money(h.out, hidden)}</span>
                </div>
                <div className={`${st.tipRow} ${st.tipBold}`}>
                  <span>{h.balance < 0 ? 'Falta' : 'Sobra'}</span>
                  <span style={{ color: tone(h.balance) }}>{saldo(h.balance, hidden)}</span>
                </div>
                <div className={st.tipRow}>
                  <span className={s.muted}>Reserva</span>
                  <span>{money(h.reserve, hidden)}</span>
                </div>
                {alt[hov] && (
                  <div className={st.tipRow}>
                    <span className={s.muted}>{asTodayLabel}</span>
                    <span>{money(alt[hov].reserve, hidden)}</span>
                  </div>
                )}
                {h.freed > 0 && <span className={st.tipNote}>Folha sobe {money(h.freed, hidden)}: acabou um consignado</span>}
              </div>
            </>
          )}
          <div className={st.cols} style={cols}>
            {ms.map((m, i) => (
              <div key={m.month} onMouseEnter={() => setHov(i)} onClick={() => setHov(i)} />
            ))}
          </div>
        </div>

        <div className={st.axis} style={cols}>
          {ms.map((m, i) => (
            <div key={m.month} className={n > 14 && i % 2 ? st.axisSkip : ''}>
              <span>{m.label.slice(0, 3)}</span>
              {tags(m).map((t) => (
                <i key={t} className={t === '13º' ? st.tag13 : st.tagFolha}>
                  {t === '13º' ? '13º' : '↑'}
                </i>
              ))}
            </div>
          ))}
        </div>
        <div className={st.marks}>
          <span>
            <i className={st.tag13}>13º</i> mês com 13º
          </span>
          <span>
            <i className={st.tagFolha}>↑</i> folha sobe (acaba um consignado)
          </span>
        </div>
      </div>

      <details className={`${s.card} ${st.table}`} open>
        <summary className={st.summary}>Mês a mês · toca num mês pra ver o detalhe</summary>
        <div className={`${st.tr} ${st.th} ${scenario === 'comparar' ? st.tr6 : ''}`}>
          <span>Mês</span>
          <span>Entra</span>
          <span>Sai</span>
          <span>Sobra</span>
          <span>Reserva</span>
          {scenario === 'comparar' && <span>{asTodayLabel}</span>}
        </div>
        {history.map((a) => (
          <Link key={a.month} href={`/projecao/${a.month}`} className={`${st.tr} ${comparing ? st.tr6 : ''} ${st.trReal} ${st.trLink}`}>
            <span className={st.tdMonth}>
              {a.label}
              <i className={st.tagReal}>real</i>
            </span>
            <DualCell real={a.real.income} plan={a.plan.income} pct={a.pct.income} kind="in" hidden={hidden} />
            <DualCell real={a.real.out} plan={a.plan.out} pct={a.pct.out} kind="out" hidden={hidden} />
            <DualCell real={a.real.balance} plan={a.plan.balance} pct={a.pct.balance} kind="bal" hidden={hidden} />
            <span className={s.muted}>—</span>
            {comparing && <span className={s.muted}>—</span>}
          </Link>
        ))}
        {ms.map((m, i) => (
          <Link key={m.month} href={`/projecao/${m.month.slice(0, 7)}`} className={`${st.tr} ${scenario === 'comparar' ? st.tr6 : ''} ${tags(m).length ? st.trMark : ''} ${st.trLink}`}>
            <span className={st.tdMonth}>
              {m.label}
              {tags(m).map((t) => (
                <i key={t} className={t === '13º' ? st.tag13 : st.tagFolha}>
                  {t === '13º' ? '13º' : '↑'}
                </i>
              ))}
            </span>
            <span className={`${s.muted} ${st.cell}`}>
              {money(m.income + m.extra, hidden)}
              {realLine(m, (a) => `${money(a.real.income, hidden)}${pctTxt(a.pct.income)}`)}
            </span>
            <span className={`${s.muted} ${st.cell}`}>
              {money(m.out, hidden)}
              {realLine(m, (a) => `${money(a.real.out, hidden)}${pctTxt(a.pct.out)}`)}
            </span>
            <span className={`${st.tdBold} ${st.cell}`} style={{ color: tone(m.balance) }}>
              {saldo(m.balance, hidden)}
              {realLine(m, (a) => `${saldo(a.real.balance, hidden)}${pctTxt(a.pct.balance)}`)}
            </span>
            <span className={`${st.tdBold} ${st.cell}`} style={{ color: m.reserve < 0 ? 'var(--neg)' : undefined }}>
              {money(m.reserve, hidden)}
              {realLine(m, (a) => (a.reserve ? `${money(a.reserve.real, hidden)}${pctTxt(a.reserve.pct)}` : '—'))}
            </span>
            {scenario === 'comparar' && <span className={s.muted}>{alt[i] ? money(alt[i].reserve, hidden) : '—'}</span>}
          </Link>
        ))}
      </details>

      <ReserveCard hidden={hidden} />

      <div className={s.note}>
        Base: {payslip ? `holerite de ${monthShort(payslip.month)}` : 'renda do teu perfil'}
        {extrato?.periodStart && extrato.periodEnd ? ` e extrato ${bankName} de ${dayMonth(extrato.periodStart)} a ${dayMonth(extrato.periodEnd)}` : ''}. A reserva parte do teu
        guardado{goal.data ? ` (${money(goal.data.saved, hidden)})` : ''} no início do mês: o que foi pra caixinha neste mês já conta como sobra dele. 13º estimado pelo salário base. &quot;{asTodayLabel}&quot; = gastos variáveis
        iguais a {prevName}; &quot;plano IA&quot; = gastar até o limite de cada categoria. Linhas &quot;real&quot; = o que aconteceu na conta, com o plano de hoje
        (fixos + limites) e o % embaixo; no mês atual, a reserva real é o teu guardado e a sobra real é o saldo da tua conta agora.
      </div>
    </>
  );
}
