'use client';
import { useEffect, useRef, useState } from 'react';
import { PillButton } from '@/components/ui/PillButton';
import { CheckIcon } from './icons';
import styles from './auth.module.css';
import face from './face.module.css';

export type FaceMode = 'login' | 'reg' | 'reset';
type Phase = 'idle' | 'scan' | 'ok';

const RING = 766.5; // 2π·122

/**
 * Câmera + animação de varredura do design. É só uma etapa de UX:
 * TODO(biometria): não há reconhecimento facial real — nenhum frame sai do navegador
 * e a "confirmação" é a animação terminar. Autenticação biométrica de verdade está fora do escopo.
 */
export function FaceScan({
  mode,
  firstName,
  onBack,
  onAlt,
  altLabel,
  doneAction,
}: {
  mode: FaceMode;
  firstName?: string;
  /** "‹ Voltar" no topo (só no login facial) */
  onBack?: () => void;
  onAlt: () => void;
  altLabel: string;
  /** CTA depois do scan ok */
  doneAction: React.ReactNode;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [camOn, setCamOn] = useState(false);
  const [camError, setCamError] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [prog, setProg] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamError(true);
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user' } })
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        streamRef.current = s;
        if (videoRef.current) videoRef.current.srcObject = s;
        setCamOn(true);
      })
      .catch(() => setCamError(true));
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (phase !== 'scan') return;
    const id = setInterval(() => {
      setProg((p) => {
        const n = Math.min(100, p + 3);
        if (n >= 100) {
          clearInterval(id);
          setPhase('ok');
        }
        return n;
      });
    }, 60);
    return () => clearInterval(id);
  }, [phase]);

  // desliga a câmera ao confirmar
  useEffect(() => {
    if (phase === 'ok') {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, [phase]);

  function startScan() {
    if (phase === 'scan') return;
    setProg(0);
    setPhase('scan');
  }

  const isLogin = mode === 'login';
  const ok = phase === 'ok';
  const scanning = phase === 'scan';

  const title = isLogin
    ? ok
      ? `Bem-vindo de volta${firstName ? `, ${firstName}` : ''}`
      : 'Olha para a câmera'
    : mode === 'reset'
      ? 'Recadastrar rosto'
      : 'Cadastrar teu rosto';
  const sub = isLogin
    ? 'Centraliza o rosto no círculo, em um lugar com boa luz.'
    : 'Para entrar sem senha da próxima vez. A imagem fica só neste dispositivo.';
  const status = ok
    ? isLogin
      ? 'Identidade confirmada'
      : 'Rosto cadastrado'
    : scanning
      ? `Analisando · ${prog}%`
      : camOn
        ? 'Câmera pronta'
        : camError
          ? 'Câmera indisponível'
          : 'Aguardando câmera';
  const statusTone = ok ? face.statusOk : scanning ? face.statusScan : '';

  return (
    <section className={`${styles.sectionTight} ${face.wrap}`}>
      {onBack && (
        <button type="button" className={`${styles.backBtn} ${face.back}`} onClick={onBack}>
          ‹ Voltar
        </button>
      )}
      <div className={styles.head}>
        <h2 className={styles.titleSm}>{title}</h2>
        <p className={`${styles.sub} ${face.sub}`}>{sub}</p>
      </div>

      <div className={face.stage}>
        <div className={face.lens}>
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className={face.video}
            style={{ opacity: camOn && !ok ? 1 : 0 }}
          />
          <svg viewBox="0 0 100 100" className={face.silhouette} style={{ opacity: camOn ? 0 : 1 }} aria-hidden>
            <ellipse cx="50" cy="42" rx="17" ry="21" />
            <path d="M20 96c4-18 16-26 30-26s26 8 30 26" />
          </svg>
          <div className={face.scanLine} style={{ top: `${15 + ((prog * 1.4) % 70)}%`, opacity: scanning ? 1 : 0 }} />
        </div>
        <svg viewBox="0 0 260 260" className={face.ring} aria-hidden>
          <circle cx="130" cy="130" r="122" className={face.ringTrack} />
          <circle
            cx="130"
            cy="130"
            r="122"
            className={`${face.ringFill} ${ok ? face.ringOk : ''}`}
            strokeDasharray={RING}
            strokeDashoffset={RING * (1 - prog / 100)}
          />
        </svg>
        {ok && (
          <div className={face.okOverlay}>
            <CheckIcon size={64} />
          </div>
        )}
      </div>

      <div className={`${face.status} ${statusTone}`} role="status">
        <span className={face.statusDot} />
        {status}
      </div>

      {camError && !ok && (
        <p className={styles.note}>Não consegui abrir a câmera. Libera o acesso no navegador — ou segue sem, a varredura é ilustrativa por enquanto.</p>
      )}

      <div className={`${styles.actionsTight} ${face.actions}`}>
        {ok ? (
          doneAction
        ) : (
          <PillButton block onClick={startScan} aria-disabled={scanning}>
            {scanning ? 'Analisando…' : isLogin ? 'Escanear rosto' : 'Começar'}
          </PillButton>
        )}
        <PillButton variant="ghost" block onClick={onAlt}>
          {altLabel}
        </PillButton>
      </div>
    </section>
  );
}
