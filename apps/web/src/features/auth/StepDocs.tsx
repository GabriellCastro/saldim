'use client';
import { PillButton } from '@/components/ui/PillButton';
import { uploadDoc, type DocKind } from './upload';
import styles from './auth.module.css';
import { errorText } from '@/lib/errors';

export type DocFile = { name: string; st: 'reading' | 'ok' | 'err'; error?: string };
export type DocsState = Record<DocKind, DocFile | null>;

const DOCS: { k: DocKind; title: string; hint: string; accept: string; icon: string }[] = [
  { k: 'holerite', title: 'Holerite', hint: 'Último mês · PDF ou foto', accept: '.pdf,image/*', icon: 'H' },
  // .json: formato de design/extrato-itau.json, aceito pela API
  { k: 'extrato', title: 'Extrato bancário', hint: 'Últimos 3 meses · PDF, OFX ou CSV', accept: '.pdf,.ofx,.csv,.json', icon: 'E' },
];

/** Etapa 3 · Documentos — envia holerite e extrato para a API (já logado). */
export function StepDocs({
  docs,
  setDocs,
  onNext,
}: {
  docs: DocsState;
  setDocs: React.Dispatch<React.SetStateAction<DocsState>>;
  onNext: () => void;
}) {
  async function pick(k: DocKind, file?: File | null) {
    if (!file) return;
    setDocs((d) => ({ ...d, [k]: { name: file.name, st: 'reading' } }));
    try {
      await uploadDoc(k, file);
      setDocs((d) => ({ ...d, [k]: { name: file.name, st: 'ok' } }));
    } catch (e) {
      const error = errorText(e, 'Não deu para ler o arquivo.');
      setDocs((d) => ({ ...d, [k]: { name: file.name, st: 'err', error } }));
    }
  }

  const ready = docs.holerite?.st === 'ok' && docs.extrato?.st === 'ok';
  const reading = docs.holerite?.st === 'reading' || docs.extrato?.st === 'reading';

  return (
    <section className={styles.sectionTight}>
      <div className={styles.head}>
        <h2 className={styles.titleSm}>Envia teus documentos</h2>
        <p className={styles.sub}>PDF, foto ou arquivo do banco. A IA lê e tu confere antes de salvar.</p>
      </div>
      <div className={styles.options}>
        {DOCS.map((d) => {
          const f = docs[d.k];
          const state = f?.st === 'ok' ? styles.docOk : f?.st === 'reading' ? styles.docReading : f?.st === 'err' ? styles.docErr : '';
          const sub = !f
            ? d.hint
            : f.st === 'ok'
              ? `${f.name} · lido pela IA`
              : f.st === 'reading'
                ? `Lendo ${f.name}…`
                : `${f.name} · ${f.error}`;
          return (
            <label
              key={d.k}
              className={`${styles.doc} ${f ? styles.docHasFile : ''} ${state}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                pick(d.k, e.dataTransfer.files[0]);
              }}
            >
              <input
                type="file"
                accept={d.accept}
                className={styles.docFile}
                onChange={(e) => {
                  pick(d.k, e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
              <span className={styles.docIcon}>{f?.st === 'ok' ? '✓' : d.icon}</span>
              <span className={styles.docText}>
                <span className={styles.docTitle}>{d.title}</span>
                <span className={styles.docSub} title={sub}>{sub}</span>
              </span>
              <span className={styles.docAction}>{f ? 'Trocar' : 'Escolher'}</span>
            </label>
          );
        })}
      </div>
      <div className={styles.note}>Extrato dos últimos 3 meses deixa a projeção mais precisa. Aceita PDF, OFX e CSV.</div>
      <div className={styles.actionsTight}>
        <PillButton block disabled={!ready} onClick={onNext}>
          Continuar
        </PillButton>
        <PillButton variant="ghost" block disabled={reading} onClick={onNext}>
          Enviar depois
        </PillButton>
      </div>
    </section>
  );
}
