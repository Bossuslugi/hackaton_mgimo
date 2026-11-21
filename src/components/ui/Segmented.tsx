'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  count?: number;
  disabled?: boolean;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  block,
  size = 'md',
  ariaLabel,
  className,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (v: T) => void;
  block?: boolean;
  size?: 'sm' | 'md';
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn('inline-flex min-w-0 rounded-lg bg-slate-100 dark:bg-zinc-900 p-1', block && 'flex w-full', className)}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border font-medium transition-colors duration-150',
              size === 'md' ? 'px-3' : 'px-2.5',
              size === 'md' ? 'min-h-9 text-sm' : 'min-h-8 text-xs',
              block && 'flex-1',
              active
                ? 'border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-50'
                : 'border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-50',
              'disabled:opacity-40',
            )}
          >
            <span className="truncate">{o.label}</span>
            {o.count !== undefined && (
              <span className={cn('tabular-nums text-xs', active ? 'text-slate-500 dark:text-zinc-400' : 'text-slate-400 dark:text-zinc-500')}>{o.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
