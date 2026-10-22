'use client';
import { useState } from 'react';
import { post } from '@/lib/api';
import { passwordRules, passwordScore } from '@/lib/password';
import { PillButton } from '@/components/ui/PillButton';
import { TextInput } from '@/components/ui/TextInput';
import { PasswordBars } from '@/features/auth/PasswordBars';
import type { Flash } from './Perfil';
import styles from './perfil.module.css';
import { errorText } from '@/lib/errors';

/** Alterar senha: barras de força + 4 regras do design (POST /me/password). */
export function EditSenha({ onCancel, flash }: { onCancel: () => void; flash: Flash }) {
  const [cur, setCur] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const rules = passwordRules(pw, pw2);
  const ok = cur.length > 0 && rules.every((r) => r.ok);
  const type = show ? 'text' : 'password';

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!ok) return;
    setBusy(true);
    setError('');
    try {
      await post('/me/password', { currentPassword: cur, newPassword: pw });
      flash('Senha alterada. Os outros dispositivos foram desconectados.');
    } catch (err) {
      setError(errorText(err, 'Não deu para alterar a senha.'));
      setBusy(false);
    }
  }

  return (
    <form className={styles.panelBody} onSubmit={save} noValidate>
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>Alterar senha</h2>
        <p className={styles.panelSub}>Os outros dispositivos vão precisar entrar de novo.</p>
      </div>
      <div className={styles.fields}>
        <TextInput label="Senha atual" type={type} autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} />
        <TextInput label="Nova senha" type={type} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)}>
          <PasswordBars score={passwordScore(pw)} />
        </TextInput>
        <TextInput label="Confirmar nova senha" type={type} autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
        <div className={styles.rules}>
          {rules.map((r) => (
            <span key={r.label} className={`${styles.rule} ${r.ok ? styles.ruleOk : ''}`}>
              <span className={styles.ruleMark}>{r.ok ? '✓' : '·'}</span>
              {r.label}
            </span>
          ))}
        </div>
        <button type="button" className={styles.plainBtn} onClick={() => setShow((v) => !v)}>
          {show ? 'Ocultar senhas' : 'Mostrar senhas'}
        </button>
      </div>
      {error && <div className={styles.error} role="alert">{error}</div>}
      <div className={styles.actions}>
        <PillButton type="submit" size="md" disabled={!ok || busy}>
          {busy ? 'Salvando…' : 'Salvar nova senha'}
        </PillButton>
        <PillButton variant="outline" size="md" onClick={onCancel}>
          Cancelar
        </PillButton>
      </div>
    </form>
  );
}
