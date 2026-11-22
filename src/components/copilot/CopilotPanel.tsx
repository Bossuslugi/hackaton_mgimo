'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowUp, BookOpen, ClipboardList, RotateCcw, ScrollText, X } from 'lucide-react';
import { LogoMark } from '@/components/brand/Logo';
import { Markdown } from '@/components/ui/Markdown';
import { Segmented } from '@/components/ui/Segmented';
import { cn } from '@/lib/cn';
import type { CopilotMode } from '@/lib/types';
import { ICON_STROKE } from '@/lib/ui';
import { MODE_LABEL, useCopilot } from './CopilotProvider';

const MODE_INTRO: Record<CopilotMode, { title: string; text: string }> = {
  TUTOR: {
    title: 'Учебный тьютор',
    text: 'Разбирает задания по шагам, объясняет темы и готовит к рубежному контролю. Не решает за вас — помогает понять.',
  },
  DEANERY: {
    title: 'Деканат и регламенты',
    text: 'Отвечает по положениям о БРС, стипендиях, пересдачах и справках. Подскажет, какую заявку оформить.',
  },
};

/** Drawer 440px на desktop, fullscreen на mobile (§3 дизайн-системы). */
export function CopilotPanel() {
  const c = useCopilot();
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [c.messages.length, c.pending]);

  const { isOpen, close } = c;
  useEffect(() => {
    if (!isOpen) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 60);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('keydown', onKey);
    const mq = window.matchMedia('(max-width: 1023px)');
    const prev = document.body.style.overflow;
    if (mq.matches) document.body.style.overflow = 'hidden';
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [isOpen, close]);

  const submit = () => {
    if (!draft.trim() || c.pending) return;
    c.send(draft);
    setDraft('');
    if (inputRef.current) inputRef.current.style.height = '';
  };

  if (!c.isOpen) return null;

  return (
    <>
      {/* Слой выше рабочей зоны и шторок (z-50), чтобы Copilot открывался поверх них, но ниже тостов (z-60) */}
      <div className="fixed inset-0 z-[55] hidden bg-slate-900/20 dark:bg-black/40 lg:block" onClick={c.close} aria-hidden />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Орбита Copilot"
        className={cn(
          'fixed inset-0 z-[56] flex flex-col bg-white dark:bg-[#12141A]',
          'lg:inset-y-0 lg:left-auto lg:right-0 lg:w-[440px] lg:border-l lg:border-slate-200 dark:lg:border-zinc-800',
          'animate-[drawer-in_200ms_ease-out]',
        )}
      >
        {/* header */}
        <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-slate-200 dark:border-zinc-800 pl-4 pr-2 lg:h-16">
          <div className="flex min-w-0 items-center gap-2.5">
            <LogoMark size={24} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-zinc-50">Орбита Copilot</p>
              <p className="truncate text-xs text-slate-500 dark:text-zinc-400">{MODE_LABEL[c.mode]}</p>
            </div>
          </div>
          <div className="flex items-center">
            {c.messages.length > 0 && (
              <button
                type="button"
                onClick={c.reset}
                className="inline-flex size-11 items-center justify-center rounded-lg text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-zinc-50"
                aria-label="Новый диалог"
                title="Новый диалог"
              >
                <RotateCcw size={18} strokeWidth={ICON_STROKE} />
              </button>
            )}
            <button
              type="button"
              onClick={c.close}
              className="inline-flex size-11 items-center justify-center rounded-lg text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-zinc-50"
              aria-label="Закрыть Copilot"
            >
              <X size={20} strokeWidth={ICON_STROKE} />
            </button>
          </div>
        </div>

        {/* mode */}
        <div className="shrink-0 border-b border-slate-200 dark:border-zinc-800 px-4 py-3">
          <Segmented<CopilotMode>
            block
            ariaLabel="Режим ассистента"
            value={c.mode}
            onChange={c.setMode}
            options={[
              { value: 'TUTOR', label: 'Учебный тьютор' },
              { value: 'DEANERY', label: 'Деканат и регламенты' },
            ]}
          />
          {c.context && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 py-1.5 pl-2.5 pr-1">
              {c.context.kind === 'assignment' ? (
                <ClipboardList size={14} strokeWidth={ICON_STROKE} className="shrink-0 text-slate-500 dark:text-zinc-400" />
              ) : (
                <BookOpen size={14} strokeWidth={ICON_STROKE} className="shrink-0 text-slate-500 dark:text-zinc-400" />
              )}
              <p className="min-w-0 flex-1 truncate text-xs text-slate-600 dark:text-zinc-400">
                <span className="text-slate-500 dark:text-zinc-400">{c.context.kind === 'assignment' ? 'ДЗ' : 'Материал'} · </span>
                <span className="font-medium text-slate-900 dark:text-zinc-50">{c.context.title}</span>
              </p>
              <button
                type="button"
                onClick={c.clearContext}
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-slate-400 dark:text-zinc-500 hover:bg-white dark:hover:bg-[#12141A] hover:text-slate-700 dark:hover:text-zinc-300"
                aria-label="Убрать контекст"
              >
                <X size={14} strokeWidth={ICON_STROKE} />
              </button>
            </div>
          )}
        </div>

        {/* messages */}
        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          {c.messages.length === 0 ? (
            <div>
              <div className="rounded-xl border border-slate-200 dark:border-zinc-800 p-4">
                <div className="flex items-center gap-2 text-slate-900 dark:text-zinc-50">
                  {c.mode === 'TUTOR' ? (
                    <BookOpen size={16} strokeWidth={ICON_STROKE} />
                  ) : (
                    <ScrollText size={16} strokeWidth={ICON_STROKE} />
                  )}
                  <p className="text-sm font-medium">{MODE_INTRO[c.mode].title}</p>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-zinc-400">{MODE_INTRO[c.mode].text}</p>
              </div>
              <p className="mb-2 mt-5 text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-400">Попробуйте спросить</p>
              <ul className="divide-y divide-slate-200 dark:divide-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-800">
                {c.suggestions.map((s) => (
                  <li key={s}>
                    <button
                      type="button"
                      onClick={() => c.send(s)}
                      className="flex min-h-11 w-full items-center px-3.5 py-2.5 text-left text-sm text-slate-700 dark:text-zinc-300 transition-colors first:rounded-t-xl last:rounded-b-xl hover:bg-slate-50 dark:hover:bg-zinc-900 hover:text-slate-900 dark:hover:text-zinc-50"
                    >
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="space-y-5">
              {c.messages.map((m) =>
                m.role === 'user' ? (
                  <div key={m.id} className="flex justify-end">
                    <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-xl rounded-br-md bg-slate-100 dark:bg-zinc-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-zinc-50">
                      {m.content}
                    </p>
                  </div>
                ) : (
                  <div key={m.id} className="flex gap-2.5">
                    <LogoMark size={20} className="mt-0.5" />
                    <div className={cn('min-w-0 flex-1', m.error && 'text-red-700 dark:text-red-300')}>
                      {m.error ? (
                        <p className="rounded-lg border border-red-200 dark:border-red-800/60 bg-red-50 dark:bg-red-950/60 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                          {m.content}
                        </p>
                      ) : (
                        <Markdown source={m.content} compact />
                      )}
                    </div>
                  </div>
                ),
              )}
              {c.pending && (
                <div className="flex items-center gap-2.5" aria-live="polite">
                  <LogoMark size={20} />
                  <span className="flex gap-1" aria-label="Ассистент печатает">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="size-1.5 animate-pulse rounded-full bg-slate-400 dark:bg-zinc-500"
                        style={{ animationDelay: `${i * 150}ms` }}
                      />
                    ))}
                  </span>
                </div>
              )}
              {!c.pending && c.messages[c.messages.length - 1]?.role === 'assistant' && (
                <div className="flex flex-wrap gap-2 pl-[30px]">
                  {c.suggestions.slice(0, 3).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => c.send(s)}
                      className="min-h-9 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#12141A] px-3 py-1.5 text-left text-xs text-slate-700 dark:text-zinc-300 transition-colors hover:border-slate-300 dark:hover:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-900"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* composer */}
        <div className="shrink-0 border-t border-slate-200 dark:border-zinc-800 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="flex items-end gap-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#12141A] p-1.5 pl-3 focus-within:border-blue-600 dark:focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-600/15 dark:focus-within:ring-blue-500/15"
          >
            <textarea
              ref={inputRef}
              rows={1}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder={c.mode === 'TUTOR' ? 'Спросите про задание или тему…' : 'Спросите про регламенты, справки, стипендию…'}
              className="max-h-36 min-h-9 flex-1 resize-none bg-transparent py-2 text-sm text-slate-900 dark:text-zinc-50 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none"
              aria-label="Сообщение ассистенту"
            />
            <button
              type="submit"
              disabled={!draft.trim() || c.pending}
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 dark:bg-blue-500 text-white transition-colors hover:bg-blue-700 dark:hover:bg-blue-600 disabled:bg-slate-200 dark:disabled:bg-zinc-700 disabled:text-slate-400 dark:disabled:text-zinc-500"
              aria-label="Отправить"
            >
              <ArrowUp size={18} strokeWidth={ICON_STROKE} />
            </button>
          </form>
          <p className="mt-2 text-center text-[11px] text-slate-400 dark:text-zinc-500">ИИ может ошибаться. Сверяйтесь с регламентами деканата.</p>
        </div>
      </aside>
    </>
  );
}
