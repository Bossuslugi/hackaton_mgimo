import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('min-w-0 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#12141A]', className)} {...rest} />;
}

export function CardHeader({
  title,
  icon,
  action,
  className,
}: {
  title: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex min-h-6 items-center justify-between gap-3', className)}>
      <div className="flex min-w-0 items-center gap-2 text-slate-500 dark:text-zinc-400">
        {icon}
        <h2 className="truncate text-xs font-medium uppercase tracking-wider">{title}</h2>
      </div>
      {action}
    </div>
  );
}
