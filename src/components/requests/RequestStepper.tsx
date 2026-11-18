import { Check, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { fmtDateTime } from '@/lib/format';
import type { StudentRequest } from '@/lib/types';

type StepState = 'done' | 'current' | 'upcoming' | 'rejected';

function states(r: StudentRequest): StepState[] {
  switch (r.status) {
    case 'CREATED':
      return ['done', 'current', 'upcoming'];
    case 'PENDING':
      return ['done', 'current', 'upcoming'];
    case 'APPROVED':
      return ['done', 'done', 'done'];
    case 'REJECTED':
      return ['done', 'done', 'rejected'];
  }
}

/** Создано → На проверке → Подписано ЭЦП / Готово (§4 дизайн-системы). */
export function RequestStepper({ request, compact }: { request: StudentRequest; compact?: boolean }) {
  const st = states(request);
  const labels = ['Создано', 'На проверке', request.status === 'REJECTED' ? 'Отклонено' : 'Подписано ЭЦП'];
  const dates = [request.createdAt, request.status === 'CREATED' ? null : request.updatedAt ?? null, request.signedAt ?? (request.status === 'APPROVED' || request.status === 'REJECTED' ? request.updatedAt : null)];

  return (
    <ol className="grid grid-cols-3" aria-label="Этапы заявки">
      {st.map((s, i) => (
        <li key={i} className="relative min-w-0">
          {i > 0 && (
            <span
              aria-hidden
              className={cn(
                'absolute top-3 h-px',
                s === 'upcoming' ? 'bg-slate-200' : s === 'rejected' ? 'bg-red-200' : 'bg-blue-600',
              )}
              style={{ left: 'calc(-50% + 16px)', right: 'calc(50% + 16px)' }}
            />
          )}
          <div className="flex flex-col items-center text-center">
            <span
              className={cn(
                'relative z-10 inline-flex size-6 items-center justify-center rounded-full border text-[11px] font-medium tabular-nums',
                s === 'done' && 'border-blue-600 bg-blue-600 text-white',
                s === 'current' && 'border-blue-600 bg-white text-blue-600',
                s === 'upcoming' && 'border-slate-200 bg-white text-slate-400',
                s === 'rejected' && 'border-red-600 bg-red-600 text-white',
              )}
              aria-current={s === 'current' ? 'step' : undefined}
            >
              {s === 'done' ? (
                <Check size={13} strokeWidth={2.25} />
              ) : s === 'rejected' ? (
                <X size={13} strokeWidth={2.25} />
              ) : (
                i + 1
              )}
            </span>
            <span
              className={cn(
                'mt-1.5 max-w-full px-0.5 text-xs leading-tight',
                s === 'upcoming' ? 'text-slate-400' : s === 'rejected' ? 'font-medium text-red-700' : 'text-slate-900',
                s === 'current' && 'font-medium',
              )}
            >
              {labels[i]}
              {i === 2 && request.status !== 'REJECTED' && <span className="hidden sm:inline"> / Готово</span>}
            </span>
            {!compact && dates[i] && s !== 'upcoming' && (
              <span className="mt-0.5 text-[11px] text-slate-400 tabular-nums">{fmtDateTime(dates[i])}</span>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

