'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { mutate } from 'swr';
import { post } from '@/lib/api';
import type { User } from '@/lib/session';
import { AUTH_ROUTES } from '@/lib/routes';
import { PillButton } from '@/components/ui/PillButton';
import { TextInput } from '@/components/ui/TextInput';
import { FaceIdIcon } from './icons';
import { readDeviceUser, safeNext, saveDeviceUser, type DeviceUser } from './deviceUser';
import styles from './auth.module.css';
import { errorText } from '@/lib/errors';

/** `signup`: mostra "Criar conta" (cadastro aberto, ver lib/registration). */
export function LoginForm({ signup }: { signup: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get('next'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [device, setDevice] = useState<DeviceUser | null>(null);

  // só no cliente: quem já entrou neste dispositivo
  useEffect(() => setDevice(readDeviceUser()), []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) return setError('Preenche e-mail e senha.');
    setBusy(true);
    try {
      const { user } = await post<{ user: User }>('/auth/login', { email, password });
      saveDeviceUser(user);
      // rosto ativo na conta: este aparelho passa a entrar pelo rosto da próxima vez
      if (user.faceEnabled) await post('/auth/device').catch(() => undefined);
      await mutate('/auth/me', user, { revalidate: false });
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(errorText(err, 'Não deu para entrar agora.'));
      setBusy(false);
    }
  }

  return (
    <form className={styles.section} onSubmit={submit} noValidate>
      <div className={styles.head}>
        <div className={styles.eyebrow}>Entrar</div>
        <h2 className={styles.title}>Bom te ver de novo</h2>
      </div>

      {device?.faceEnabled && (
        <>
          <Link href={`${AUTH_ROUTES.facial}?next=${encodeURIComponent(next)}`} className={styles.faceBtn}>
            <span className={styles.faceIcon}>
              <FaceIdIcon />
            </span>
            <span className={styles.faceText}>
              <span className={styles.faceTitle}>Entrar com reconhecimento facial</span>
              <span className={styles.faceSub}>{device.name} · neste dispositivo</span>
            </span>
            <span className={styles.chev}>›</span>
          </Link>
          <div className={styles.divider}>ou com e-mail</div>
        </>
      )}

      <div className={styles.fields}>
        <TextInput
          label="E-mail"
          type="email"
          autoComplete="email"
          placeholder="voce@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextInput
          label="Senha"
          labelAside={
            <button type="button" className={styles.smallLink} onClick={() => setInfo('Recuperação de senha ainda não está disponível. Fala com o suporte.')}>
              Esqueci a senha
            </button>
          }
          type={showPw ? 'text' : 'password'}
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          adornment={
            <button type="button" className={styles.inlineBtn} onClick={() => setShowPw((v) => !v)}>
              {showPw ? 'Ocultar' : 'Mostrar'}
            </button>
          }
        />
      </div>

      {error && <div className={styles.formError} role="alert">{error}</div>}
      {info && !error && <div className={styles.formInfo}>{info}</div>}

      <div className={styles.actions}>
        <PillButton type="submit" block disabled={busy}>
          {busy ? 'Entrando…' : 'Entrar'}
        </PillButton>
        {signup && (
          <div className={styles.center}>
            Ainda não tem conta?{' '}
            <Link href={AUTH_ROUTES.registro} className={styles.textBtn}>
              Criar conta
            </Link>
          </div>
        )}
      </div>
    </form>
  );
}
