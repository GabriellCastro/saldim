'use client';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import useSWR from 'swr';
import { ApiError, api, fetcher, post } from '@/lib/api';
import { errorText } from '@/lib/errors';
import { ddmm, money } from '@/lib/format';
import { hhmm } from '@/lib/months';
import styles from './Bancos.module.css';

// o widget usa window: só no cliente
const PluggyConnect = dynamic(() => import('react-pluggy-connect').then((m) => m.PluggyConnect), { ssr: false });

type Connection = {
  id: string;
  itemId: string;
  connector: string;
  imageUrl: string | null;
  status: string;
  error: string | null;
  lastSyncAt: string | null;
  accounts: { id: string; label: string; balance: number | null }[];
};
type Widget = { token: string; updateItem?: string } | null;

/** Item precisa que o usuário entre de novo no banco (senha trocada, consentimento vencido…). */
const NEEDS_LOGIN = new Set(['LOGIN_ERROR', 'OUTDATED', 'WAITING_USER_ACTION', 'WAITING_USER_INPUT']);

/**
 * Open Finance via Pluggy: abre o widget, autoriza o banco (só leitura) e a API puxa saldo e lançamentos.
 * `onChanged` revalida as telas que dependem de lançamentos.
 */
export function OpenFinanceCard({ hidden, onChanged }: { hidden: boolean; onChanged: () => void }) {
  const conns = useSWR<Connection[]>('/open-finance/connections', fetcher);
  const [widget, setWidget] = useState<Widget>(null);
  const [busy, setBusy] = useState<string | null>(null); // 'open' | id da conexão
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  async function openWidget(conn?: Connection, allowDuplicate = false) {
    if (!allowDuplicate) setMsg(null);
    setBusy(conn?.id ?? 'open');
    try {
      const body = conn ? { itemId: conn.itemId } : allowDuplicate ? { allowDuplicate } : {};
      const { accessToken } = await post<{ accessToken: string }>('/open-finance/connect-token', body);
      setWidget({ token: accessToken, updateItem: conn?.itemId });
    } catch (e) {
      setMsg({
        tone: 'err',
        text: e instanceof ApiError && e.status === 503 ? 'O Open Finance não está configurado neste servidor.' : errorText(e, 'Não deu pra abrir a conexão agora.'),
      });
    } finally {
      setBusy(null);
    }
  }

  async function connected(itemId: string) {
    setWidget(null);
    setBusy('open');
    setMsg({ tone: 'ok', text: 'Banco autorizado. Puxando saldo e lançamentos…' });
    try {
      const r = await post<{ imported: number; accounts: number }>('/open-finance/connections', { itemId });
      setMsg({ tone: 'ok', text: syncText(r) });
      await conns.mutate();
      onChanged();
    } catch (e) {
      setMsg({ tone: 'err', text: errorText(e, 'Autorizou, mas não deu pra puxar os dados. Tenta “Atualizar” daqui a pouco.') });
    } finally {
      setBusy(null);
    }
  }

  async function sync(c: Connection) {
    setMsg(null);
    setBusy(c.id);
    try {
      const r = await post<{ imported: number; accounts: number }>(`/open-finance/connections/${c.id}/sync`);
      setMsg({ tone: 'ok', text: syncText(r) });
      await conns.mutate();
      onChanged();
    } catch (e) {
      setMsg({ tone: 'err', text: errorText(e, 'Não deu pra atualizar agora.') });
    } finally {
      setBusy(null);
    }
  }

  async function disconnect(c: Connection) {
    if (!window.confirm(`Desconectar ${c.connector}? Os lançamentos que já vieram continuam no Saldim.`)) return;
    setBusy(c.id);
    try {
      await api(`/open-finance/connections/${c.id}`, { method: 'DELETE' });
      await conns.mutate();
      onChanged();
    } catch (e) {
      setMsg({ tone: 'err', text: errorText(e, 'Não deu pra desconectar agora.') });
    } finally {
      setBusy(null);
    }
  }

  const notConfigured = conns.error instanceof ApiError && conns.error.status === 503;

  return (
    <section className={`${styles.card} ${styles.of}`} aria-label="Open Finance">
      <div className={styles.ofHead}>
        <div className={styles.intro}>
          <span className={styles.ofTag}>
            <span className={styles.ofDot} />
            Open Finance · regulado pelo Banco Central
          </span>
          <h2 className={styles.title}>Conecta teu banco e os lançamentos entram sozinhos</h2>
          <p className={styles.body}>
            Tu autoriza no app do banco, só leitura. O Saldim vê saldo e lançamentos, nunca movimenta dinheiro. Conexão feita
            pela Pluggy.
          </p>
        </div>
        <button type="button" className={styles.gold} disabled={!!busy || notConfigured} onClick={() => void openWidget()}>
          {busy === 'open' ? 'Conectando…' : '+ Conectar banco'}
        </button>
      </div>

      {msg && (
        <div className={msg.tone === 'ok' ? styles.ofOk : styles.ofErr} role={msg.tone === 'err' ? 'alert' : 'status'}>
          {msg.text}
        </div>
      )}

      {conns.data?.map((c) => {
        const relogin = NEEDS_LOGIN.has(c.status);
        return (
          <div key={c.id} className={styles.ofRow}>
            {c.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.imageUrl} alt="" className={styles.ofLogo} />
            ) : (
              <span className={styles.ofLogo}>{c.connector.slice(0, 2)}</span>
            )}
            <div className={styles.sourceName}>
              <span>{c.connector}</span>
              <span className={styles.sub}>
                {c.accounts.map((a) => `${a.label.replace(`${c.connector} · `, '')}${a.balance != null ? ` · ${money(a.balance, hidden)}` : ''}`).join(' — ') ||
                  'Sem conta corrente nessa conexão'}
              </span>
              <span className={relogin ? styles.bad : c.status === 'UPDATING' ? styles.mu : styles.ok}>
                {relogin
                  ? 'Precisa reconectar'
                  : c.status === 'UPDATING'
                    ? 'Banco ainda enviando dados…'
                    : c.lastSyncAt
                      ? `Conectado · atualizado ${ddmm(c.lastSyncAt)} ${hhmm(c.lastSyncAt)}`
                      : 'Conectado'}
              </span>
            </div>
            <div className={styles.ofActions}>
              {relogin ? (
                <button type="button" className={styles.outline} disabled={!!busy} onClick={() => void openWidget(c)}>
                  Reconectar
                </button>
              ) : (
                <button type="button" className={styles.outline} disabled={!!busy} onClick={() => void sync(c)}>
                  {busy === c.id ? 'Atualizando…' : 'Atualizar'}
                </button>
              )}
              <button type="button" className={styles.ofLink} disabled={!!busy} onClick={() => void disconnect(c)}>
                Desconectar
              </button>
            </div>
          </div>
        );
      })}

      {notConfigured && <span className={styles.mu}>Faltam PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET na API.</span>}

      {/* portal: o backdrop-filter do card prenderia o modal (position: fixed) dentro dele */}
      {widget &&
        createPortal(
        <PluggyConnect
          connectToken={widget.token}
          updateItem={widget.updateItem}
          includeSandbox={process.env.NODE_ENV !== 'production'}
          countries={['BR']}
          onSuccess={({ item }) => void connected(item.id)}
          onError={(e) => {
            setWidget(null);
            // avoidDuplicates: o banco já está conectado na Pluggy (ex.: o registro anterior não chegou aqui) → adota o item existente
            const existing = e.data?.item?.id;
            if (e.message?.includes('ITEM_USER_ALREADY_EXISTS')) {
              if (existing) return void connected(existing);
              // o item antigo existe na Pluggy mas nunca foi registrado aqui (e não dá pra achar o id): conecta de novo
              setMsg({ tone: 'ok', text: 'Essa conexão tinha ficado pela metade. Entra no banco mais uma vez pra terminar.' });
              return void openWidget(undefined, true);
            }
            setMsg({ tone: 'err', text: widgetError(e.message) });
          }}
          onClose={() => setWidget(null)}
        />,
          document.body,
        )}
    </section>
  );
}

/** Erros do widget com explicação; o resto passa como veio. */
function widgetError(message?: string): string {
  if (message?.includes('TRIAL_CLIENT_ITEM_CREATE_NOT_ALLOWED'))
    return 'A conta Pluggy deste app está em teste e não deixa conectar banco direto. Conecta teus bancos no Meu Pluggy (meu.pluggy.ai) e escolhe a opção “MeuPluggy” aqui no conectar.';
  return message || 'A conexão com o banco falhou.';
}

const syncText = (r: { imported: number; accounts: number }) =>
  r.imported
    ? `Pronto: ${r.imported} ${r.imported === 1 ? 'lançamento novo' : 'lançamentos novos'}.`
    : r.accounts
      ? 'Tudo em dia: nenhum lançamento novo.'
      : 'Conectado, mas o banco ainda não mandou contas. Tenta “Atualizar” em alguns minutos.';
