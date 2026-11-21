'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { ICON_STROKE } from '@/lib/ui';

/**
 * Модалка по дизайн-системе: < sm — нижняя шторка, ≥ sm — центрированное окно.
 * Esc / клик по оверлею закрывают, фокус удерживается внутри.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  bodyClassName,
  headerExtra,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg' | 'xl';
  bodyClassName?: string;
  headerExtra?: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = window.setTimeout(() => {
      const el = panel.current?.querySelector<HTMLElement>('[data-autofocus], input, textarea, button:not([data-close])');
      (el ?? panel.current)?.focus();
    }, 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
      }
      if (e.key === 'Tab' && panel.current) {
        const f = panel.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), textarea, select, [tabindex]:not([tabindex="-1"])',
        );
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      prev?.focus?.();
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" data-sheet>
      <div className="absolute inset-0 bg-slate-900/40 dark:bg-black/60" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#12141A] shadow-sm outline-none',
          'animate-[sheet-in_200ms_ease-out] sm:rounded-xl',
          size === 'md' && 'sm:max-w-lg',
          size === 'lg' && 'sm:max-w-2xl',
          size === 'xl' && 'sm:max-w-3xl',
        )}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-slate-200 dark:bg-zinc-700 sm:hidden" aria-hidden />
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 dark:border-zinc-800 px-4 pb-3 pt-3 sm:px-5 sm:pt-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold text-slate-900 dark:text-zinc-50">
              {title}
            </h2>
            {description && <p className="mt-0.5 text-sm text-slate-500 dark:text-zinc-400">{description}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {headerExtra}
            <button
              type="button"
              data-close
              onClick={onClose}
              aria-label="Закрыть"
              className="-mr-2 -mt-1 inline-flex size-11 items-center justify-center rounded-lg text-slate-500 dark:text-zinc-400 transition-colors hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-zinc-50 sm:size-9"
            >
              <X size={18} strokeWidth={ICON_STROKE} />
            </button>
          </div>
        </div>
        <div className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5', bodyClassName)}>
          {children}
        </div>
        {footer && (
          <div className="flex flex-col-reverse gap-2 border-t border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#12141A] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:px-5">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
