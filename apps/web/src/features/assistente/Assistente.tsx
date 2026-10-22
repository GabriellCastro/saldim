'use client';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { fetcher, post } from '@/lib/api';
import { useUser } from '@/lib/session';
import { Eyebrow } from '@/components/ui';
import { LoadError, Skeleton } from '@/components/ui/ScreenState';
import styles from './Assistente.module.css';

type Alert = { tag: string; tone: 'neg' | 'warn' | 'pos'; title: string; body: string };
type ChatMessage = { id: string; role: 'user' | 'assistant'; content: string; createdAt: string };

const TONE = { neg: styles.neg, warn: styles.warn, pos: styles.pos } as const;
/** Distância (px) do fim da lista até onde ainda consideramos "colado no fim". */
const STICK_THRESHOLD = 80;

const time = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

export function Assistente() {
  const { user } = useUser();
  const alerts = useSWR<Alert[]>('/assistant/alerts', fetcher);
  const prompts = useSWR<string[]>('/assistant/prompts', fetcher);
  const messages = useSWR<ChatMessage[]>('/assistant/messages', fetcher);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const history = messages.data ?? [];
  const firstName = user?.name.split(' ')[0];
  const greeting = `Oi${firstName ? `, ${firstName}` : ''}. Já li teu holerite e os lançamentos do banco. Pergunta o que quiser: onde cortar, quanto guardar, se vale quitar algum empréstimo.`;

  const scrollToEnd = useCallback((smooth = true) => {
    endRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'end' });
  }, []);

  // Primeira carga: vai direto pro fim sem animação.
  const loaded = !messages.isLoading;
  useLayoutEffect(() => {
    if (loaded) scrollToEnd(false);
  }, [loaded, scrollToEnd]);

  // Mensagem nova: só rola se a pessoa já estava no fim (não puxa quem tá lendo o histórico).
  useEffect(() => {
    if (atBottom) scrollToEnd();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history.length, thinking]);

  // Textarea cresce com o texto (até o max-height do CSS).
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [draft]);

  function onScroll() {
    const el = listRef.current;
    if (!el) return;
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < STICK_THRESHOLD);
  }

  async function ask(text: string) {
    const content = text.trim();
    if (!content || thinking) return;
    setDraft('');
    setSendError(null);
    setThinking(true);
    setAtBottom(true);
    const optimistic: ChatMessage = { id: `tmp-${Date.now()}`, role: 'user', content, createdAt: new Date().toISOString() };
    const before = messages.data ?? [];
    await messages.mutate([...before, optimistic], { revalidate: false });
    try {
      const { reply } = await post<{ reply: ChatMessage }>('/assistant/messages', { content });
      await messages.mutate((cur) => [...(cur ?? []), reply], { revalidate: false });
      void messages.mutate(); // sincroniza ids reais
    } catch {
      setSendError('Não consegui falar com a IA agora. Tenta de novo em instantes.');
      await messages.mutate(before, { revalidate: false });
      setDraft(content);
    } finally {
      setThinking(false);
      inputRef.current?.focus();
    }
  }

  return (
    <div className={styles.layout}>
      <section className={styles.chatCard} aria-label="Conversa com a assistente">
        <header className={styles.chatHead}>
          <AiAvatar size="lg" />
          <div className={styles.chatHeadTx}>
            <div className={styles.chatName}>Assistente Saldim</div>
            <div className={styles.chatStatus}>
              <span className={`${styles.statusDot} ${thinking ? styles.statusBusy : ''}`} />
              {thinking ? 'Pensando…' : 'Online · conhece teus números'}
            </div>
          </div>
        </header>

        <div className={styles.scrollWrap}>
          <div ref={listRef} className={styles.messages} onScroll={onScroll} aria-live="polite">
            {messages.isLoading ? (
              <Skeleton heights={[48, 72]} />
            ) : messages.error ? (
              <LoadError onRetry={() => messages.mutate()} />
            ) : (
              <>
                {history.length === 0 && <Bubble role="assistant" text={greeting} />}
                {history.map((m, i) => (
                  <Bubble
                    key={m.id}
                    role={m.role}
                    text={m.content}
                    at={m.createdAt}
                    grouped={history[i - 1]?.role === m.role}
                  />
                ))}
              </>
            )}
            {thinking && (
              <div className={styles.row}>
                <AiAvatar />
                <div className={styles.typing} aria-label="Analisando teus números">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            )}
            {sendError && (
              <div className={styles.sendError} role="alert">
                {sendError}
              </div>
            )}
            <div ref={endRef} />
          </div>

          <button
            type="button"
            className={`${styles.toEnd} ${atBottom ? '' : styles.toEndOn}`}
            onClick={() => scrollToEnd()}
            aria-label="Ir pro fim da conversa"
            tabIndex={atBottom ? -1 : 0}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
              <path d="M12 5v14M6 13l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <div className={styles.footer}>
          {!!prompts.data?.length && (
            <div className={styles.prompts}>
              {prompts.data.map((p) => (
                <button key={p} type="button" className={styles.prompt} onClick={() => ask(p)} disabled={thinking}>
                  {p}
                </button>
              ))}
            </div>
          )}

          <form
            className={styles.composer}
            onSubmit={(e) => {
              e.preventDefault();
              void ask(draft);
            }}
          >
            <textarea
              ref={inputRef}
              rows={1}
              className={styles.input}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void ask(draft);
                }
              }}
              placeholder="Ex: posso trocar de celular agora?"
              aria-label="Pergunta pra IA"
            />
            <button type="submit" className={styles.send} disabled={thinking || !draft.trim()} aria-label="Enviar">
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
                <path d="M12 19V5M5 12l7-7 7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </form>
          <div className={styles.hint}>Enter envia · Shift+Enter quebra linha</div>
        </div>
      </section>

      <aside className={styles.alerts} aria-label="Alertas">
        <Eyebrow className={styles.alertsTitle}>Alertas</Eyebrow>
        <div className={styles.alertList}>
          {alerts.isLoading && <Skeleton heights={[96, 96, 96]} />}
          {alerts.error && <LoadError onRetry={() => alerts.mutate()} />}
          {alerts.data?.length === 0 && <div className={styles.empty}>Nenhum alerta por agora. Tá tudo no ritmo.</div>}
          {alerts.data?.map((a, i) => (
            <div key={i} className={`${styles.alert} ${TONE[a.tone] ?? ''}`}>
              <span className={styles.tag}>
                <span className={styles.tagDot} />
                {a.tag}
              </span>
              <div className={styles.alertTitle}>{a.title}</div>
              <div className={styles.alertBody}>{a.body}</div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

function AiAvatar({ size }: { size?: 'lg' }) {
  return (
    <span className={`${styles.avatar} ${size === 'lg' ? styles.avatarLg : ''}`} aria-hidden>
      <svg viewBox="0 0 24 24">
        <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" fill="currentColor" />
        <path d="M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" fill="currentColor" opacity="0.7" />
      </svg>
    </span>
  );
}

function Bubble({ role, text, at, grouped }: { role: 'user' | 'assistant'; text: string; at?: string; grouped?: boolean }) {
  const user = role === 'user';
  return (
    <div className={`${styles.row} ${user ? styles.rowUser : ''} ${grouped ? styles.grouped : ''}`}>
      {!user && (grouped ? <span className={styles.avatarGap} /> : <AiAvatar />)}
      <div className={styles.bubbleCol}>
        <div className={user ? styles.bubbleUser : styles.bubbleAi}>{text}</div>
        {at && <time className={styles.time}>{time(at)}</time>}
      </div>
    </div>
  );
}
