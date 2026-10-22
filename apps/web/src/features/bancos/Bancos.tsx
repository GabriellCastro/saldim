'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { fetcher, post } from '@/lib/api';
import { ddmm, money } from '@/lib/format';
import { useUser } from '@/lib/session';
import { Eyebrow } from '@/components/ui';
import { LoadError, Skeleton } from '@/components/ui/ScreenState';
import { monthShort } from '@/features/holerite/month';
import { OpenFinanceCard } from './OpenFinanceCard';
import styles from './Bancos.module.css';

type Account = { id: string; bank: string; label: string; balance: number | null; lastSyncAt: string | null };
export type Import = {
  id: string;
  kind: string;
  status: string;
  fileName: string;
  count: number;
  periodStart: string | null;
  periodEnd: string | null;
  error: string | null;
  createdAt?: string;
  /** não está no contrato; exibido se a API mandar */
  duplicates?: number;
  skipped?: number;
};

type Upload =
  | { st: 'idle' }
  | { st: 'busy'; name: string; p: number }
  | { st: 'done'; imp: Import }
  | { st: 'error'; name: string; message: string };

const STEPS = ['Arquivo', 'Leitura', 'Categorias', 'Pronto'];
const ACCEPT = '.ofx,.csv,.pdf,.json';
/** Chaves SWR que dependem de lançamentos: revalidadas após importar. */
const AFFECTED = ['/goals', '/dashboard', '/transactions', '/accounts', '/budgets', '/imports', '/assistant'];

const period = (i: Import) =>
  i.periodStart && i.periodEnd ? `${ddmm(i.periodStart)} a ${ddmm(i.periodEnd)}/${i.periodEnd.slice(2, 4)}` : '—';
const failed = (i: Import) => /fail|error|erro/i.test(i.status) || !!i.error;
const dupsOf = (i: Import) => i.duplicates ?? i.skipped;

