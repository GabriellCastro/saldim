import { PillLink } from '@/components/ui/PillButton';
import type { User } from '@/lib/session';
import { PERFIL } from '@/lib/routes';
import { CheckIcon } from './icons';
import type { Mode } from './Register';
import type { DocsState } from './StepDocs';
import styles from './auth.module.css';

/** Registro concluído: resumo do que foi configurado. */
export function StepDone({
  user,
  mode,
  bankName,
  faceEnrolled,
  docs,
}: {
  user: User | null;
  mode: Mode;
  bankName: string | null;
  faceEnrolled: boolean;
  docs: DocsState;
}) {
  const firstName = user?.name.trim().split(' ')[0] ?? '';
  const docsRead = [docs.holerite?.st === 'ok' && 'Holerite', docs.extrato?.st === 'ok' && 'Extrato'].filter(Boolean);
  const summary = [
    { k: 'Conta', v: user?.email ?? '—', on: !!user },
    mode === 'docs'
      ? {
          k: 'Documentos',
          v: docsRead.length === 2 ? 'Holerite e extrato lidos' : docsRead.length ? `${docsRead[0]} lido` : 'Envia depois em Conectar bancos',
          on: docsRead.length > 0,
        }
      : { k: 'Banco', v: `${bankName ?? 'Banco'} via Open Finance (demonstração)`, on: false },
    { k: 'Entrar com rosto', v: faceEnrolled ? 'Ativado' : 'Desativado', on: faceEnrolled },
  ];

  return (
    <section className={styles.sectionTight}>
      <div className={styles.doneIcon}>
        <CheckIcon />
      </div>
      <div className={styles.head}>
        <h2 className={styles.titleSm}>Tudo pronto{firstName ? `, ${firstName}` : ''}</h2>
        <p className={styles.sub}>A IA está montando teu primeiro plano. Leva menos de um minuto.</p>
      </div>
      <div className={styles.list}>
        {summary.map((r) => (
          <div key={r.k} className={styles.sumRow}>
            <span className={styles.sumKey}>{r.k}</span>
            <span className={styles.sumVal}>
              <span className={`${styles.dot} ${r.on ? styles.dotOn : ''}`} />
              {r.v}
            </span>
          </div>
        ))}
      </div>
      <div className={styles.actionsTight}>
        <PillLink href="/visao-geral" block>
          Abrir meu painel
        </PillLink>
        <PillLink href={PERFIL} variant="ghost" block>
          Ver meu perfil
        </PillLink>
      </div>
    </section>
  );
}
