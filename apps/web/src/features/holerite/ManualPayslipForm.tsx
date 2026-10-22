'use client';
import { useState } from 'react';
import { post } from '@/lib/api';
import { Button, Field } from '@/components/ui';
import { currentMonth, addMonths } from './month';
import type { Payslip, PayslipInput, PayslipItem } from './types';
import styles from './Holerite.module.css';

type Row = { code?: string; label: string; amount: string; kind: PayslipItem['kind'] };
type Props = { reason?: string; initial: Payslip | null; onClose: () => void; onSaved: (p: Payslip) => void };

/** "1.234,56" ou "1234.56" -> 1234.56 */
const toNum = (s: string) => Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s);
const toStr = (v: number) => String(v).replace('.', ',');

const BLANK: Row[] = [
  { label: 'Salário base', amount: '', kind: 'provento' },
  { label: 'INSS', amount: '', kind: 'desconto' },
  { label: 'IRRF', amount: '', kind: 'desconto' },
];

/** Fallback quando a API não consegue ler o arquivo (422): preenche bruto, líquido e itens à mão. */
export function ManualPayslipForm({ reason, initial, onClose, onSaved }: Props) {
  const [month, setMonth] = useState(initial ? addMonths(initial.month, 1) : addMonths(currentMonth(), -1));
  const [rows, setRows] = useState<Row[]>(
    initial?.items.length
      ? initial.items.map((i) => ({ code: i.code, label: i.label, amount: toStr(Math.abs(i.amount)), kind: i.kind }))
      : BLANK,
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const items: PayslipItem[] = rows
    .filter((r) => r.label.trim() && toNum(r.amount) > 0)
    .map((r) => ({ ...(r.code ? { code: r.code } : {}), label: r.label.trim(), amount: toNum(r.amount), kind: r.kind }));
  const gross = items.filter((i) => i.kind === 'provento').reduce((s, i) => s + i.amount, 0);
  const net = gross - items.filter((i) => i.kind === 'desconto').reduce((s, i) => s + i.amount, 0);
  const round = (v: number) => Math.round(v * 100) / 100;

  const setRow = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{4}-\d{2}$/.test(month)) return setError('Escolhe a competência.');
    if (gross <= 0) return setError('Preenche pelo menos um provento com valor.');
    const body: PayslipInput = { month, gross: round(gross), net: round(net), items };
    setSaving(true);
    setError(null);
    try {
      onSaved(await post<Payslip>('/imports/holerite', body));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não deu pra salvar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Holerite manual" onClick={onClose}>
      <form className={styles.dialog} onSubmit={submit} onClick={(e) => e.stopPropagation()}>
        <div className={styles.dialogTitle}>Preencher holerite</div>
        {reason && <div className={styles.reason}>{reason}</div>}
        <Field label="Competência" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />

        <div className={styles.itemsHead}>
          <span>Item</span>
          <span>Valor (R$)</span>
          <span>Tipo</span>
          <span />
        </div>
        <div className={styles.items}>
          {rows.map((r, i) => (
            <div key={i} className={styles.itemRow}>
              <input
                className={styles.inp}
                aria-label="Descrição"
                value={r.label}
                onChange={(e) => setRow(i, { label: e.target.value })}
                placeholder="Descrição"
              />
              <input
                className={styles.inp}
                aria-label="Valor"
                inputMode="decimal"
                value={r.amount}
                onChange={(e) => setRow(i, { amount: e.target.value })}
                placeholder="0,00"
              />
              <select
                className={styles.inp}
                aria-label="Tipo"
                value={r.kind}
                onChange={(e) => setRow(i, { kind: e.target.value as Row['kind'] })}
              >
                <option value="provento">Provento</option>
                <option value="desconto">Desconto</option>
              </select>
              <button type="button" className={styles.remove} aria-label="Remover item" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>
                ×
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          className={styles.link}
          onClick={() => setRows((rs) => [...rs, { label: '', amount: '', kind: 'desconto' }])}
        >
          + Adicionar item
        </button>

        <div className={styles.totals}>
          <span>
            Bruto <b>{round(gross).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</b>
          </span>
          <span>
            Líquido <b className={styles.posTx}>{round(net).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</b>
          </span>
        </div>
        {error && <div className={styles.formError}>{error}</div>}
        <div className={styles.formActions}>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar holerite'}
          </Button>
        </div>
      </form>
    </div>
  );
}
