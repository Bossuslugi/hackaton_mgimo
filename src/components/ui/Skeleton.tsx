import { cn } from '@/lib/cn';

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-md bg-slate-100 dark:bg-zinc-800', className)} />;
}

export function SkeletonCard({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#12141A] p-4 sm:p-5', className)}>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-4 h-6 w-2/3" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn('mt-3 h-3', i % 2 ? 'w-1/2' : 'w-5/6')} />
      ))}
    </div>
  );
}
