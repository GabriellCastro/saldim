'use client';
import { useState } from 'react';
import { mutate } from 'swr';
import { post } from '@/lib/api';
import type { User } from '@/lib/session';
import { isEmail, maskCpfInput, maskPhoneInput } from '@/lib/masks';
import { passwordRules, signupScore } from '@/lib/password';
import { PillButton } from '@/components/ui/PillButton';
import { TextInput } from '@/components/ui/TextInput';
import { PasswordBars } from './PasswordBars';
import { saveDeviceUser } from './deviceUser';
import styles from './auth.module.css';
import { errorText } from '@/lib/errors';

type Form = { name: string; cpf: string; phone: string; email: string; password: string };

function validate(f: Form, terms: boolean): string | null {
  if (!f.name.trim()) return 'Informa teu nome completo.';
  if (f.cpf.replace(/\D/g, '').length !== 11) return 'CPF precisa ter 11 dígitos.';
  if (f.phone.replace(/\D/g, '').length < 10) return 'Celular incompleto.';
  if (!isEmail(f.email)) return 'E-mail inválido.';
  const missing = passwordRules(f.password).filter((r) => !r.ok);
  if (missing.length) return `Senha fraca: falta ${missing.map((r) => r.label.toLowerCase()).join(', ')}.`;
  if (!terms) return 'Aceita os termos para continuar.';
  return null;
}

/** Etapa 1 · Conta. Cria a conta (cookie de sessão vem na resposta). */
export function StepAccount({
  created,
  onCreated,
  onNext,
}: {
  created: User | null;
  onCreated: (u: User) => void;
  onNext: () => void;
}) {
  const [f, setF] = useState<Form>({ name: '', cpf: '', phone: '', email: '', password: '' });
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof Form, mask?: (v: string) => string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF((s) => ({ ...s, [k]: mask ? mask(e.target.value) : e.target.value }));

  if (created)
    return (
      <section className={styles.sectionTight}>
        <div className={styles.head}>
          <h2 className={styles.titleSm}>Conta criada</h2>
          <p className={styles.sub}>
            Tu já entrou como <b>{created.email}</b>. Dados pessoais dá para mudar depois no perfil.
          </p>
        </div>
        <PillButton block onClick={onNext}>
          Continuar
        </PillButton>
      </section>
    );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const problem = validate(f, terms);
    setError(problem ?? '');
    if (problem) return;
    setBusy(true);
    try {
      const { user } = await post<{ user: User }>('/auth/register', {
        name: f.name.trim(),
        cpf: f.cpf,
        phone: f.phone,
        email: f.email.trim(),
        password: f.password,
      });
      saveDeviceUser(user);
      await mutate('/auth/me', user, { revalidate: false });
      onCreated(user);
    } catch (err) {
      setError(errorText(err, 'Não deu para criar a conta agora.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.sectionTight} onSubmit={submit} noValidate>
      <div className={styles.head}>
        <h2 className={styles.titleSm}>Criar tua conta</h2>
        <p className={styles.sub}>Leva uns 3 minutos com os documentos em mãos.</p>
      </div>
      <div className={styles.fields}>
        <TextInput label="Nome completo" autoComplete="name" placeholder="Como está no documento" value={f.name} onChange={set('name')} />
        <div className={styles.twoCols}>
          <TextInput label="CPF" inputMode="numeric" placeholder="000.000.000-00" value={f.cpf} onChange={set('cpf', maskCpfInput)} />
          <TextInput label="Celular" inputMode="tel" autoComplete="tel" placeholder="(00) 00000-0000" value={f.phone} onChange={set('phone', maskPhoneInput)} />
        </div>
        <TextInput label="E-mail" type="email" autoComplete="email" placeholder="voce@email.com" value={f.email} onChange={set('email')} />
        <TextInput
          label="Senha"
          type="password"
          autoComplete="new-password"
          placeholder="Mínimo 8 caracteres"
          value={f.password}
          onChange={set('password')}
        >
          <PasswordBars score={signupScore(f.password)} />
        </TextInput>
        <button type="button" className={styles.terms} role="checkbox" aria-checked={terms} onClick={() => setTerms((v) => !v)}>
          <span className={`${styles.check} ${terms ? styles.checkOn : ''}`}>{terms ? '✓' : ''}</span>
          <span>
            Li e aceito os <a href="#" onClick={(e) => e.stopPropagation()}>Termos de uso</a> e a{' '}
            <a href="#" onClick={(e) => e.stopPropagation()}>Política de privacidade</a>.
          </span>
        </button>
      </div>
      {error && <div className={styles.formError} role="alert">{error}</div>}
      <PillButton type="submit" block disabled={busy}>
        {busy ? 'Criando conta…' : 'Continuar'}
      </PillButton>
    </form>
  );
}
