'use client';
import { useRef, useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { ApiError, fetcher, post } from '@/lib/api';
import { money } from '@/lib/format';
import { useUser } from '@/lib/session';
import { Button, Eyebrow } from '@/components/ui';
import { LoadError, Skeleton } from '@/components/ui/ScreenState';
import { ManualPayslipForm } from './ManualPayslipForm';
import { monthLong, monthShort } from './month';
import type { Payslip } from './types';
import styles from './Holerite.module.css';

type Upload = { st: 'idle' } | { st: 'busy'; name: string } | { st: 'error'; message: string };

export function Holerite() {
  const { hidden } = useUser();
  const latest = useSWR<Payslip | null>('/payslips/latest', fetcher);
  const history = useSWR<Payslip[]>('/payslips', fetcher);
  const { mutate } = useSWRConfig();
  const [month, setMonth] = useState<string | null>(null);
  const [upload, setUpload] = useState<Upload>({ st: 'idle' });
  const [manual, setManual] = useState<{ open: boolean; reason?: string }>({ open: false });
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = async (saved: Payslip) => {
    setMonth(saved.month);
    await mutate((k) => typeof k === 'string' && (k.startsWith('/payslips') || k.startsWith('/dashboard') || k.startsWith('/goals') || k === '/imports' || k === '/auth/me'));
  };

  async function send(file: File) {
    setUpload({ st: 'busy', name: file.name });
    const fd = new FormData();
    fd.append('file', file);
    try {
      const saved = await post<Payslip>('/imports/holerite', fd);
      setUpload({ st: 'idle' });
      await refresh(saved);
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        setUpload({ st: 'idle' });
        setManual({ open: true, reason: `Não consegui ler "${file.name}". Preenche os valores do holerite aqui que a gente segue.` });
      } else {
        setUpload({ st: 'error', message: e instanceof Error ? e.message : 'Falha ao enviar o holerite.' });
      }
    }
  }

  if (latest.isLoading) return <Skeleton heights={[56, 300, 420]} />;
  if (latest.error) return <LoadError onRetry={() => latest.mutate()} />;

  const all = history.data ?? (latest.data ? [latest.data] : []);
  const slip = all.find((p) => p.month === month) ?? latest.data ?? null;
  const f = (v: number) => money(v, hidden);
  const bare = (v: number) => f(v).replace(/^R\$\s?/, '');

  const fileInput = (
    <input
      ref={fileRef}
      type="file"
      accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/*"
      hidden
      onChange={(e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (file) void send(file);
      }}
    />
  );

  const toolbar = (
    <div className={styles.toolbar}>
      <div className={styles.months} role="tablist" aria-label="Competência">
        {[...all]
          .sort((a, b) => b.month.localeCompare(a.month))
          .map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={p.month === slip?.month}
              className={`${styles.chip} ${p.month === slip?.month ? styles.chipOn : ''}`}
              onClick={() => setMonth(p.month)}
            >
              {monthShort(p.month)}
            </button>
          ))}
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.link} onClick={() => setManual({ open: true })}>
          Preencher na mão
        </button>
        <Button onClick={() => fileRef.current?.click()} disabled={upload.st === 'busy'} className={styles.uploadBtn}>
          {upload.st === 'busy' ? 'Lendo holerite…' : 'Enviar holerite'}
        </Button>
      </div>
    </div>
  );

  const status =
    upload.st === 'busy' ? (
      <div className={styles.notice}>
        Lendo <b>{upload.name}</b>… <span className={styles.pulse} />
      </div>
    ) : upload.st === 'error' ? (
      <div className={`${styles.notice} ${styles.noticeErr}`} role="alert">
        {upload.message}
        <button type="button" className={styles.link} onClick={() => setUpload({ st: 'idle' })}>
          Fechar
        </button>
      </div>
    ) : null;

  const form = manual.open && (
    <ManualPayslipForm
      reason={manual.reason}
      initial={slip}
      onClose={() => setManual({ open: false })}
      onSaved={async (saved) => {
        setManual({ open: false });
        await refresh(saved);
      }}
    />
  );

  if (!slip) {
    return (
      <div className={styles.page}>
        {fileInput}
        {status}
        <div className={`${styles.card} ${styles.empty}`}>
          <Eyebrow>Holerite</Eyebrow>
          <p>
            Ainda não tem holerite aqui. Envia o PDF (ou foto) do teu contracheque que a IA separa proventos, descontos e
            empréstimos em folha.
          </p>
          <div className={styles.actions}>
            <Button onClick={() => fileRef.current?.click()} disabled={upload.st === 'busy'}>
              Enviar holerite
            </Button>
            <button type="button" className={styles.link} onClick={() => setManual({ open: true })}>
              Preencher na mão
            </button>
          </div>
        </div>
        {form}
      </div>
    );
  }

  const descontos = slip.items.filter((i) => i.kind === 'desconto');
  const totalDesc = descontos.reduce((s, i) => s + Math.abs(i.amount), 0);
  const steps = waterfall(slip);

  return (
    <div className={styles.page}>
      {fileInput}
      {toolbar}
      {status}

      <div className={`${styles.card} ${styles.wfCard}`}>
        <div className={styles.wfHead}>
          <Eyebrow className={styles.eyebrow}>Do bruto ao líquido</Eyebrow>
          <span className={styles.muted}>Competência {monthLong(slip.month)}</span>
        </div>
        {steps.map((w, i) => (
          <div key={w.label} className={styles.wfRow}>
            <span className={`${styles.wfLabel} ${w.strong ? styles.strong : ''}`}>{w.label}</span>
            <div className={styles.wfTrack}>
              <div
                className={`${styles.wfBar} ${styles[w.tone]}`}
                style={{ left: `${(w.start / slip.gross) * 100}%`, width: `${Math.max((w.value / slip.gross) * 100, 0.4)}%` }}
              />
            </div>
            <span className={`${styles.wfValue} ${w.strong ? styles.strong : ''} ${styles['v_' + w.tone]}`}>
              {i > 0 && i < steps.length - 1 ? '−' : ''}
              {f(w.value)}
            </span>
          </div>
        ))}
      </div>

      <div className={`${styles.card} ${styles.tableCard}`}>
        <div className={`${styles.trow} ${styles.thead}`}>
          <span className={styles.code}>Cód.</span>
          <span>Descrição</span>
          <span className={styles.num}>Vencimentos</span>
          <span className={styles.num}>Descontos</span>
        </div>
        {slip.items.map((it, i) => (
          <div key={i} className={styles.trow}>
            <span className={styles.code}>{it.code ?? ''}</span>
            <span>{it.label}</span>
            <span className={styles.num}>{it.kind === 'provento' ? bare(it.amount) : ''}</span>
            <span className={`${styles.num} ${styles.negTx}`}>{it.kind === 'desconto' ? bare(Math.abs(it.amount)) : ''}</span>
          </div>
        ))}
        <div className={`${styles.trow} ${styles.tfoot}`}>
          <span className={styles.code} />
          <span>Líquido {f(slip.net)}</span>
          <span className={styles.num}>{f(slip.gross)}</span>
          <span className={`${styles.num} ${styles.negTx}`}>{f(totalDesc)}</span>
        </div>
      </div>
      {form}
    </div>
  );
}

type Step = { label: string; value: number; start: number; tone: 'bar' | 'neg' | 'red' | 'pos'; strong?: boolean };

/** Geometria da cascata: bruto → grupos de desconto → líquido (só apresentação dos itens do holerite). */
function waterfall(p: Payslip): Step[] {
  const groups: { label: string; test: RegExp; tone: Step['tone']; sum: number; n: number }[] = [
    { label: 'INSS', test: /inss/i, tone: 'neg', sum: 0, n: 0 },
    { label: 'IRRF', test: /irrf|imposto de renda/i, tone: 'neg', sum: 0, n: 0 },
    { label: 'Empréstimos', test: /empr[eé]stimo|consignad/i, tone: 'red', sum: 0, n: 0 },
    { label: 'Outros descontos', test: /./, tone: 'neg', sum: 0, n: 0 },
  ];
  for (const it of p.items) {
    if (it.kind !== 'desconto') continue;
    const g = groups.find((x) => x.test.test(it.label))!;
    g.sum += Math.abs(it.amount);
    g.n += 1;
  }
  let cursor = p.gross;
  const mid = groups
    .filter((g) => g.sum > 0)
    .map((g) => {
      cursor -= g.sum;
      const label = g.label === 'Empréstimos' ? `Empréstimos (${g.n})` : g.label;
      return { label, value: g.sum, start: Math.max(cursor, 0), tone: g.tone };
    });
  return [
    { label: 'Salário bruto', value: p.gross, start: 0, tone: 'bar', strong: true },
    ...mid,
    { label: 'Salário líquido', value: p.net, start: 0, tone: 'pos', strong: true },
  ];
}
