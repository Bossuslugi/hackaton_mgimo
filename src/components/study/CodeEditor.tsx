'use client';

import { useRef, type KeyboardEvent } from 'react';
import { cn } from '@/lib/cn';

/**
 * Лёгкий редактор решения: JetBrains Mono, нумерация строк, Tab → 4 пробела.
 * Без внешних зависимостей — обычная <textarea> с синхронизированным жёлобом.
 */
export function CodeEditor({
  id,
  value,
  onChange,
  readOnly,
  placeholder,
  className,
  ariaLabel,
}: {
  id?: string;
  value: string;
  onChange?: (v: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}) {
  const gutter = useRef<HTMLDivElement>(null);
  const lines = Math.max(1, value.split('\n').length);

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (readOnly || e.key !== 'Tab' || e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return;
    e.preventDefault();
    const t = e.currentTarget;
    const { selectionStart: a, selectionEnd: b } = t;
    const next = `${value.slice(0, a)}    ${value.slice(b)}`;
    onChange?.(next);
    requestAnimationFrame(() => t.setSelectionRange(a + 4, a + 4));
  }

  return (
    <div
      className={cn(
        'flex min-h-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600/15',
        'dark:border-zinc-800 dark:bg-zinc-900 dark:focus-within:border-blue-500 dark:focus-within:ring-blue-500/20',
        className,
      )}
    >
      <div
        ref={gutter}
        aria-hidden
        className="code-editor select-none overflow-hidden border-r border-slate-200 bg-slate-100/60 px-2 py-3 text-right text-xs leading-6 text-slate-400 tabular-nums dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-600"
      >
        {Array.from({ length: lines }, (_, i) => (
          <div key={i}>{i + 1}</div>
        ))}
      </div>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        onKeyDown={onKeyDown}
        onScroll={(e) => {
          if (gutter.current) gutter.current.scrollTop = e.currentTarget.scrollTop;
        }}
        readOnly={readOnly}
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        wrap="off"
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="code-editor min-h-0 min-w-0 flex-1 resize-none overflow-auto bg-transparent px-3 py-3 text-[13px] leading-6 text-slate-900 outline-none placeholder:text-slate-400 dark:text-zinc-100 dark:placeholder:text-zinc-600"
      />
    </div>
  );
}
