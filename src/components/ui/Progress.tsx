import { cn } from '@/lib/cn';

export function Progress({
  value,
  max = 100,
  marker,
  tone = 'brand',
  className,
}: {
  value: number;
  max?: number;
  /** Вертикальная отметка порога, например 85 баллов */
  marker?: number;
  tone?: 'brand' | 'success' | 'warning' | 'danger' | 'muted';
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const fill = {
    brand: 'bg-blue-600 dark:bg-blue-500',
    success: 'bg-emerald-600',
    warning: 'bg-amber-500',
    danger: 'bg-red-600',
    muted: 'bg-slate-400 dark:bg-zinc-500',
  }[tone];
  return (
    <div
      className={cn('relative h-1.5 w-full rounded-full bg-slate-100 dark:bg-zinc-800', className)}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
    >
      <div className={cn('h-full rounded-full transition-[width] duration-200', fill)} style={{ width: `${pct}%` }} />
      {marker !== undefined && (
        <div
          className="absolute -top-1 h-3.5 w-px bg-slate-900 dark:bg-zinc-100"
          style={{ left: `${Math.min(100, (marker / max) * 100)}%` }}
          aria-hidden
        />
      )}
    </div>
  );
}
