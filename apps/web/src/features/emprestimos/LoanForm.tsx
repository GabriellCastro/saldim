'use client';
import { useState } from 'react';
import { patch, post } from '@/lib/api';
import { Button, Field } from '@/components/ui';
import type { Loan, LoanInput, LoanSource } from './types';
import styles from './Emprestimos.module.css';

type Props = { loan: Loan | null; onClose: () => void; onSaved: (loan: Loan | null) => void };

/** "1.234,56" ou "1234.56" -> 1234.56 */
const toNum = (s: string) => Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s);

export function LoanForm({ loan, onClose, onSaved }: Props) {
  const [name, setName] = useState(loan?.name ?? '');
  const [source, setSource] = useState<LoanSource>(loan?.source ?? 'FOLHA');
  const [installment, setInstallment] = useState(loan ? String(loan.installment).replace('.', ',') : '');
  const [cur, setCur] = useState(loan ? String(loan.currentInstallment) : '');
  const [total, setTotal] = useState(loan ? String(loan.totalInstallments) : '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const body: LoanInput = {
      name: name.trim(),
      source,
      installment: toNum(installment),
      currentInstallment: Math.trunc(Number(cur)),
      totalInstallments: Math.trunc(Number(total)),
    };
    if (!body.name) return setError('Dá um nome pro contrato.');
    if (!(body.installment > 0)) return setError('Valor da parcela inválido.');
    if (!(body.totalInstallments > 0) || !(body.currentInstallment >= 0) || body.currentInstallment > body.totalInstallments)
      return setError('A parcela atual tem que estar entre 0 e o total de parcelas.');
    setSaving(true);
    setError(null);
    try {
      const saved = loan ? await patch<Loan>(`/loans/${loan.id}`, body) : await post<Loan>('/loans', body);
      onSaved(saved ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não deu pra salvar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={loan ? 'Editar contrato' : 'Novo contrato'} onClick={onClose}>
      <form className={styles.dialog} onSubmit={submit} onClick={(e) => e.stopPropagation()}>
        <div className={styles.dialogTitle}>{loan ? 'Editar contrato' : 'Novo contrato'}</div>
        <Field label="Nome" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Contrato 18x" autoFocus />
        <div className={styles.segment} role="radiogroup" aria-label="Onde é descontado">
          {(['FOLHA', 'CONTA'] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={source === s}
              className={source === s ? styles.segOn : ''}
              onClick={() => setSource(s)}
            >
              {s === 'FOLHA' ? 'Desconto em folha' : 'Débito na conta'}
            </button>
          ))}
        </div>
        <Field label="Parcela (R$)" inputMode="decimal" value={installment} onChange={(e) => setInstallment(e.target.value)} placeholder="270,39" />
        <div className={styles.formRow}>
          <Field label="Parcela atual" inputMode="numeric" value={cur} onChange={(e) => setCur(e.target.value)} placeholder="6" />
          <Field label="Total de parcelas" inputMode="numeric" value={total} onChange={(e) => setTotal(e.target.value)} placeholder="36" />
        </div>
        {error && <div className={styles.formError}>{error}</div>}
        <div className={styles.formActions}>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </form>
    </div>
  );
}
