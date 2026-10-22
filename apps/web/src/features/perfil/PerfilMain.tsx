'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { fetcher, patch, post } from '@/lib/api';
import { money } from '@/lib/format';
import { hidePhone } from '@/lib/masks';
import { dayMonth, hhmm, monthShort } from '@/lib/months';
import type { User } from '@/lib/session';
import { AUTH_ROUTES } from '@/lib/routes';
import { Switch } from '@/components/ui/Switch';
import { enableFaceOnThisDevice, saveDeviceUser } from '@/features/auth/deviceUser';
import type { Flash, View } from './Perfil';
import { AiUsageCard } from './AiUsageCard';
import styles from './perfil.module.css';
import { errorText } from '@/lib/errors';

type Account = { id: string; bank: string; label: string; balance: number | null; lastSyncAt: string | null };
type Import = {
  id: string;
  kind: string;
  status: string;
  fileName: string;
  count: number;
  periodStart: string | null;
  periodEnd: string | null;
  error: string | null;
  createdAt?: string;
};
type Payslip = { id: string; month: string; net: number };
type Settings = Pick<User, 'faceEnabled' | 'privacyMode' | 'notifications'>;

const TOGGLES: { k: keyof Settings; title: string; sub: string }[] = [
  { k: 'faceEnabled', title: 'Entrar com reconhecimento facial', sub: 'Substitui a senha neste dispositivo' },
  { k: 'privacyMode', title: 'Ocultar valores ao abrir', sub: 'Mostra R$ ••• até tu tocar' },
  { k: 'notifications', title: 'Avisos da IA', sub: 'Quando uma categoria passar do limite' },
];

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
/** "Itaú · ag. 0001" já contém o banco ("itau"); evita "itau · Itaú…". */
const accountTitle = (a: Account) => (norm(a.label).includes(norm(a.bank)) ? a.label : `${a.bank} · ${a.label}`);
const bankShort = (bank: string) => bank.replace(/[^A-Za-zÀ-ú0-9]/g, '').slice(0, 2).toUpperCase();

/** "Chrome · macOS" a partir do user agent (só rótulo). */
function deviceLabel(ua: string) {
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Navegador';
  const os = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : '';
  return os ? `${browser} · ${os}` : browser;
}

