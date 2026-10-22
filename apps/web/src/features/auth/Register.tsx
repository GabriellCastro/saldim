'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { mutate } from 'swr';
import { patch } from '@/lib/api';
import type { User } from '@/lib/session';
import { AUTH_ROUTES } from '@/lib/routes';
import { PillButton } from '@/components/ui/PillButton';
import { FaceScan } from './FaceScan';
import { StepAccount } from './StepAccount';
import { StepDocs, type DocsState } from './StepDocs';
import { StepBank, type BankState } from './StepBank';
import { StepDone } from './StepDone';
import { enableFaceOnThisDevice, saveDeviceUser } from './deviceUser';
import styles from './auth.module.css';
import { errorText } from '@/lib/errors';

export type Mode = 'docs' | 'bank';

const MODES: { id: Mode; title: string; tag: string; desc: string }[] = [
  { id: 'docs', title: 'Enviar holerite e extrato', tag: 'Mais rápido', desc: 'Sobe o PDF do holerite e o extrato do banco. A IA lê descontos, empréstimos e cada gasto.' },
  { id: 'bank', title: 'Conectar minha conta', tag: 'Atualiza sozinho', desc: 'Autoriza pelo Open Finance. Saldo e lançamentos entram todo dia, sem precisar enviar nada.' },
];

/**
 * Cadastro em 4 etapas, como no design: Conta → Renda e gastos → Documentos|Conectar → Rosto → concluído.
 * A conta é criada (POST /auth/register) ao sair da etapa 1; as demais já rodam logadas.
 */
export function Register() {
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<Mode>('docs');
  const [created, setCreated] = useState<User | null>(null);
  const [docs, setDocs] = useState<DocsState>({ holerite: null, extrato: null });
  const [bank, setBank] = useState<BankState>({ name: null, phase: 'pick', prog: 0 });
  const [faceEnrolled, setFaceEnrolled] = useState(false);
  const [faceError, setFaceError] = useState('');
  const [faceBusy, setFaceBusy] = useState(false);

  const labels = ['Conta', 'Renda e gastos', mode === 'docs' ? 'Documentos' : 'Conectar', 'Rosto'];

  function back() {
    if (step === 1) return router.push(AUTH_ROUTES.login);
    if (step === 3 && mode === 'bank' && bank.phase === 'consent') return setBank((b) => ({ ...b, phase: 'pick' }));
    setStep(step - 1);
  }

  async function finishFace(enabled: boolean) {
    setFaceBusy(true);
    setFaceError('');
    try {
      const u = enabled ? await enableFaceOnThisDevice() : await patch<User>('/me/settings', { faceEnabled: false });
      saveDeviceUser(u);
      await mutate('/auth/me', u, { revalidate: false });
      setFaceEnrolled(enabled);
      setStep(5);
    } catch (e) {
      setFaceError(errorText(e, 'Não deu para salvar agora.'));
    } finally {
      setFaceBusy(false);
    }
  }

  if (step === 5)
    return <StepDone user={created} mode={mode} bankName={bank.name} faceEnrolled={faceEnrolled} docs={docs} />;

  return (
    <>
      <div className={styles.stepper}>
        <div className={styles.stepTop}>
          <button type="button" className={styles.backBtn} onClick={back}>
            ‹ {step === 1 ? 'Já tenho conta' : 'Voltar'}
          </button>
          <span className={styles.stepCount}>
            Etapa {step} de 4<span className={styles.stepCountLabel}> · {labels[step - 1]}</span>
          </span>
        </div>
        <div className={styles.steps}>
          {labels.map((label, i) => {
            const n = i + 1;
            const cls = n < step ? styles.stepDone : n === step ? styles.stepCur : '';
            return (
              <div key={label} className={`${styles.step} ${cls}`} aria-current={n === step ? 'step' : undefined}>
                <div className={styles.stepBar} />
                <span className={styles.stepLabel}>{label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {step === 1 && (
        <StepAccount
          created={created}
          onCreated={(u) => {
            setCreated(u);
            setStep(2);
          }}
          onNext={() => setStep(2)}
        />
      )}

      {step === 2 && (
        <section className={styles.sectionTight}>
          <div className={styles.head}>
            <h2 className={styles.titleSm}>Como a IA vai ler teu dinheiro?</h2>
            <p className={styles.sub}>Ela precisa da tua renda e dos teus gastos. Dá para trocar depois no perfil.</p>
          </div>
          <div className={styles.options} role="radiogroup">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={mode === m.id}
                className={`${styles.option} ${mode === m.id ? styles.optionOn : ''}`}
                onClick={() => setMode(m.id)}
              >
                <span className={styles.radio} />
                <span className={styles.optionText}>
                  <span className={styles.optionHead}>
                    <span className={styles.optionTitle}>{m.title}</span>
                    <span className={styles.optionTag}>{m.tag}</span>
                  </span>
                  <span className={styles.optionDesc}>{m.desc}</span>
                </span>
              </button>
            ))}
          </div>
          <PillButton block onClick={() => setStep(3)}>
            Continuar
          </PillButton>
        </section>
      )}

      {step === 3 && mode === 'docs' && <StepDocs docs={docs} setDocs={setDocs} onNext={() => setStep(4)} />}
      {step === 3 && mode === 'bank' && <StepBank bank={bank} setBank={setBank} onNext={() => setStep(4)} />}

      {step === 4 && (
        <FaceScan
          mode="reg"
          altLabel={faceBusy ? 'Salvando…' : 'Pular por agora'}
          onAlt={() => !faceBusy && finishFace(false)}
          doneAction={
            <>
              {faceError && <div className={styles.formError}>{faceError}</div>}
              <PillButton block disabled={faceBusy} onClick={() => finishFace(true)}>
                {faceBusy ? 'Salvando…' : 'Concluir cadastro'}
              </PillButton>
            </>
          }
        />
      )}
    </>
  );
}
