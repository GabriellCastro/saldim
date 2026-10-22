'use client';
import { useEffect, useState } from 'react';
import { PillButton } from '@/components/ui/PillButton';
import { TextInput } from '@/components/ui/TextInput';
import styles from './auth.module.css';

export type BankState = { name: string | null; phase: 'pick' | 'consent' | 'busy'; prog: number };

const BANKS: [string, string][] = [
  ['Itaú', 'IT'], ['Nubank', 'NU'], ['Bradesco', 'BR'], ['Banco do Brasil', 'BB'],
  ['Santander', 'SA'], ['Caixa', 'CX'], ['Inter', 'IN'], ['C6 Bank', 'C6'],
];

const CONSENT = [
  { ok: true, title: 'Saldos e lançamentos', sub: 'Conta corrente e cartão, últimos 12 meses' },
  { ok: true, title: 'Dados cadastrais', sub: 'Nome e CPF, para confirmar que a conta é tua' },
  { ok: true, title: 'Empréstimos e financiamentos', sub: 'Parcelas e prazo, para projetar a folha' },
  { ok: false, title: 'Movimentar dinheiro', sub: 'O app nunca faz Pix, pagamento ou transferência' },
];

/**
 * Etapa 3 · Conectar conta (Open Finance).
 * SIMULADO: ainda não existe integração Open Finance na API — o progresso é só a animação do design
 * e nada é importado. Para dados reais, o usuário envia o extrato em /bancos.
 */
export function StepBank({
  bank,
  setBank,
  onNext,
}: {
  bank: BankState;
  setBank: React.Dispatch<React.SetStateAction<BankState>>;
  onNext: () => void;
}) {
  const [q, setQ] = useState('');
  const busy = bank.phase === 'busy';

  useEffect(() => {
    if (!busy) return;
    const id = setInterval(() => {
      setBank((b) => {
        const prog = Math.min(100, b.prog + 4);
        if (prog >= 100) clearInterval(id);
        return { ...b, prog };
      });
    }, 80);
    return () => clearInterval(id);
  }, [busy, setBank]);

  if (bank.phase === 'pick') {
    const term = q.trim().toLowerCase();
    const list = BANKS.filter(([n]) => !term || n.toLowerCase().includes(term));
    return (
      <section className={styles.sectionTight}>
        <div className={styles.head}>
          <h2 className={styles.titleSm}>Qual é teu banco?</h2>
          <p className={styles.sub}>Conexão via Open Finance. Tu autoriza no app do banco, só leitura.</p>
        </div>
        <TextInput placeholder="Buscar banco" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className={styles.bankGrid}>
          {list.map(([name, short]) => (
            <button key={name} type="button" className={styles.bankBtn} onClick={() => setBank({ name, phase: 'consent', prog: 0 })}>
              <span className={styles.bankShort}>{short}</span>
              <span className={styles.bankName}>{name}</span>
            </button>
          ))}
        </div>
      </section>
    );
  }

  if (bank.phase === 'consent')
    return (
      <section className={styles.sectionTight}>
        <div className={styles.head}>
          <h2 className={styles.titleSm}>Autorizar {bank.name}</h2>
          <p className={styles.sub}>
            Tu vai para o app do {bank.name} confirmar. O acesso vale 12 meses e pode ser revogado a qualquer momento.
          </p>
        </div>
        <div className={styles.list}>
          {CONSENT.map((c) => (
            <div key={c.title} className={styles.listRow}>
              <span className={`${styles.mark} ${c.ok ? '' : styles.markNo}`}>{c.ok ? '✓' : '×'}</span>
              <span className={styles.rowText}>
                <span className={styles.rowTitle}>{c.title}</span>
                <span className={styles.rowSub}>{c.sub}</span>
              </span>
            </div>
          ))}
        </div>
        <div className={styles.actionsTight}>
          <PillButton block onClick={() => setBank((b) => ({ ...b, phase: 'busy', prog: 0 }))}>
            Ir para o {bank.name}
          </PillButton>
          <PillButton variant="ghost" block onClick={() => setBank((b) => ({ ...b, phase: 'pick' }))}>
            Escolher outro banco
          </PillButton>
        </div>
      </section>
    );

  const done = bank.prog >= 100;
  const short = BANKS.find(([n]) => n === bank.name)?.[1] ?? '?';
  return (
    <section className={styles.sectionTight}>
      <div className={styles.busy}>
        <span className={`${styles.busyIcon} ${done ? styles.busyIconOk : ''}`}>{done ? '✓' : short}</span>
        <div className={styles.head}>
          <h2 className={styles.busyTitle}>{done ? `${bank.name} conectado` : `Conectando ao ${bank.name}…`}</h2>
          <p className={styles.sub}>
            {done ? 'Conexão de demonstração concluída. Para importar lançamentos agora, envia o extrato.' : 'Confirma no app do banco se ele abrir.'}
          </p>
        </div>
        <div className={styles.progress}>
          <div className={styles.progressFill} style={{ width: `${bank.prog}%` }} />
        </div>
        <span className={styles.simTag} title="A integração Open Finance ainda não existe; esta etapa é ilustrativa.">
          Simulação · Open Finance em breve
        </span>
      </div>
      <PillButton block disabled={!done} onClick={onNext}>
        Continuar
      </PillButton>
    </section>
  );
}