export function PerfilMain({ user, go, flash }: { user: User; go: (v: View) => void; flash: Flash }) {
  const { mutate } = useSWR<User>('/auth/me', fetcher);
  const accounts = useSWR<Account[]>('/accounts', fetcher);
  const imports = useSWR<Import[]>('/imports', fetcher);
  const payslip = useSWR<Payslip | null>('/payslips/latest', fetcher);
  const [saving, setSaving] = useState<keyof Settings | null>(null);
  const [uploading, setUploading] = useState<'holerite' | 'extrato' | null>(null);
  const [device, setDevice] = useState('Este navegador');
  const holeriteInput = useRef<HTMLInputElement>(null);
  const extratoInput = useRef<HTMLInputElement>(null);
  const hidden = user.privacyMode;

  useEffect(() => setDevice(deviceLabel(navigator.userAgent)), []);

  async function flip(k: keyof Settings) {
    const next = !user[k];
    setSaving(k);
    await mutate({ ...user, [k]: next }, false); // otimista
    try {
      // ligar o rosto também lembra este aparelho (é ele que entra sem senha)
      const updated =
        k === 'faceEnabled' && next ? await enableFaceOnThisDevice() : await patch<User>('/me/settings', { [k]: next });
      await mutate(updated, false);
      saveDeviceUser(updated);
    } catch (e) {
      await mutate(user, false);
      flash(errorText(e, 'Não deu para salvar.'), 'err');
    } finally {
      setSaving(null);
    }
  }

  async function upload(kind: 'holerite' | 'extrato', file?: File | null) {
    if (!file) return;
    setUploading(kind);
    try {
      const body = new FormData();
      body.append('file', file);
      await post(`/imports/${kind}`, body);
      await Promise.all([imports.mutate(), payslip.mutate(), accounts.mutate(), mutate()]);
      flash(kind === 'holerite' ? 'Holerite enviado e lido pela IA' : 'Extrato importado');
    } catch (e) {
      flash(errorText(e, 'Não deu para ler o arquivo.'), 'err');
    } finally {
      setUploading(null);
    }
  }

  const ps = payslip.data;
  const net = ps?.net ?? user.netIncome;
  const personal: { k: string; v: string; go?: View }[] = [
    { k: 'E-mail', v: user.email, go: 'email' },
    { k: 'Senha', v: '••••••••', go: 'senha' },
    { k: 'Celular', v: user.phone ? hidePhone(user.phone) : 'Não informado', go: 'dados' },
    { k: 'CPF', v: user.cpfMasked },
    {
      k: 'Renda líquida',
      v: net != null ? `${money(net, hidden)}${ps ? ` · holerite ${monthShort(ps.month)}` : ''}` : 'Envia o holerite',
    },
  ];

  const lastExtrato = imports.data?.find((i) => /extrato/i.test(i.kind));
  const lastHolerite = imports.data?.find((i) => /holerite/i.test(i.kind));
  const extratoFailed = lastExtrato && /fail|err/i.test(lastExtrato.status);

  return (
    <>
      <div className={styles.cols}>
        {/* conta e segurança */}
        <div className={styles.col}>
          <section className={`${styles.glass} ${styles.card}`}>
            <div className={styles.cardHead}>
              <span className={styles.eyebrow}>Conta e dados pessoais</span>
              <button type="button" className={styles.link} onClick={() => go('dados')}>
                Editar
              </button>
            </div>
            {personal.map((p) => (
              <div key={p.k} className={styles.row}>
                <span className={styles.rowKey}>{p.k}</span>
                <span className={styles.rowVal} title={p.v}>
                  {p.v}
                </span>
                <button
                  type="button"
                  className={`${styles.link} ${styles.rowAct} ${p.go ? '' : styles.rowActHidden}`}
                  onClick={() => p.go && go(p.go)}
                  tabIndex={p.go ? undefined : -1}
                  aria-hidden={!p.go || undefined}
                >
                  Alterar
                </button>
              </div>
            ))}
          </section>

          <section className={`${styles.glass} ${styles.card}`}>
            <div className={`${styles.eyebrow} ${styles.cardHead}`}>Segurança e privacidade</div>
            {TOGGLES.map((t) => (
              <button
                key={t.k}
                type="button"
                role="switch"
                aria-checked={user[t.k]}
                className={styles.toggle}
                disabled={saving === t.k}
                onClick={() => flip(t.k)}
              >
                <span className={styles.toggleText}>
                  <span className={styles.toggleTitle}>{t.title}</span>
                  <span className={styles.toggleSub}>{t.sub}</span>
                </span>
                <Switch on={user[t.k]} />
              </button>
            ))}
            <div className={styles.btnRow}>
              <Link href={`${AUTH_ROUTES.facial}?modo=recadastrar`} className={`${styles.chipBtn} ${styles.chipLg}`}>
                Recadastrar rosto
              </Link>
              <button type="button" className={`${styles.chipBtn} ${styles.chipLg}`} onClick={() => go('senha')}>
                Alterar senha
              </button>
            </div>
          </section>
        </div>
        {/* dados, IA e aparelhos */}
        <div className={styles.col}>
          <AiUsageCard hidden={hidden} />

          <section className={`${styles.glass} ${styles.card}`}>
            <div className={styles.cardHead}>
              <span className={styles.eyebrow}>Fontes de dados</span>
              <Link href="/bancos" className={styles.link}>
                + Adicionar
              </Link>
            </div>
            {accounts.data?.map((a) => (
              <div key={a.id} className={styles.src}>
                <span className={styles.srcIcon}>{bankShort(a.label || a.bank)}</span>
                <span className={styles.srcText}>
                  <span className={styles.srcTitle}>
                    {accountTitle(a)}
                  </span>
                  <span className={styles.srcSub}>
                    <span className={`${styles.dot} ${a.lastSyncAt ? '' : styles.dotOff}`} />
                    {a.lastSyncAt ? `Sincronizado ${hhmm(a.lastSyncAt) || dayMonth(a.lastSyncAt)}` : 'Ainda sem lançamentos'}
                  </span>
                </span>
                <Link href="/bancos" className={styles.chipBtn}>
                  Gerenciar
                </Link>
              </div>
            ))}
            <div className={styles.src}>
              <span className={styles.srcIcon}>H</span>
              <span className={styles.srcText}>
                <span className={styles.srcTitle}>{ps ? `Holerite ${monthShort(ps.month)}` : 'Holerite'}</span>
                <span className={styles.srcSub}>
                  <span className={`${styles.dot} ${ps ? '' : styles.dotOff}`} />
                  {ps
                    ? lastHolerite?.createdAt
                      ? `Enviado em ${dayMonth(lastHolerite.createdAt)}`
                      : 'Lido pela IA'
                    : 'Nenhum enviado ainda'}
                </span>
              </span>
              <button type="button" className={styles.chipBtn} disabled={!!uploading} onClick={() => holeriteInput.current?.click()}>
                {uploading === 'holerite' ? 'Lendo…' : ps ? 'Enviar novo' : 'Enviar'}
              </button>
              <input
                ref={holeriteInput}
                type="file"
                accept=".pdf,image/*"
                className={styles.hiddenFile}
                onChange={(e) => {
                  upload('holerite', e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </div>
            <div className={styles.src}>
              <span className={styles.srcIcon}>E</span>
              <span className={styles.srcText}>
                <span className={styles.srcTitle}>{lastExtrato ? `Extrato · ${lastExtrato.fileName}` : 'Extrato bancário'}</span>
                <span className={styles.srcSub}>
                  <span className={`${styles.dot} ${extratoFailed ? styles.dotErr : lastExtrato ? '' : styles.dotOff}`} />
                  {!lastExtrato
                    ? 'Nenhum enviado ainda'
                    : extratoFailed
                      ? lastExtrato.error || 'Falhou ao ler'
                      : lastExtrato.periodEnd
                        ? `Até ${dayMonth(lastExtrato.periodEnd)} · ${lastExtrato.count} lançamentos`
                        : `${lastExtrato.count} lançamentos`}
                </span>
              </span>
              <button type="button" className={styles.chipBtn} disabled={!!uploading} onClick={() => extratoInput.current?.click()}>
                {uploading === 'extrato' ? 'Lendo…' : lastExtrato ? 'Enviar novo' : 'Enviar'}
              </button>
              <input
                ref={extratoInput}
                type="file"
                accept=".pdf,.ofx,.csv,.json"
                className={styles.hiddenFile}
                onChange={(e) => {
                  upload('extrato', e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </div>
          </section>

          <section className={`${styles.glass} ${styles.card}`}>
            <div className={`${styles.eyebrow} ${styles.cardHead}`}>Dispositivos com acesso</div>
            <div className={styles.device}>
              <span className={styles.deviceText}>
                <span className={styles.toggleTitle}>{device}</span>
                <span className={styles.toggleSub}>{user.faceEnabled ? 'Rosto ativado · agora' : 'Sessão atual · agora'}</span>
              </span>
              <span className={styles.deviceTag}>Este</span>
            </div>
          </section>
        </div>
      </div>

      <section className={styles.dangerZone}>
        <span className={styles.dangerText}>
          <span className={styles.toggleTitle}>Excluir conta</span>
          <span className={styles.toggleSub}>Apaga teus dados, extratos e holerites do Saldim.</span>
        </span>
        <button
          type="button"
          className={styles.dangerBtn}
          onClick={() => flash('Para excluir a conta, fala com o suporte — a exclusão pelo app ainda não está disponível.', 'err')}
        >
          Excluir minha conta
        </button>
      </section>
    </>
  );
}
