'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ApiError, post } from '@/lib/api';
import { toChatReply } from '@/lib/normalize';
import type { ChatMessage, CopilotContext, CopilotMode } from '@/lib/types';

export const DEFAULT_SUGGESTIONS: Record<CopilotMode, string[]> = {
  TUTOR: [
    'Объясни тему простыми словами',
    'Составь план подготовки к РК на неделю',
    'Сделай 5 вопросов для самопроверки',
    'Как правильно оформить отчёт по лабе?',
  ],
  DEANERY: [
    'Сколько баллов нужно для повышенной стипендии?',
    'Как записаться на пересдачу?',
    'Какие документы нужны для матпомощи?',
    'Как оформить академический отпуск?',
  ],
};

export const MODE_LABEL: Record<CopilotMode, string> = {
  TUTOR: 'Учебный тьютор',
  DEANERY: 'Деканат и регламенты',
};

interface OpenOptions {
  mode?: CopilotMode;
  context?: CopilotContext | null;
  /** Сообщение, которое будет отправлено сразу после открытия */
  prompt?: string;
}

interface CopilotApi {
  isOpen: boolean;
  mode: CopilotMode;
  messages: ChatMessage[];
  suggestions: string[];
  context: CopilotContext | null;
  pending: boolean;
  open: (opts?: OpenOptions) => void;
  close: () => void;
  setMode: (m: CopilotMode) => void;
  clearContext: () => void;
  send: (text: string) => void;
  reset: () => void;
}

const Ctx = createContext<CopilotApi | null>(null);
let seq = 0;
const uid = () => `m${Date.now().toString(36)}${(++seq).toString(36)}`;

export function CopilotProvider({ children }: { children: ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const [mode, setMode] = useState<CopilotMode>('TUTOR');
  const [threads, setThreads] = useState<Record<CopilotMode, ChatMessage[]>>({ TUTOR: [], DEANERY: [] });
  const [sugg, setSugg] = useState<Record<CopilotMode, string[] | null>>({ TUTOR: null, DEANERY: null });
  const [context, setContext] = useState<CopilotContext | null>(null);
  const [pending, setPending] = useState(false);

  const stateRef = useRef({ mode, threads, context, pending });
  stateRef.current = { mode, threads, context, pending };

  const sendIn = useCallback(async (m: CopilotMode, text: string, ctx: CopilotContext | null) => {
    const message = text.trim();
    if (!message || stateRef.current.pending) return;
    const history = stateRef.current.threads[m].slice(-10).map(({ role, content }) => ({ role, content }));
    setThreads((t) => ({ ...t, [m]: [...t[m], { id: uid(), role: 'user', content: message }] }));
    setPending(true);
    try {
      const raw = await post('/api/ai/chat', {
        message,
        mode: m,
        history,
        context: ctx ?? undefined,
      });
      const r = toChatReply(raw);
      setThreads((t) => ({
        ...t,
        [m]: [...t[m], { id: uid(), role: 'assistant', content: r.reply || 'Пустой ответ от ассистента.' }],
      }));
      setSugg((s) => ({ ...s, [m]: r.suggestions.length ? r.suggestions : null }));
    } catch (e) {
      const msg =
        e instanceof ApiError && e.status === 429
          ? 'Слишком много запросов. Подождите немного и повторите.'
          : e instanceof ApiError
            ? e.message
            : 'Не удалось получить ответ.';
      setThreads((t) => ({ ...t, [m]: [...t[m], { id: uid(), role: 'assistant', content: msg, error: true }] }));
    } finally {
      setPending(false);
    }
  }, []);

  const send = useCallback(
    (text: string) => {
      const { mode: m, context: ctx } = stateRef.current;
      void sendIn(m, text, ctx);
    },
    [sendIn],
  );

  const open = useCallback(
    (opts?: OpenOptions) => {
      const m = opts?.mode ?? stateRef.current.mode;
      if (opts?.mode) setMode(opts.mode);
      if (opts && 'context' in opts) setContext(opts.context ?? null);
      setOpen(true);
      if (opts?.prompt) void sendIn(m, opts.prompt, opts.context ?? stateRef.current.context);
    },
    [sendIn],
  );

  const close = useCallback(() => setOpen(false), []);

  // ⌘K / Ctrl+K теперь открывает командную палитру (CommandPalette), Copilot — из палитры

  const api = useMemo<CopilotApi>(
    () => ({
      isOpen,
      mode,
      messages: threads[mode],
      suggestions: sugg[mode] ?? DEFAULT_SUGGESTIONS[mode],
      context,
      pending,
      open,
      close,
      setMode,
      clearContext: () => setContext(null),
      send,
      reset: () => {
        setThreads((t) => ({ ...t, [mode]: [] }));
        setSugg((s) => ({ ...s, [mode]: null }));
        setContext(null);
      },
    }),
    [isOpen, mode, threads, sugg, context, pending, open, close, send],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useCopilot(): CopilotApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCopilot вне CopilotProvider');
  return ctx;
}
