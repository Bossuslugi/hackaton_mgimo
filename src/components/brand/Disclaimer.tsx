import { Info } from 'lucide-react';
import { cn } from '@/lib/cn';
import { ICON_STROKE } from '@/lib/ui';

export const DISCLAIMER_TEXT =
  'Концепт для конкурса «Цифровой деканат будущего». Не является официальным сервисом вуза. Все персональные данные вымышленные.';

export function Disclaimer({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        'flex items-start gap-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-800 px-3 py-2.5 text-xs leading-relaxed text-slate-500 dark:text-zinc-400',
        className,
      )}
    >
      <Info size={14} strokeWidth={ICON_STROKE} className="mt-px shrink-0" />
      <span>{DISCLAIMER_TEXT}</span>
    </p>
  );
}
