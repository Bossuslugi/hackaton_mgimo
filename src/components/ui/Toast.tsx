'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { CircleCheck, Info, X, CircleX } from 'lucide-react';
import { cn } from '@/lib/cn';
import { ICON_STROKE } from '@/lib/ui';

type Tone = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  tone: Tone;
  title: string;
  description?: string;
}

interface ToastApi {
  toast: (t: Omit<ToastItem, 'id'>) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

const Ctx = createContext<ToastApi | null>(null);

const ICONS: Record<Tone, ReactNode> = {
  success: <CircleCheck size={18} strokeWidth={ICON_STROKE} className="text-emerald-600 dark:text-emerald-400" />,
  error: <CircleX size={18} strokeWidth={ICON_STROKE} className="text-red-600 dark:text-red-400" />,
  info: <Info size={18} strokeWidth={ICON_STROKE} className="text-blue-600 dark:text-blue-400" />,
};

let seq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);

  const toast = useCallback(
    (t: Omit<ToastItem, 'id'>) => {
      const id = ++seq;
      setItems((xs) => [...xs.slice(-2), { ...t, id }]);
      window.setTimeout(() => dismiss(id), 4000);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      toast,
      success: (title, description) => toast({ tone: 'success', title, description }),
      error: (title, description) => toast({ tone: 'error', title, description }),
      info: (title, description) => toast({ tone: 'info', title, description }),
    }),
    [toast],
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:left-auto lg:right-6 lg:items-end lg:px-0"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#12141A] p-3 pr-2 shadow-sm',
              'animate-[toast-in_180ms_ease-out]',
            )}
          >
            <span className="mt-0.5 shrink-0">{ICONS[t.tone]}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-900 dark:text-zinc-50">{t.title}</p>
              {t.description && <p className="mt-0.5 text-sm text-slate-500 dark:text-zinc-400 break-words">{t.description}</p>}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Скрыть уведомление"
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-slate-400 dark:text-zinc-500 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-700 dark:hover:text-zinc-300"
            >
              <X size={16} strokeWidth={ICON_STROKE} />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useToast вне ToastProvider');
  return ctx;
}
