'use client';
import { useState } from 'react';
import useSWR from 'swr';
import { del, fetcher } from '@/lib/api';
import { Eyebrow } from '@/components/ui';
import { monthShort } from '@/features/holerite/month';
import type { Loan, OverviewLite, ProjectionLite } from './types';
import styles from './Emprestimos.module.css';

type Props = { loan: Loan; isLongest: boolean; f: (v: number) => string; onEdit: () => void; onDeleted: () => void };

export function LoanSimulator({ loan: l, isLongest, f, onEdit, onDeleted }: Props) {
  const [deleting, setDeleting] = useState(false);
  const left = l.remainingInstallments;
  const where = l.source === 'FOLHA' ? 'na folha' : 'na conta';

  const advice =
    left === 0
      ? `Esse já foi quitado ${where}. A partir do mês que vem esse valor volta pro teu bolso.`
      : left <= 2
        ? 'Faltam poucas parcelas. Não vale usar reserva aqui: ele sai sozinho em breve. Guarda o valor liberado quando terminar.'
        : isLongest
          ? `É o mais longo: vai até ${monthShort(l.endMonth)}. Bom candidato pra quitar com parte do 13º, mas só depois da reserva mínima. Pede o saldo com desconto de juros antes.`
          : `Quitar agora libera ${f(l.installment)} por mês. Compara o saldo com desconto com o que tu juntaria guardando esse valor até o fim.`;

  async function remove() {
    if (!window.confirm(`Excluir "${l.name}"? Isso tira o contrato da projeção.`)) return;
    setDeleting(true);
    try {
      await del(`/loans/${l.id}`);
      onDeleted();
    } catch {
      window.alert('Não deu pra excluir agora. Tenta de novo.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <aside className={`${styles.card} ${styles.sim}`} aria-label="Simulador de quitação">
      <div className={styles.simTag}>
        <span className={styles.glowDot} />
        <span>SIMULADOR IA</span>
      </div>
      <div className={styles.simTitle}>E se eu quitar {l.name}?</div>
      <div className={styles.simList}>
        <div className={styles.simItem}>
          <span>Saldo nominal</span>
          <b>{f(l.remainingAmount)}</b>
        </div>
        <div className={styles.simItem}>
          <span>Libera por mês</span>
          <b className={styles.gold}>{f(l.installment)}</b>
        </div>
        <div className={styles.simItem}>
          <span>Parcelas evitadas</span>
          <b>{left}</b>
        </div>
        <div className={styles.simItem}>
          <span>Terminaria em</span>
          <b>{left ? monthShort(l.endMonth) : 'já terminou'}</b>
        </div>
      </div>

      <ReserveMin f={f} loanDone={left === 0} />

      <div className={styles.advice}>{advice}</div>
      <div className={styles.fine}>
        Valor nominal sem desconto de juros. Na quitação antecipada o banco abate os juros futuros; peça o saldo devedor
        exato no RH ou no app do banco.
      </div>
      <div className={styles.simActions}>
        <button type="button" className={styles.pill} onClick={onEdit}>
          Editar contrato
        </button>
        <button type="button" className={`${styles.pill} ${styles.pillDanger}`} onClick={remove} disabled={deleting}>
          {deleting ? 'Excluindo…' : 'Excluir'}
        </button>
      </div>
    </aside>
  );
}

/** Reserva mínima = 1 mês de gastos fixos (overview); "chega em" = 1º mês em que a reserva projetada cobre isso. */
function ReserveMin({ f, loanDone }: { f: (v: number) => string; loanDone: boolean }) {
  const overview = useSWR<OverviewLite>('/dashboard/overview', fetcher);
  const projection = useSWR<ProjectionLite>('/dashboard/projection', fetcher);
  if (!overview.data) return null;

  const target = overview.data.fixedTotal;
  const months = projection.data?.months ?? [];
  let reserve = 0;
  let reachedIdx = -1;
  for (let i = 0; i < months.length && reachedIdx < 0; i++) {
    reserve = months[i].reserve ?? reserve + months[i].balance;
    if (reserve >= target) reachedIdx = i;
  }
  const reachedAt = months[reachedIdx];
  const ready = reachedIdx === 0;
  const when = reachedAt ? reachedAt.label : projection.data ? 'depois da projeção' : '…';
  const tone = ready ? styles.pos : styles.warn;
  const rule = loanDone
    ? 'Esse contrato já acabou: não precisa da reserva.'
    : ready
      ? `Tua reserva já cobre 1 mês. Usa só o que passar de ${f(target)} pra quitar.`
      : `Não quita nada antes de juntar ${f(target)} (${when}). Depois disso, usa só o que passar desse valor.`;

  return (
    <div className={styles.reserve}>
      <div className={styles.reserveHead}>
        <Eyebrow className={styles.eyebrow}>Reserva mínima</Eyebrow>
        <span className={`${styles.badge} ${tone}`}>{ready ? 'Pronta' : 'Ainda não'}</span>
      </div>
      <div className={styles.reserveValue}>
        <span>{f(target)}</span>
        <small>= 1 mês dos teus gastos fixos</small>
      </div>
      <div className={styles.reserveTrack}>
        <div className={`${styles.reserveFill} ${tone}`} style={{ width: ready ? '100%' : '0%' }} />
      </div>
      <div className={styles.reserveWhen}>
        <span>Meta da reserva</span>
        <span>
          Chega em <b>{when}</b>
        </span>
      </div>
      <div className={styles.parts}>
        {overview.data.fixed.map((p) => (
          <div key={p.label}>
            <span>{p.label}</span>
            <span>{f(p.amount)}</span>
          </div>
        ))}
      </div>
      <div className={styles.rule}>{rule}</div>
    </div>
  );
}