export function Bancos() {
  const { hidden } = useUser();
  const { mutate } = useSWRConfig();
  const accounts = useSWR<Account[]>('/accounts', fetcher);
  const imports = useSWR<Import[]>('/imports', fetcher);
  const payslip = useSWR<{ month: string } | null>('/payslips/latest', fetcher);
  const [up, setUp] = useState<Upload>({ st: 'idle' });
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Progresso "andando" enquanto a API processa (o servidor não reporta etapas).
  const busy = up.st === 'busy';
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(
      () => setUp((u) => (u.st === 'busy' ? { ...u, p: Math.min(92, u.p + 4 + Math.random() * 7) } : u)),
      180,
    );
    return () => clearInterval(t);
  }, [busy]);

  async function start(file: File | undefined) {
    if (!file || busy) return;
    setDrag(false);
    setUp({ st: 'busy', name: file.name, p: 0 });
    const fd = new FormData();
    fd.append('file', file);
    try {
      const imp = await post<Import>('/imports/extrato', fd);
      if (failed(imp)) setUp({ st: 'error', name: file.name, message: imp.error ?? 'O arquivo não pôde ser importado.' });
      else setUp({ st: 'done', imp });
      void mutate((k) => typeof k === 'string' && AFFECTED.some((p) => k.startsWith(p)));
    } catch (e) {
      setUp({ st: 'error', name: file.name, message: e instanceof Error ? e.message : 'Falha ao enviar o arquivo.' });
      void imports.mutate(); // a API registra a tentativa que falhou
    }
  }

  const stepIdx = up.st === 'idle' ? 0 : up.st === 'busy' ? (up.p < 40 ? 1 : 2) : up.st === 'done' ? 3 : 1;
  const stage = up.st === 'busy' ? (up.p < 40 ? 'Lendo arquivo…' : up.p < 80 ? 'IA separando por categoria…' : 'Conferindo duplicados…') : '';
  const head = {
    idle: {
      title: 'Carrega teu extrato',
      body: 'Exporta o extrato no app ou no internet banking e solta aqui. A IA separa por categoria e ignora o que já foi importado antes.',
    },
    busy: { title: 'Lendo teu extrato', body: 'Leva só alguns segundos. Pode continuar por aqui.' },
    done:
      up.st === 'done' && up.imp.count === 0
        ? { title: 'Nada novo nesse arquivo', body: 'Todos os lançamentos desse extrato já estavam aqui, então nada foi duplicado.' }
        : { title: 'Extrato importado', body: 'Pronto. Os gastos, limites e a projeção já foram atualizados com esses lançamentos.' },
    error: { title: 'Não deu pra ler esse arquivo', body: 'Confere se é o extrato exportado pelo banco (OFX, CSV, PDF do Itaú ou JSON) e tenta de novo.' },
  }[up.st];

  return (
    <div className={styles.layout}>
      <OpenFinanceCard
        hidden={hidden}
        onChanged={() => void mutate((k) => typeof k === 'string' && [...AFFECTED, '/open-finance'].some((p) => k.startsWith(p)))}
      />
      <section className={`${styles.card} ${styles.main}`} aria-label="Carregar extrato">
        <div className={styles.steps}>
          {STEPS.map((label, i) => (
            <div key={label} className={`${styles.step} ${i <= stepIdx ? styles.stepOn : ''}`}>
              <div className={styles.stepBar} />
              <div className={styles.stepText}>
                <span>0{i + 1}</span>
                <span>{label}</span>
              </div>
            </div>
          ))}
        </div>

        <div className={styles.intro}>
          <h2 className={styles.title}>{head.title}</h2>
          <p className={styles.body}>{head.body}</p>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT}
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            void start(file);
          }}
        />

        {up.st === 'idle' && (
          <label
            className={`${styles.drop} ${drag ? styles.dropOn : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              if (!drag) setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              void start(e.dataTransfer.files?.[0]);
            }}
            onClick={(e) => {
              e.preventDefault();
              fileRef.current?.click();
            }}
          >
            <span className={styles.dropTitle}>
              <span className={styles.desk}>Solta o arquivo aqui</span>
              <span className={styles.mob}>Escolher arquivo</span>
            </span>
            <span className={styles.dropSub}>
              <span className={styles.desk}>ou clica pra escolher · </span>OFX, CSV, PDF ou JSON
            </span>
          </label>
        )}

        {up.st === 'busy' && (
          <div className={styles.progress}>
            <div className={styles.progressHead}>
              <span className={styles.ellipsis}>{up.name}</span>
              <span className={styles.mu}>{Math.round(up.p)}%</span>
            </div>
            <div className={styles.track}>
              <div className={styles.fill} style={{ width: `${up.p}%` }} />
            </div>
            <span className={styles.mu}>{stage}</span>
          </div>
        )}

        {up.st === 'done' && (
          <div className={styles.table}>
            <div>
              <span className={styles.ellipsis}>{up.imp.fileName}</span>
              <span className={styles.ok}>Importado</span>
            </div>
            <div>
              <span className={styles.mu}>Lançamentos novos</span>
              <span>{up.imp.count.toLocaleString('pt-BR')}</span>
            </div>
            <div>
              <span className={styles.mu}>Período</span>
              <span>{period(up.imp)}</span>
            </div>
            {dupsOf(up.imp) != null && (
              <div>
                <span className={styles.mu}>Duplicados ignorados</span>
                <span>{dupsOf(up.imp)}</span>
              </div>
            )}
          </div>
        )}

        {up.st === 'error' && (
          <div className={`${styles.table} ${styles.tableErr}`} role="alert">
            <div>
              <span className={styles.ellipsis}>{up.name}</span>
              <span className={styles.bad}>Erro</span>
            </div>
            <div>
              <span className={styles.mu}>{up.message}</span>
            </div>
          </div>
        )}

        <div className={styles.ctas}>
          {up.st === 'done' && (
            <Link href="/gastos" className={styles.gold}>
              Ver gastos
            </Link>
          )}
          {(up.st === 'done' || up.st === 'error') && (
            <button type="button" className={styles.outline} onClick={() => setUp({ st: 'idle' })}>
              Outro arquivo
            </button>
          )}
        </div>
        <span className={styles.hint}>No app Itaú: Extrato → Exportar → escolhe o período e o formato OFX ou CSV.</span>
      </section>

      <div className={styles.side}>
        <div className={`${styles.card} ${styles.panel}`}>
          <Eyebrow className={styles.eyebrow}>Fontes</Eyebrow>
          {accounts.isLoading && <Skeleton heights={[20, 20]} />}
          {accounts.error && <LoadError onRetry={() => accounts.mutate()} />}
          {accounts.data?.length === 0 && <span className={styles.mu}>Nenhuma conta ainda. Carrega um extrato pra começar.</span>}
          {accounts.data?.map((a) => (
            <div key={a.id} className={styles.source}>
              <div className={styles.sourceName}>
                <span>{a.label || a.bank}</span>
                <span className={styles.sub}>
                  {a.balance != null ? `Saldo ${money(a.balance, hidden)}` : a.bank}
                  {a.lastSyncAt ? ` · atualizado ${ddmm(a.lastSyncAt)}` : ''}
                </span>
              </div>
              <span className={a.lastSyncAt ? styles.ok : styles.mu}>{a.lastSyncAt ? 'Conectado' : 'Sem dados'}</span>
            </div>
          ))}
          <div className={styles.source}>
            <span>Holerite</span>
            {payslip.data ? (
              <span className={styles.ok}>{monthShort(payslip.data.month)}</span>
            ) : (
              <Link href="/holerite" className={styles.mu}>
                Enviar
              </Link>
            )}
          </div>
        </div>

        <div className={`${styles.card} ${styles.panel}`}>
          <Eyebrow className={styles.eyebrow}>Importações</Eyebrow>
          {imports.isLoading && <Skeleton heights={[36, 36]} />}
          {imports.error && <LoadError onRetry={() => imports.mutate()} />}
          {imports.data?.length === 0 && <span className={styles.mu}>Nenhum arquivo importado ainda.</span>}
          {imports.data?.slice(0, 8).map((i) => (
            <div key={i.id} className={styles.source}>
              <div className={styles.sourceName}>
                <span className={styles.ellipsis}>{i.fileName}</span>
                <span className={styles.sub}>
                  {i.kind.toLowerCase() === 'holerite' ? 'Holerite' : 'Extrato'}
                  {i.createdAt ? ` · ${ddmm(i.createdAt)}` : ''}
                  {i.periodStart ? ` · ${period(i)}` : ''}
                </span>
              </div>
              {failed(i) ? (
                <span className={styles.bad} title={i.error ?? undefined}>
                  Erro
                </span>
              ) : (
                <span className={styles.ok}>{i.kind.toLowerCase() === 'holerite' ? 'Lido' : `${i.count} lanç.`}</span>
              )}
            </div>
          ))}
        </div>

        <div className={styles.note}>
          O Saldim só lê: vê saldos e lançamentos (do arquivo ou do Open Finance), mas nunca movimenta dinheiro. Lançamentos
          repetidos são ignorados, então pode carregar períodos que se sobrepõem.
        </div>
      </div>
    </div>
  );
}
