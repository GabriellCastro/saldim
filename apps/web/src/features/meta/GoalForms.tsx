'use client';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { post, put } from '@/lib/api';
import { Button, Field } from '@/components/ui';
import { money } from '@/lib/format';
import { dayMonthLong } from '@/lib/months';
import { maskMoney, toField, toNum } from './money-input';
import type { GoalCurrent, GoalHistoryItem } from './types';
import { useApplyGoal } from './useGoal';
import st from './meta.module.css';

export type GoalModal = 'goal' | 'saved' | 'next' | 'history' | null;

export function Dialog({ title, onClose, onSubmit, saving, error, children }: {
  title: string; onClose: () => void; onSubmit: () => void; saving: boolean; error: string | null; children: React.ReactNode;
}) {
  // portal: o backdrop-filter do card prenderia o modal (position: fixed) dentro dele
  return createPortal(
    <div className={st.overlay} role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <form className={st.dialog} onClick={(e) => e.stopPropagation()} onSubmit={(e) => (e.preventDefault(), onSubmit())}>
        <div className={st.dialogTitle}>{title}</div>
        {children}
        {error && <div className={st.formError}>{error}</div>}
        <div className={st.formActions}>
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</Button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

function useSubmit(onClose: () => void) {
  const apply = useApplyGoal();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (check: () => string | null, req: () => Promise<GoalCurrent>) => {
    const msg = check();
    if (msg) return setError(msg);
    setSaving(true);
    setError(null);
    try {
      await apply(req());
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não deu pra salvar.');
    } finally {
      setSaving(false);
    }
  };
  return { saving, error, run };
}

export function GoalForms({ open, data, history, hidden, onClose }: {
  open: GoalModal; data: GoalCurrent; history: GoalHistoryItem[]; hidden: boolean; onClose: () => void;
}) {
  if (open === 'goal') return <GoalForm data={data} onClose={onClose} />;
  if (open === 'saved') return <SavedForm data={data} onClose={onClose} />;
  if (open === 'next') return <NextForm data={data} hidden={hidden} onClose={onClose} />;
  if (open === 'history') return <HistoryDialog items={history} hidden={hidden} onClose={onClose} />;
  return null;
}

/** "levou 4 meses" / "levou 12 dias" / "bateu no mesmo dia" */
export const tookLabel = (days: number) =>
  days === 0 ? 'bateu no mesmo dia' : days < 60 ? `levou ${days} dia${days > 1 ? 's' : ''}` : `levou ${Math.round(days / 30.4)} meses`;

function HistoryDialog({ items, hidden, onClose }: { items: GoalHistoryItem[]; hidden: boolean; onClose: () => void }) {
  return createPortal(
    <div className={st.overlay} role="dialog" aria-modal="true" aria-label="Metas batidas" onClick={onClose}>
      <div className={st.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={st.dialogTitle}>Metas batidas</div>
        {items.length === 0 ? (
          <p className={st.text}>Nenhuma ainda. Quando bater a primeira, ela fica guardada aqui com a data.</p>
        ) : (
          <ol className={st.history}>
            {items.map((h) => (
              <li key={h.id}>
                <span className={st.historyName}>
                  {h.name}
                  {h.active && <span className={st.badge}>atual</span>}
                </span>
                <b>{money(h.target, hidden)}</b>
                <span className={st.muted}>
                  {dayMonthLong(h.reachedAt)} de {h.reachedAt.slice(0, 4)} · {tookLabel(h.days)}
                </span>
              </li>
            ))}
          </ol>
        )}
        <div className={st.formActions}>
          <Button type="button" variant="ghost" onClick={onClose}>Fechar</Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function GoalForm({ data, onClose }: { data: GoalCurrent; onClose: () => void }) {
  const g = data.goal;
  const [name, setName] = useState(g?.name ?? 'Reserva de emergência');
  const [target, setTarget] = useState(g ? toField(g.target) : '');
  const { saving, error, run } = useSubmit(onClose);
  return (
    <Dialog
      title={g ? 'Editar meta' : 'Nova meta'}
      onClose={onClose}
      saving={saving}
      error={error}
      onSubmit={() =>
        run(
          () => (!name.trim() ? 'Dá um nome pra meta.' : !(toNum(target) > 0) ? 'Diz quanto tu quer juntar.' : null),
          () => put<GoalCurrent>('/goals/current', { name: name.trim(), target: toNum(target) }),
        )
      }
    >
      <Field label="Nome" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      <Field
        label="Quanto quer juntar (R$)"
        inputMode="numeric"
        value={target}
        onChange={(e) => setTarget(maskMoney(e.target.value))}
        placeholder="10.000,00"
        hint="Sem prazo: pelos teus gastos e limites eu calculo quando tu chega lá."
      />
    </Dialog>
  );
}

function SavedForm({ data, onClose }: { data: GoalCurrent; onClose: () => void }) {
  const [amount, setAmount] = useState(toField(data.saved));
  const { saving, error, run } = useSubmit(onClose);
  return (
    <Dialog
      title="Quanto tu tem guardado hoje?"
      onClose={onClose}
      saving={saving}
      error={error}
      onSubmit={() => run(() => (!amount ? 'Informa quanto tá guardado (pode ser 0,00).' : null), () => put<GoalCurrent>('/goals/saved', { amount: toNum(amount) }))}
    >
      <Field label="Guardado (R$)" inputMode="numeric" value={amount} onChange={(e) => setAmount(maskMoney(e.target.value))} hint="Soma tudo que tá separado (poupança, investimento, cofrinho). Daqui pra frente o que tu põe ou tira do cofrinho já entra sozinho." autoFocus />
    </Dialog>
  );
}

function NextForm({ data, hidden, onClose }: { data: GoalCurrent; hidden: boolean; onClose: () => void }) {
  const base = data.goal?.target ?? 0;
  const [name, setName] = useState(data.goal?.name ?? '');
  const [inc, setInc] = useState('');
  const { saving, error, run } = useSubmit(onClose);
  const n = toNum(inc);
  return (
    <Dialog
      title="Próxima meta"
      onClose={onClose}
      saving={saving}
      error={error}
      onSubmit={() =>
        run(
          () => (!(n > 0) ? 'Quanto tu quer somar?' : null),
          () => post<GoalCurrent>('/goals/current/next', { increment: n, ...(name.trim() ? { name: name.trim() } : {}) }),
        )
      }
    >
      <p className={st.text}>A atual vai pro teu histórico de metas batidas. A próxima soma em cima dela.</p>
      <Field label="Nome" value={name} onChange={(e) => setName(e.target.value)} />
      <Field label="Somar quanto (R$)" inputMode="numeric" value={inc} onChange={(e) => setInc(maskMoney(e.target.value))} placeholder="5.000,00" autoFocus />
      <div className={st.muted}>Novo alvo: <b>{money(base + (n > 0 ? n : 0), hidden)}</b></div>
    </Dialog>
  );
}
