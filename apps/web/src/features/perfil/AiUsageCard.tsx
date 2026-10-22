'use client';
import Link from 'next/link';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { money } from '@/lib/format';
import { monthLong } from '@/lib/months';
import styles from './perfil.module.css';

type AiUsage = { usd: number; brl: number; replies: number; tokens: number };
type Usage = { month: string; thisMonth: AiUsage; total: AiUsage; usdBrl: number; model: string | null };

const usdFmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const intFmt = new Intl.NumberFormat('pt-BR');
const usd = (v: number, hidden: boolean) => (hidden ? 'US$ ••••' : `US$ ${usdFmt.format(v)}`);
const replies = (n: number) => `${intFmt.format(n)} ${n === 1 ? 'resposta' : 'respostas'}`;

/** "Uso da IA": quanto as respostas do Claude custaram no mês e desde o começo (GET /assistant/usage). */
export function AiUsageCard({ hidden }: { hidden: boolean }) {
  const { data, error } = useSWR<Usage>('/assistant/usage', fetcher);

  return (
    <section className={`${styles.glass} ${styles.card}`}>
      <div className={styles.cardHead}>
        <span className={styles.eyebrow}>Uso da IA</span>
        <Link href="/assistente" className={styles.link}>
          Abrir assistente
        </Link>
      </div>
      {error ? (
        <span className={styles.toggleSub}>Não deu pra carregar o uso agora.</span>
      ) : !data ? (
        <span className={styles.toggleSub}>Carregando…</span>
      ) : (
        <>
          <div className={styles.aiTop}>
            <span className={styles.aiBig}>{money(data.thisMonth.brl, hidden)}</span>
            <span className={styles.aiUsd}>{usd(data.thisMonth.usd, hidden)}</span>
          </div>
          <span className={styles.toggleSub}>
            Em {monthLong(data.month)} · {replies(data.thisMonth.replies)} · {intFmt.format(data.thisMonth.tokens)} tokens
          </span>
          <div className={styles.aiRow}>
            <span className={styles.toggleSub}>Desde o começo</span>
            <span className={styles.aiRowVal}>
              {money(data.total.brl, hidden)} <span className={styles.aiUsd}>· {replies(data.total.replies)}</span>
            </span>
          </div>
          <span className={styles.aiNote}>
            {data.model
              ? `Modelo ${data.model} · US$ 1 = ${money(data.usdBrl)} (cotação fixa do app). Respostas automáticas por regras não custam nada.`
              : 'IA desligada neste servidor (sem chave da Anthropic): as respostas vêm das regras do app e não custam nada.'}
          </span>
        </>
      )}
    </section>
  );
}
