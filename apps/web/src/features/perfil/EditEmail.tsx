'use client';
import { useState } from 'react';
import { useSWRConfig } from 'swr';
import { post } from '@/lib/api';
import { isEmail } from '@/lib/masks';
import type { User } from '@/lib/session';
import { PillButton } from '@/components/ui/PillButton';
import { TextInput } from '@/components/ui/TextInput';
import type { Flash } from './Perfil';
import styles from './perfil.module.css';
import { errorText } from '@/lib/errors';

type RequestRes = { sent: true; devCode?: string };
const errMsg = errorText;

/** Alterar e-mail: pede código (senha atual) → confirma com 6 dígitos. */
export function EditEmail({ user, flash }: { user: User; flash: Flash }) {
  const { mutate } = useSWRConfig();
  const [step, setStep] = useState<'ask' | 'code'>('ask');
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const askOk = isEmail(newEmail) && password.length > 0;
  const codeOk = /^\d{6}$/.test(code);

  async function request() {
    setBusy(true);
    setError('');
    try {
      const res = await post<RequestRes>('/me/email/request', { newEmail: newEmail.trim(), password });
      setDevCode(res.devCode);
      setCode('');
      setStep('code');
      return true;
    } catch (e) {
      setError(errMsg(e, 'Não deu para enviar o código.'));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    if (!codeOk) return;
    setBusy(true);
    setError('');
    try {
      const updated = await post<User>('/me/email/confirm', { code });
      await mutate('/auth/me', updated, { revalidate: false });
      flash(`E-mail alterado para ${updated.email}`);
    } catch (err) {
      setError(errMsg(err, 'Código inválido.'));
      setBusy(false);
    }
  }

  return (
    <div className={styles.panelBody}>
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>Alterar e-mail</h2>
        <p className={styles.panelSub}>
          Atual: <b>{user.email}</b>. Vamos mandar um código para o novo endereço.
        </p>
      </div>

      {step === 'ask' ? (
        <form
          className={styles.panelBody}
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (askOk) request();
          }}
        >
          <div className={styles.fields}>
            <TextInput label="Novo e-mail" type="email" autoComplete="email" placeholder="novo@email.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            <TextInput label="Senha atual" type="password" autoComplete="current-password" placeholder="Para confirmar que é tu" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <div className={styles.error} role="alert">{error}</div>}
          <PillButton type="submit" size="md" className={styles.start} disabled={!askOk || busy}>
            {busy ? 'Enviando…' : 'Enviar código'}
          </PillButton>
        </form>
      ) : (
        <form className={styles.panelBody} noValidate onSubmit={confirm}>
          <div className={styles.codeBlock}>
            <span className={styles.codeText}>
              Digita o código de 6 dígitos enviado para <b>{newEmail}</b>.
            </span>
            {devCode && (
              <div className={styles.devHint}>
                Ambiente de desenvolvimento — teu código: <b>{devCode}</b>
              </div>
            )}
            <TextInput
              className={styles.code}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
            />
            <div className={styles.codeLinks}>
              <button
                type="button"
                className={styles.resend}
                disabled={busy}
                onClick={async () => {
                  setInfo('');
                  if (await request()) setInfo('Código reenviado.');
                }}
              >
                Reenviar código
              </button>
              <button
                type="button"
                className={styles.change}
                onClick={() => {
                  setStep('ask');
                  setError('');
                  setInfo('');
                }}
              >
                Trocar endereço
              </button>
            </div>
            {info && <span className={styles.note}>{info}</span>}
          </div>
          {error && <div className={styles.error} role="alert">{error}</div>}
          <PillButton type="submit" size="md" className={styles.start} disabled={!codeOk || busy}>
            {busy ? 'Confirmando…' : 'Confirmar novo e-mail'}
          </PillButton>
        </form>
      )}
    </div>
  );
}
