'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { mutate } from 'swr';
import { api, post } from '@/lib/api';
import type { User } from '@/lib/session';
import { AUTH_ROUTES, PERFIL } from '@/lib/routes';
import { PillButton } from '@/components/ui/PillButton';
import { FaceScan } from './FaceScan';
import { enableFaceOnThisDevice, readDeviceUser, safeNext, saveDeviceUser } from './deviceUser';
import styles from './auth.module.css';
import { errorText } from '@/lib/errors';

/** /facial (entrar com o rosto) e /facial?modo=recadastrar (vindo do perfil). */
export function FacialScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const reset = params.get('modo') === 'recadastrar';
  const next = safeNext(params.get('next'));
  const [firstName, setFirstName] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => setFirstName(readDeviceUser()?.name.split(' ')[0]), []);

  if (reset) {
    const save = async () => {
      setBusy(true);
      setError('');
      try {
        await enableFaceOnThisDevice();
        router.push(`${PERFIL}?ok=rosto`);
      } catch (e) {
        setError(errorText(e, 'Não deu para salvar.'));
        setBusy(false);
      }
    };
    return (
      <FaceScan
        mode="reset"
        altLabel="Cancelar"
        onAlt={() => router.push(PERFIL)}
        doneAction={
          <>
            {error && <div className={styles.formError}>{error}</div>}
            <PillButton block onClick={save} disabled={busy}>
              {busy ? 'Salvando…' : 'Salvar e voltar ao perfil'}
            </PillButton>
          </>
        }
      />
    );
  }

  return (
    <FaceScan
      mode="login"
      firstName={firstName}
      onBack={() => router.push(AUTH_ROUTES.login)}
      altLabel="Entrar com senha"
      onAlt={() => router.push(`${AUTH_ROUTES.login}?next=${encodeURIComponent(next)}`)}
      doneAction={<OpenPanel next={next} />}
    />
  );
}

/**
 * Fim da varredura: com sessão aberta, só segue; sem sessão, entra pelo aparelho lembrado
 * (cookie `saldim_device`). A varredura em si é ilustrativa — quem autentica é o aparelho.
 */
function OpenPanel({ next }: { next: string }) {
  const router = useRouter();
  const [state, setState] = useState<'entering' | 'ok' | 'forgotten'>('entering');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await api<User>('/auth/me');
      } catch {
        try {
          const { user } = await post<{ user: User }>('/auth/device/login');
          saveDeviceUser(user);
          await mutate('/auth/me', user, { revalidate: false });
        } catch {
          // aparelho esquecido (rosto desligado, senha trocada, 90 dias sem uso): some o atalho do login
          const d = readDeviceUser();
          if (d) saveDeviceUser({ ...d, faceEnabled: false });
          if (alive) setState('forgotten');
          return;
        }
      }
      if (!alive) return;
      setState('ok');
      router.replace(next);
      router.refresh();
    })();
    return () => {
      alive = false;
    };
  }, [next, router]);

  if (state === 'forgotten')
    return <div className={styles.formError}>Este aparelho não está mais lembrado. Entra com a senha uma vez e o rosto volta a funcionar.</div>;
  return (
    <PillButton block disabled>
      {state === 'ok' ? 'Abrindo teu painel…' : 'Entrando…'}
    </PillButton>
  );
}
