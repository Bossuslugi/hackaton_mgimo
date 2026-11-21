import { cn } from '@/lib/cn';

/** Знак «Орбита»: две пересекающиеся орбиты и спутник. Собственная графика, не логотип вуза. */
export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={cn('shrink-0 text-slate-900 dark:text-zinc-50', className)}
      aria-hidden
    >
      <ellipse cx="16" cy="16" rx="13.25" ry="6" transform="rotate(-32 16 16)" stroke="currentColor" strokeWidth="1.75" />
      <ellipse cx="16" cy="16" rx="13.25" ry="6" transform="rotate(32 16 16)" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="16" cy="16" r="2.25" fill="currentColor" />
      <circle cx="26.4" cy="8.6" r="2.6" strokeWidth="1.5" className="fill-blue-600 stroke-white dark:fill-blue-500 dark:stroke-zinc-950" />
    </svg>
  );
}

export function Logo({ className, subtitle = true }: { className?: string; subtitle?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark />
      <span className="flex flex-col leading-none">
        <span className="text-[15px] font-semibold tracking-tight text-slate-900 dark:text-zinc-50">Орбита</span>
        {subtitle && <span className="mt-1 text-[11px] text-slate-500 dark:text-zinc-400">Цифровой деканат</span>}
      </span>
    </span>
  );
}
