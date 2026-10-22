'use client';
import { useState } from 'react';
import useSWRInfinite from 'swr/infinite';
import { AiMark } from '@/components/ui/Pill';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/State';
import { areaPath, linePath, pctCss, scale } from '@/components/charts/geometry';
import { fetcher } from '@/lib/api';
import { ddmm, initials, money, signedMoney } from '@/lib/format';
import { dayMonth } from '@/lib/months';
import { useUser } from '@/lib/session';
import { useOverview, useSpending } from '@/features/dashboard/hooks';
import { cap } from '@/features/dashboard/fmt';
import { RichText } from '@/features/dashboard/RichText';
import type { Overview, Tx } from '@/features/dashboard/types';
import { useScreenHead } from '@/features/shell/ShellContext';
import { useShellData } from '@/features/shell/useShellData';
import s from '@/features/dashboard/screen.module.css';
import st from './gastos.module.css';
import { UnexpectedCard } from '@/features/imprevistos/UnexpectedCard';
import { UnexpectedDialog } from '@/features/imprevistos/UnexpectedDialog';
import ui from '@/features/imprevistos/imprevistos.module.css';
import { BalanceCard } from './BalanceCard';
import { ALL, PeriodFilter, periodLabel, type Period } from './PeriodFilter';

const PAGE = 14;
type TxPage = { items: Tx[]; nextCursor: string | null };

export function GastosScreen() {
  const { user, hidden } = useUser();
  const ov = useOverview();
  // período: padrão = mês corrente (o do lançamento mais recente, vindo do overview)
  const [picked, setPicked] = useState<Period | null>(null);
  const period = picked ?? ov.data?.month ?? null;
  const sp = useSpending(period);
  const { bankName: bank, extrato: imp } = useShellData(!!user);
  const [cat, setCat] = useState<string | null>(null);
  // lançamento aberto no modal de imprevisto
  const [txOpen, setTxOpen] = useState<Tx | null>(null);

  useScreenHead(imp?.periodStart && imp.periodEnd ? `Extrato ${bank} · ${dayMonth(imp.periodStart)} a ${dayMonth(imp.periodEnd)} · ${imp.count} lançamentos` : `Extrato ${bank}`);

  if (ov.error || sp.error)
    return (
      <ErrorState
        onRetry={() => {
          ov.mutate();
          sp.mutate();
        }}
      />
    );
  if (!ov.data || !sp.data)
    return (
      <div className={st.grid}>
        <Skeleton h={420} />
        <Skeleton h={420} />
      </div>
    );

  const cats = sp.data.byCategory
    .filter((c) => c.kind === 'fixo' || c.kind === 'variavel')
    .map((c) => ({ ...c, v: Math.abs(c.amount) }))
    .filter((c) => c.v > 0)
    .sort((a, b) => b.v - a.v);
  const maxV = cats[0]?.v || 1;
  const catLabel = cats.find((c) => c.id === cat)?.label;
  const toggleCat = (id: string) => setCat((c) => (c === id ? null : id));
  const sm = periodLabel(sp.data.month);
  const all = sp.data.month === ALL;

  const catCard = (
    <div className={`${s.card} ${st.cats}`}>
      <div className={s.head}>
        <span className={s.eyebrow}>{cap(sm)} por categoria</span>
        <span className={st.hint}>
          <span className={s.dOnly}>{all ? '% da renda do período' : '% da renda'}</span>
          <span className={st.hintM}>toca pra filtrar</span>
        </span>
      </div>
      {!cats.length && <EmptyState message={all ? 'Ainda não tem gastos.' : `Sem gastos em ${sm}.`} />}
      {cats.map((c) => (
        <button type="button" key={c.id} className={`${st.catRow} ${cat === c.id ? st.catOn : ''}`} onClick={() => toggleCat(c.id)} aria-pressed={cat === c.id}>
          <div className={st.catMain}>
            <div className={st.catName}>
              <span className={st.catLabel}>{c.label}</span>
              <span className={st.kind}>{c.kind === 'fixo' ? 'fixo' : 'variável'}</span>
              <span className={st.catValM}>{money(c.v, hidden)}</span>
            </div>
            <div className={st.bar}>
              <div style={{ width: pctCss((c.v / maxV) * 100), background: c.kind === 'fixo' ? 'var(--mu)' : 'var(--gold)' }} />
            </div>
          </div>
          <span className={st.share}>{Math.round(c.pctIncome)}%</span>
          <span className={st.catVal}>{money(c.v, hidden)}</span>
        </button>
      ))}
    </div>
  );
  const insight = sp.data.insight ? (
    <div className={`${s.card} ${st.insight}`}>
      <AiMark />
      <p className={s.insight}>
        <RichText text={sp.data.insight} hidden={hidden} />
      </p>
    </div>
  ) : null;

  return (
    <div className={st.screen}>
      <BalanceCard extratoUntil={imp?.periodEnd} spent={sp.data.total} periodName={sm} hidden={hidden} />
      <PeriodFilter
        value={period ?? sp.data.month}
        onChange={(p) => setPicked(p)}
        thisMonth={ov.data.month}
        months={sp.data.months}
      />
      <div className={st.grid}>
        <div className={st.colL}>
          <div className={st.orderCats}>{catCard}</div>
          <div className={st.orderInsight}>{insight}</div>
          <div className={st.orderUnexpected}>
            <UnexpectedCard month={sp.data.month} periodName={sm} hidden={hidden} onPick={setTxOpen} />
          </div>
        </div>
        <div className={st.colR}>
          <div className={st.orderPace}>
            <PaceCard ov={ov.data} hidden={hidden} />
          </div>
          <div className={st.orderTx}>
            <TxList
              month={all ? undefined : sp.data.month}
              category={cat}
              title={catLabel ? `${catLabel} · ${sm}` : all ? 'Todos os lançamentos' : `Lançamentos de ${sm}`}
              action={cat ? 'Limpar filtro' : bank}
              onAction={() => setCat(null)}
              onPick={setTxOpen}
              hidden={hidden}
            />
          </div>
        </div>
      </div>
      {txOpen && <UnexpectedDialog tx={txOpen} hidden={hidden} onClose={() => setTxOpen(null)} />}
    </div>
  );
}

