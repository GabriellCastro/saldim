'use client';
import { useState } from 'react';
import { useSWRConfig } from 'swr';
import { patch } from '@/lib/api';
import { maskPhoneInput } from '@/lib/masks';
import type { User } from '@/lib/session';
import { PillButton } from '@/components/ui/PillButton';
import { TextInput } from '@/components/ui/TextInput';
import { saveDeviceUser } from '@/features/auth/deviceUser';
import type { Flash } from './Perfil';
import styles from './perfil.module.css';
import { errorText } from '@/lib/errors';

/** Dados pessoais: nome e celular (PATCH /me). CPF só leitura. */
export function EditDados({ user, onCancel, flash }: { user: User; onCancel: () => void; flash: Flash }) {
  const { mutate } = useSWRConfig();
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError('Informa teu nome.');
    setBusy(true);
    setError('');
    try {
      const updated = await patch<User>('/me', { name: name.trim(), phone });
      await mutate('/auth/me', updated, { revalidate: false });
      saveDeviceUser(updated);
      flash('Dados atualizados');
    } catch (err) {
      setError(errorText(err, 'Não deu para salvar.'));
      setBusy(false);
    }
  }

  return (
    <form className={styles.panelBody} onSubmit={save} noValidate>
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>Dados pessoais</h2>
        <p className={styles.panelSub}>CPF não pode ser alterado. Fala com o suporte se estiver errado.</p>
      </div>
      <div className={styles.fields}>
        <TextInput label="Nome completo" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
        <TextInput label="Celular" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(maskPhoneInput(e.target.value))} />
        <TextInput label="CPF" value={user.cpfMasked} disabled />
      </div>
      {error && <div className={styles.error} role="alert">{error}</div>}
      <div className={styles.actions}>
        <PillButton type="submit" size="md" disabled={busy}>
          {busy ? 'Salvando…' : 'Salvar alterações'}
        </PillButton>
        <PillButton variant="outline" size="md" onClick={onCancel}>
          Cancelar
        </PillButton>
      </div>
    </form>
  );
}
