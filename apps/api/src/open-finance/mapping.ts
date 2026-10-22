import { normalizeDescription } from '../categorizer/categorizer';

/** Regras puras de conversão Pluggy → Saldim (testadas em mapping.spec.ts). */

export interface PluggyTxLike {
  id: string;
  date: Date;
  description: string;
  type: 'DEBIT' | 'CREDIT';
  amount: number;
  status?: 'PENDING' | 'POSTED';
}

export interface OfRow {
  externalId: string;
  date: string;
  description: string;
  amount: number;
}

/** O sinal vem do tipo: cada banco manda o número de um jeito; saída negativa, entrada positiva. */
export const signedAmount = (type: 'DEBIT' | 'CREDIT', amount: number): number =>
  type === 'DEBIT' ? -Math.abs(amount) : Math.abs(amount);

/**
 * Lançamentos postados, depois da data de corte (`cutoff`, inclusiva = já coberta por extrato importado),
 * prontos pra gravar. Pendentes ficam de fora (ainda podem mudar).
 */
export function toRows(txs: PluggyTxLike[], cutoff: string | null): OfRow[] {
  return txs
    .filter((t) => t.status !== 'PENDING')
    .map((t) => ({
      externalId: t.id,
      date: brDay(new Date(t.date)),
      description: t.description.trim() || 'Lançamento',
      amount: Math.round(signedAmount(t.type, t.amount) * 100) / 100,
    }))
    .filter((r) => !cutoff || r.date > cutoff);
}

/** Dia (YYYY-MM-DD) no fuso de Brasília: a Pluggy manda data/hora em UTC. */
export const brDay = (d: Date): string => d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

export interface FileTx {
  id: string;
  date: string;
  amount: number;
  accountId: string | null;
  description?: string;
}

/** Palavras que não identificam o estabelecimento/pessoa (prefixos de canal). */
const GENERIC = new Set(['PAY', 'PIX', 'QRS', 'TRANSF', 'PAGAMENTO', 'COMPRA', 'DEBITO', 'CREDITO', 'ENVIADO', 'RECEBIDO', 'CODE']);
const words = (d: string) =>
  normalizeDescription(d)
    .split(/[^A-Z0-9]+/)
    .filter((w) => w.length >= 2 && !GENERIC.has(w));

/**
 * "Parece o mesmo lançamento?" — usado só quando a data difere 2–3 dias. Extrato Itaú trunca o nome
 * ("PAY MULTI", "PAY JR DI") e a API mostra completo ("Multiplex Via", "Jr Distribuidora").
 */
export function sameMerchant(a: string, b: string): boolean {
  const wa = words(a);
  const wb = words(b);
  if (!wa.length || !wb.length) return false;
  const ka = wa.join('');
  const kb = wb.join('');
  const head = Math.min(4, ka.length, kb.length);
  if (head >= 3 && ka.slice(0, head) === kb.slice(0, head)) return true;
  return wa.some((w) => w.length >= 4 && wb.includes(w));
}

export const shiftDay = (iso: string, days: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/**
 * Casa lançamentos do Open Finance com os que já vieram por arquivo (extrato PDF/OFX/JSON): mesma data e
 * valor, um pra um; sem par exato, aceita ±1 dia; com 2–3 dias, só se a descrição parecer a mesma ({@link sameMerchant}).
 * `fresh` = o que é novo de verdade; `accountId` = conta de arquivo com mais pares (candidata a ser adotada).
 */
export function reconcile<R extends OfRow>(rows: R[], fileTxs: FileTx[]) {
  const pool = new Map<string, FileTx[]>();
  for (const f of fileTxs) {
    const k = `${f.date}|${f.amount.toFixed(2)}`;
    pool.set(k, [...(pool.get(k) ?? []), f]);
  }
  const take = (date: string, amount: number) => pool.get(`${date}|${amount.toFixed(2)}`)?.shift();

  const matches: { externalId: string; fileId: string }[] = [];
  const pending: R[] = [];
  const byAccount = new Map<string, number>();
  const hit = (r: R, f: FileTx) => {
    matches.push({ externalId: r.externalId, fileId: f.id });
    if (f.accountId) byAccount.set(f.accountId, (byAccount.get(f.accountId) ?? 0) + 1);
  };
  // 1ª passada: mesma data; 2ª: ±1 dia (só para o que sobrou)
  for (const r of rows) {
    const f = take(r.date, r.amount);
    if (f) hit(r, f);
    else pending.push(r);
  }
  const pending2: R[] = [];
  for (const r of pending) {
    const f = take(shiftDay(r.date, -1), r.amount) ?? take(shiftDay(r.date, 1), r.amount);
    if (f) hit(r, f);
    else pending2.push(r);
  }
  // 3ª: 2–3 dias (compra no fim de semana, lançada na segunda) — só com descrição parecida
  const fresh: R[] = [];
  for (const r of pending2) {
    let f: FileTx | undefined;
    for (const delta of [-2, 2, -3, 3]) {
      const list = pool.get(`${shiftDay(r.date, delta)}|${r.amount.toFixed(2)}`);
      const i = list?.findIndex((x) => x.description && sameMerchant(x.description, r.description)) ?? -1;
      if (list && i >= 0) {
        f = list.splice(i, 1)[0];
        break;
      }
    }
    if (f) hit(r, f);
    else fresh.push(r);
  }
  const accountId = [...byAccount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return { matches, fresh, accountId };
}

/** "Banco do Brasil" → "banco-do-brasil" (vai em BankAccount.bank). */
export const bankSlug = (name: string): string =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