/** Variáveis de salário a salário: quanto já foi, quanto ainda dá e o ritmo (tracejado = ideal). */
function PaceCard({ ov, hidden }: { ov: Overview; hidden: boolean }) {
  const PW = 310;
  const PH = 120;
  const c = ov.cycle;
  const over = c.remaining < 0;
  const ymax = Math.max(c.limit, ...c.daily) * 1.05 || 1;
  const X = scale(0, c.days, 0, PW);
  const Y = scale(0, ymax, PH, 0);
  const pts = c.daily.map((d, i): [number, number] => [X(i), Y(d)]);
  const used = c.limit ? Math.min(100, (c.spent / c.limit) * 100) : 0;
  const toPay = c.days - c.day + 1;
  return (
    <div className={`${s.card} ${st.pace}`}>
      <div className={s.head}>
        <span className={s.eyebrow}>Variáveis até o salário</span>
        <span className={st.hint}>
          salário {ddmm(c.nextPayday)} · {toPay <= 1 ? 'amanhã' : `faltam ${toPay} dias`}
        </span>
      </div>
      <div className={st.paceTop}>
        <span className={st.paceBig} style={over ? { color: 'var(--neg)' } : undefined}>
          {money(Math.abs(c.remaining), hidden)}
        </span>
        <span className={st.paceOf}>{over ? 'acima do limite' : `ainda dá pra gastar até ${ddmm(c.nextPayday)}`}</span>
      </div>
      {!over && c.daysLeft > 0 && (
        <span className={st.perDay}>
          Uns <b>{money(c.perDay, hidden)}</b> por dia
        </span>
      )}
      <div className={st.cycleBar} role="progressbar" aria-label="Quanto do limite já foi" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(used)}>
        <div className={over ? st.barOver : undefined} style={{ width: pctCss(used) }} />
      </div>
      <div className={st.barLegend}>
        <span>
          Gastou <b>{money(c.spent, hidden)}</b> desde {ddmm(c.start)}
        </span>
        <span>limite {money(c.limit, hidden)}</span>
      </div>
      <div className={st.paceChart}>
        <svg viewBox={`0 0 ${PW} ${PH}`} preserveAspectRatio="none">
          <line x1="0" y1={PH} x2={PW} y2={Y(c.limit)} stroke="var(--ln2)" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
          <path d={areaPath(pts, PH)} fill="rgba(252,192,0,0.14)" />
          <path d={linePath(pts)} fill="none" stroke="var(--gold)" strokeWidth="2.5" className={st.glow} vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <div className={`${st.paceAxis} ${s.dOnly}`}>
        <span>salário {ddmm(c.start)}</span>
        <span>hoje</span>
        <span>salário {ddmm(c.nextPayday)}</span>
      </div>
      <div className={s.small}>
        <span className={s.dOnly}>Linha tracejada: ritmo ideal pra chegar no próximo salário dentro do limite. </span>
        Tu tá{' '}
        <b style={{ color: c.diff > 0 ? 'var(--neg)' : 'var(--pos)', fontWeight: 600 }}>{money(Math.abs(c.diff), hidden)}</b> {c.diff > 0 ? 'acima' : 'abaixo'} do ritmo
        <span className={st.hintInline}> ideal</span>.
      </div>
    </div>
  );
}

