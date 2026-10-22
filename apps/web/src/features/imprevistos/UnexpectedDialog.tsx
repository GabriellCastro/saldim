'use client';
import { useState } from 'react';
import { SelectField, TextAreaField } from '@/components/ui';
import { patch } from '@/lib/api';
import { ddmm, money } from '@/lib/format';
import { Dialog } from '@/features/meta/GoalForms';
import type { Tx } from '@/features/dashboard/types';
import { useRefreshAfterTx, useUnexpectedTypes } from './useUnexpected';
import st from './imprevistos.module.css';

const NOTE_MAX = 200;

/** Marca (ou desmarca) um gasto como imprevisto: tipo + justificativa. */
export function UnexpectedDialog({ tx, hidden, onClose }: { tx: Tx; hidden: boolean; onClose: () => void }) {
  const { data: types } = useUnexpectedTypes();
  const refresh = useRefreshAfterTx();
  const [type, setType] = useState(tx.unexpected ?? '');
  const [note, setNote] = useState(tx.unexpectedNote ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await patch(`/transactions/${tx.id}`, type ? { unexpected: type, unexpectedNote: note.trim() || null } : { unexpected: null });
      await refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não deu pra salvar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog title={tx.unexpected ? 'Imprevisto' : 'Foi um imprevisto?'} onClose={onClose} onSubmit={submit} saving={saving} error={error}>
      <div className={st.txBox}>
        <span className={st.txName}>{tx.description}</span>
        <span className={st.txMeta}>
          {ddmm(tx.date)} · {tx.categoryLabel}
        </span>
        <span className={st.txVal}>{money(Math.abs(tx.amount), hidden)}</span>
      </div>
      <SelectField label="Tipo" value={type} onChange={(e) => setType(e.target.value)} autoFocus>
        <option value="">Não é imprevisto</option>
        {types?.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </SelectField>
      {type && (
        <TextAreaField
          label="Justificativa (opcional)"
          value={note}
          maxLength={NOTE_MAX}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ex.: a moto quebrou indo pro trabalho"
          hint={`Imprevisto não entra na média nem no limite da categoria, mas sai da sobra do mês e pode empurrar a meta. ${note.length}/${NOTE_MAX}`}
        />
      )}
    </Dialog>
  );
}
