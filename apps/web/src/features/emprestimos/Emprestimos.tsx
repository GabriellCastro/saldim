'use client';
import { useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { fetcher } from '@/lib/api';
import { money, pct } from '@/lib/format';
import { useUser } from '@/lib/session';
import { Button, Eyebrow } from '@/components/ui';
import { LoadError, Skeleton } from '@/components/ui/ScreenState';
import { addMonths, currentMonth, monthShort } from '@/features/holerite/month';
import { ContaDebits } from './ContaDebits';
import { LoanForm } from './LoanForm';
import { LoanSimulator } from './LoanSimulator';
import type { Loan, LoansResponse } from './types';
import styles from './Emprestimos.module.css';

const SPAN = 15; // meses visíveis na linha do tempo (como no design)

export function Emprestimos() {
  const { hidden } = useUser();
  const { data, error, isLoading, mutate } = useSWR<LoansResponse>('/loans', fetcher);
  const payslip = useSWR<{ net: number } | null>('/payslips/latest', fetcher);
  const { mutate: globalMutate } = useSWRConfig();
  const [simId, setSimId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Loan | 'new' | null>(null);

  if (isLoading) return <Skeleton heights={[118, 460]} />;
  if (error || !data) return <LoadError onRetry={() => mutate()} />;

  const f = (v: number) => money(v, hidden);
  const now = currentMonth();
  const folha = data.items.filter((l) => l.source === 'FOLHA');
  const conta = data.items.filter((l) => l.source === 'CONTA');
  const net = payslip.data?.net ?? null;
  const longest = [...data.items].sort((a, b) => b.remainingInstallments - a.remainingInstallments)[0];
  const sim = data.items.find((l) => l.id === simId) ?? longest;

  const refresh = () => {
    void mutate();
    void globalMutate((k) => typeof k === 'string' && (k.startsWith('/dashboard') || k.startsWith('/goals')));
  };

  // Geometria: total descontado na folha em cada um dos próximos 15 meses.
  const folhaByMonth = Array.from({ length: SPAN }, (_, i) =>
    folha.reduce((s, l) => s + (l.remainingInstallments > i ? l.installment : 0), 0),
  );
  const barMax = Math.max(...folhaByMonth, 1);
  const laterIdx = 9;
  const kpis = [
    {
      label: 'Parcelas por mês',
      value: f(data.kpis.monthlyFolha),
      sub: net ? `${pct(data.kpis.monthlyFolha / net)} do salário líquido` : 'descontado na folha',
      tone: styles.neg,
    },
    { label: 'Ainda a pagar', value: f(data.kpis.totalRemaining), sub: 'nominal, soma das parcelas', tone: '' },
    {
      label: `Em ${monthShort(addMonths(now, laterIdx))} na folha`,
      value: f(folhaByMonth[laterIdx]),
      sub: data.kpis.endsNext3Months
        ? `${data.kpis.endsNext3Months} contrato(s) acabam em até 3 meses`
        : `${folha.filter((l) => l.remainingInstallments > laterIdx).length} contrato(s) ainda ativo(s)`,
      tone: styles.pos,
    },
  ];

  const form = editing && (
    <LoanForm
      loan={editing === 'new' ? null : editing}
      onClose={() => setEditing(null)}
      onSaved={(l) => {
        setEditing(null);
        if (l) setSimId(l.id);
        refresh();
      }}
    />
  );

  if (data.items.length === 0) {
    return (
      <>
        <div className={`${styles.card} ${styles.empty}`}>
          <Eyebrow>Empréstimos</Eyebrow>
          <p>Nenhum empréstimo cadastrado. Se tiver consignado na folha ou débito na conta, cadastra aqui pra IA considerar na projeção.</p>
          <Button onClick={() => setEditing('new')}>Adicionar contrato</Button>
        </div>
        {form}
      </>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.kpis}>
        {kpis.map((k) => (
          <div key={k.label} className={styles.kpi}>
            <Eyebrow className={styles.eyebrow}>{k.label}</Eyebrow>
            <span className={`${styles.kpiValue} ${k.tone}`}>{k.value}</span>
            <span className={styles.kpiSub}>{k.sub}</span>
          </div>
        ))}
      </div>
      {/* mobile: um único cartão-resumo */}
      <div className={styles.kpiMobile}>
        <div>
          <span className={styles.kpiSub}>Na folha por mês</span>
          <span className={`${styles.kpiMobileValue} ${styles.neg}`}>{f(data.kpis.monthlyFolha)}</span>
        </div>
        {net ? (
          <span className={styles.kpiSub}>
            {pct(data.kpis.monthlyFolha / net)} do
            <br />
            líquido
          </span>
        ) : null}
      </div>

      <div className={styles.columns}>
        <div className={`${styles.card} ${styles.main}`}>
          {folha.length > 0 && (
            <>
              <div className={`${styles.grid} ${styles.head}`}>
                <Eyebrow className={styles.eyebrow}>Contrato</Eyebrow>
                <div className={styles.axis}>
                  <span>{monthShort(now)}</span>
                  <span>{monthShort(addMonths(now, 6))}</span>
                  <span>{monthShort(addMonths(now, SPAN - 1))}</span>
                </div>
                <span className={styles.headRight}>Parcela</span>
              </div>
              {folha.map((l) => (
                <LoanRow key={l.id} loan={l} active={l.id === sim?.id} onClick={() => setSimId(l.id)} f={f} />
              ))}
            </>
          )}

          <div className={styles.conta}>
            <div className={styles.contaHead}>
              <Eyebrow className={styles.eyebrow}>Fora da folha · debitados na conta</Eyebrow>
              {data.kpis.monthlyConta > 0 && <span className={styles.contaTotal}>{f(data.kpis.monthlyConta)}/mês</span>}
            </div>
            {conta.length === 0 && data.kpis.monthlyConta > 0 && <ContaDebits f={f} />}
            {conta.length === 0 && data.kpis.monthlyConta === 0 && (
              <span className={styles.muted}>Nenhum empréstimo debitado na conta.</span>
            )}
            {conta.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`${styles.contaRow} ${c.id === sim?.id ? styles.contaActive : ''}`}
                onClick={() => setSimId(c.id)}
              >
                <span>
                  {c.name} <span className={styles.muted}>· {c.currentInstallment}/{c.totalInstallments} · {endLabel(c)}</span>
                </span>
                <span className={styles.strong}>{f(c.installment)}</span>
              </button>
            ))}
          </div>

          {folha.length > 0 && (
            <div className={styles.barsBlock}>
              <Eyebrow className={styles.eyebrow}>Total descontado na folha por mês</Eyebrow>
              <div className={styles.bars} role="img" aria-label="Desconto em folha nos próximos 15 meses">
                {folhaByMonth.map((v, i) => (
                  <div key={i} className={styles.barCol} title={`${monthShort(addMonths(now, i))}: ${f(v)}`}>
                    <div
                      className={styles.bar}
                      style={{ height: `${(v / barMax) * 100}%`, opacity: v === barMax ? 1 : 0.55 }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className={styles.addRow}>
            <button type="button" className={styles.link} onClick={() => setEditing('new')}>
              + Adicionar contrato
            </button>
          </div>
        </div>

        {sim && (
          <LoanSimulator
            loan={sim}
            isLongest={sim.id === longest?.id}
            f={f}
            onEdit={() => setEditing(sim)}
            onDeleted={() => {
              setSimId(null);
              refresh();
            }}
          />
        )}
      </div>
      {form}
    </div>
  );
}

export const endLabel = (l: Loan) =>
  l.remainingInstallments === 0 ? 'última paga' : `última ${monthShort(l.endMonth)}`;

function LoanRow({ loan: l, active, onClick, f }: { loan: Loan; active: boolean; onClick: () => void; f: (v: number) => string }) {
  const left = l.remainingInstallments;
  const label = left > SPAN ? `até ${monthShort(l.endMonth)}` : left ? `${left}x` : '';
  return (
    <button type="button" className={`${styles.grid} ${styles.row} ${active ? styles.rowActive : ''}`} onClick={onClick}>
      <div className={styles.rowName}>
        <span className={styles.name}>{l.name}</span>
        <span className={styles.meta}>
          {l.currentInstallment}/{l.totalInstallments} · {endLabel(l)}
        </span>
      </div>
      <div className={styles.track}>
        <div className={styles.fill} style={{ width: `${(Math.min(left, SPAN) / SPAN) * 100}%` }}>
          <span className={styles.fillLabel}>{label}</span>
        </div>
        {left === 0 && <span className={styles.done}>Quitado</span>}
      </div>
      <span className={styles.parc}>{f(l.installment)}</span>
    </button>
  );
}