/** Últimos lançamentos com filtro por categoria e "Ver mais" (cursor). */
function TxList({
  month,
  category,
  title,
  action,
  onAction,
  onPick,
  hidden,
}: {
  /** 'YYYY-MM'; sem = todos os meses */
  month?: string;
  category: string | null;
  title: string;
  action: string;
  onAction: () => void;
  /** toca num gasto: abre o modal de imprevisto */
  onPick: (tx: Tx) => void;
  hidden: boolean;
}) {
  const key = (i: number, prev: TxPage | null) => {
    if (prev && !prev.nextCursor) return null;
    const q = new URLSearchParams({ take: String(PAGE) });
    if (month) q.set('month', month);
    if (category) q.set('category', category);
    if (prev?.nextCursor) q.set('cursor', prev.nextCursor);
    return `/transactions?${q}`;
  };
  const { data, error, size, setSize, isLoading, isValidating, mutate } = useSWRInfinite<TxPage>(key, fetcher);
  const items = data?.flatMap((p) => p.items) ?? [];
  const hasMore = !!data?.[data.length - 1]?.nextCursor;
  const loadingMore = isValidating && size > (data?.length ?? 0);

  return (
    <div className={`${s.card} ${st.tx}`}>
      <div className={`${s.head} ${st.txHead}`}>
        <span className={s.eyebrow}>{title}</span>
        <button type="button" className={s.link} onClick={onAction}>
          {action}
        </button>
      </div>
      {error ? (
        <ErrorState onRetry={() => mutate()} />
      ) : isLoading ? (
        <Skeleton h={300} />
      ) : !items.length ? (
        <EmptyState message={category ? 'Nenhum lançamento nessa categoria nesse período.' : month ? 'Nenhum lançamento nesse mês.' : 'Ainda não tem lançamentos.'} />
      ) : (
        items.map((t) => {
          const row = (
            <>
              <div className={st.ini}>{initials(t.description).replace(/[^A-ZÀ-Ú0-9]/g, '') || '•'}</div>
              <div className={st.txTx}>
                <span className={st.txName}>{t.description}</span>
                <span className={st.txMeta}>
                  {ddmm(t.date)} · {t.categoryLabel}
                  {t.unexpected && <span className={ui.tag}>imprevisto</span>}
                </span>
              </div>
              <span className={st.txVal} style={{ color: t.amount > 0 ? 'var(--pos)' : 'var(--tx)' }}>
                {signedMoney(t.amount, hidden)}
              </span>
            </>
          );
          // só gasto pode virar imprevisto
          return t.amount < 0 ? (
            <button key={t.id} type="button" className={`${st.txRow} ${st.txBtn}`} onClick={() => onPick(t)} title="Marcar como imprevisto">
              {row}
            </button>
          ) : (
            <div key={t.id} className={st.txRow}>
              {row}
            </div>
          );
        })
      )}
      {(hasMore || size > 1) && !error && (
        <button type="button" className={st.more} disabled={loadingMore} onClick={() => setSize(hasMore ? size + 1 : 1)}>
          {loadingMore ? 'Carregando…' : hasMore ? 'Ver mais lançamentos' : 'Mostrar menos'}
        </button>
      )}
    </div>
  );
}
