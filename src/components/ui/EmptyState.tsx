import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#12141A] px-6 py-10 text-center',
        className,
      )}
    >
      {icon && <div className="text-slate-400 dark:text-zinc-500">{icon}</div>}
      <p className="mt-3 text-sm font-medium text-slate-900 dark:text-zinc-50">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-zinc-400">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
