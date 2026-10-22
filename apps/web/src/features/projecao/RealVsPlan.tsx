'use client';
import { pctCss } from '@/components/charts/geometry';
import { money } from '@/lib/format';
import { monthLong } from '@/lib/months';
import { cap, saldo } from '@/features/dashboard/fmt';
import type { ActualMonth } from '@/features/dashboard/types';
import s from '@/features/dashboard/screen.module.css';
import st from './projecao.module.css';

/** Um indicador: valor real, o que a IA esperava e a barra do % atingido. */
function Item({ label, real, plan, planText, pct, pctText, good, note, hidden }: {
  label: string;
  real: number;
  plan: number;
  planText: string;
  pct: number | null;
  pctText: string;
  /** a barra fica verde quando o resultado é bom */
  good: boolean;
  /** linha extra embaixo (ex.: o que já foi descontado) */
  note?: React.ReactNode;
  hidden: boolean;
}) {
  return (
    <div className={st.rvpItem}>
      <span className={st.rvpLabel}>{label}</span>
      <span className={st.rvpVal}>{money(real, hidden)}</span>
      <span className={st.rvpPlan}>
        {planText} {money(plan, hidden)}
      </span>
      {pct != null && (
        <>
          <div className={st.rvpBar} role="progressbar" aria-label={`${label}: % do plano`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.max(0, pct))}>
            <div style={{ width: pctCss(Math.min(100, Math.max(0, pct))), background: good ? 'var(--pos)' : 'var(--gold)' }} />
          </div>
          <span className={st.rvpPct}>
            <b>{pct}%</b> {pctText}
          </span>
        </>
      )}
      {note && <span className={st.rvpNote}>{note}</span>}
    </div>
  );
}

/** Excedente do guardado no mês (acima da meta de guardar), abatido da sobra esperada. */
export function SavingNote({ sv, hidden }: { sv: { month: number; planned: number; extra: number }; hidden: boolean }) {
  return (
    <>
      Tu guardou <b>{money(sv.extra, hidden)}</b> a mais que a meta de guardar ({money(sv.month, hidden)} de {money(Math.max(0, sv.planned), hidden)}): esse
      excedente já foi abatido da sobra esperada.
    </>
  );
}

/** Mês atual até hoje: reserva (guardado), sobra na conta, entrada e saída × o plano da IA, em %. */
export function RealVsPlanCard({ a, day, hidden }: { a: ActualMonth; day: number | undefined; hidden: boolean }) {
  const r = a.reserve;
  return (
    <div className={`${s.card} ${st.rvp}`}>
      <div className={st.rvpHead}>
        <span className={s.eyebrow}>
          {cap(monthLong(a.month))} {day ? `até o dia ${day}` : 'até agora'} · real × plano da IA
        </span>
      </div>
      <div className={st.rvpGrid}>
        {r && (
          <Item
            label="Reserva (guardado)"
            real={r.real}
            plan={r.plan}
            planText="IA espera no fim do mês"
            pct={r.pct}
            pctText="do objetivo"
            good={(r.pct ?? 0) >= 100}
            hidden={hidden}
          />
        )}
        <Item
          label="Sobra na conta"
          real={a.real.balance}
          plan={a.plan.balance}
          planText="IA espera sobrar"
          pct={a.pct.balance}
          pctText="da sobra do plano"
          good={(a.pct.balance ?? 0) >= 100}
          note={a.saving && a.saving.extra > 0 ? <SavingNote sv={a.saving} hidden={hidden} /> : undefined}
          hidden={hidden}
        />
        <Item
          label="Entrou"
          real={a.real.income}
          plan={a.plan.income}
          planText="IA previa"
          pct={a.pct.income}
          pctText="do previsto"
          good={(a.pct.income ?? 0) >= 100}
          hidden={hidden}
        />
        <Item
          label="Saiu da conta"
          real={a.real.out}
          plan={a.plan.out}
          planText="Plano de gastos"
          pct={a.pct.out}
          pctText="do plano usado"
          good={(a.pct.out ?? 0) <= 100}
          hidden={hidden}
        />
      </div>
      <span className={s.small}>
        Reserva = o que tu informou como guardado. Sobra = o saldo da tua conta agora (o mesmo da tela Gastos): vai baixando ao longo do mês conforme tu gasta.
        {a.real.unexpected > 0 ? ` Imprevistos no mês: ${money(a.real.unexpected, hidden)}.` : ''} Saída sem caixinha, transferência entre contas tuas e
        crédito de empréstimo.
      </span>
    </div>
  );
}

/** Célula da tabela (meses que já passaram): valor real em destaque e o do plano + % embaixo. */
export function DualCell({ real, plan, pct, kind, hidden }: { real: number; plan: number; pct: number | null; kind: 'in' | 'out' | 'bal'; hidden: boolean }) {
  const good = kind === 'out' ? real <= plan : real >= plan;
  return (
    <span className={st.dual}>
      <b style={kind === 'in' ? undefined : { color: good ? 'var(--pos)' : 'var(--neg)' }}>{kind === 'bal' ? saldo(real, hidden) : money(real, hidden)}</b>
      <small>
        IA {kind === 'bal' ? saldo(plan, hidden) : money(plan, hidden)}
        {pct != null ? ` · ${pct}%` : ''}
      </small>
    </span>
  );
}
