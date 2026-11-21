'use client';

import { useMemo, useState } from 'react';
import { CalendarCheck2, Check, Clock, MapPin, PartyPopper, Ticket, Users } from 'lucide-react';
import { useSession } from '@/components/shell/SessionProvider';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { QRCode } from '@/components/ui/QRCode';
import { Sheet } from '@/components/ui/Sheet';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { ApiError, post } from '@/lib/api';
import { cn } from '@/lib/cn';
import { fmtYmd } from '@/lib/format';
import { toCampusEvent, toEvents, type CampusEvent, type EventsData } from '@/lib/normalize-v3';
import { ICON_STROKE } from '@/lib/ui';
import { useApi } from '@/lib/use-api';

const CATEGORIES = ['Хакатон', 'Митап', 'Карьера', 'Наука', 'Клубы'];
const monthShort = new Intl.DateTimeFormat('ru-RU', { month: 'short' });
const weekday = new Intl.DateTimeFormat('ru-RU', { weekday: 'short' });

const asDate = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

/** Вкладка «Мероприятия вуза»: GET /api/campus/events, POST /api/campus/events/[id]/toggle. */
export function Events() {
  const toast = useToast();
  const state = useApi<EventsData>('/api/campus/events', toEvents);
  const [cat, setCat] = useState('Все');
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [justDone, setJustDone] = useState<string | null>(null);

  const data = state.data;
  const categories = data?.categories.length ? data.categories : CATEGORIES;
  const list = useMemo(
    () => (data?.events ?? []).filter((e) => cat === 'Все' || e.category === cat).sort((a, b) => Number(a.isPast) - Number(b.isPast)),
    [data, cat],
  );
  const ticket = ticketId ? (data?.events.find((e) => e.id === ticketId) ?? null) : null;

  const patch = (id: string, f: (e: CampusEvent) => CampusEvent) =>
    state.setData((d) => (d ? { ...d, events: d.events.map((e) => (e.id === id ? f(e) : e)) } : d));

  /** Optimistic UI: состояние кнопки и счётчик меняются сразу, при ошибке — откат. */
  async function toggle(ev: CampusEvent) {
    if (ev.pending) return;
    const registering = !ev.isRegistered;
    const before = ev;
    patch(ev.id, (e) => ({
      ...e,
      pending: true,
      isRegistered: registering,
      registeredCount: e.registeredCount + (registering ? 1 : -1),
      spotsLeft: Math.max(0, e.spotsLeft + (registering ? -1 : 1)),
    }));
    try {
      const raw = (await post(`/api/campus/events/${encodeURIComponent(ev.id)}/toggle`)) as { action?: string; event?: unknown } | null;
      const fresh = toCampusEvent(raw?.event ?? null);
      patch(ev.id, (e) => ({ ...(fresh ?? e), pending: false }));
      if (registering) {
        setJustDone(ev.id);
        window.setTimeout(() => setJustDone((x) => (x === ev.id ? null : x)), 900);
        toast.success('Вы записаны', `${ev.title} · билет ${fresh?.ticketCode ?? ''}`.trim());
      } else {
        toast.info('Запись отменена', ev.title);
        setTicketId(null);
      }
    } catch (e) {
      patch(ev.id, () => ({ ...before, pending: false }));
      toast.error(registering ? 'Не удалось записаться' : 'Не удалось отменить запись', e instanceof ApiError ? e.message : undefined);
      if (e instanceof ApiError && e.status === 409) state.reload();
    }
  }

  return (
    <>
      <div className="-mx-4 mb-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
        <div role="group" aria-label="Категория" className="flex w-max gap-1.5">
          {['Все', ...categories].map((c) => {
            const on = c === cat;
            const count = c === 'Все' ? data?.events.length : data?.events.filter((e) => e.category === c).length;
            return (
              <button
                key={c}
                type="button"
                aria-pressed={on}
                onClick={() => setCat(c)}
                className={cn(
                  'inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors',
                  on
                    ? 'border-blue-600 bg-blue-600 text-white dark:border-blue-500 dark:bg-blue-500'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-zinc-800 dark:bg-[#12141A] dark:text-zinc-400 dark:hover:bg-zinc-900',
                )}
              >
                {c}
                {count !== undefined && <span className={cn('text-xs tabular-nums', on ? 'text-blue-100' : 'text-slate-400 dark:text-zinc-500')}>{count}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {data && data.myRegistrations > 0 && (
        <p className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-600 dark:text-zinc-400">
          <CalendarCheck2 size={16} strokeWidth={ICON_STROKE} className="text-emerald-600 dark:text-emerald-400" />
          Вы записаны на <span className="font-medium text-slate-900 tabular-nums dark:text-zinc-50">{data.events.filter((e) => e.isRegistered).length}</span>{' '}
          мероприятия
        </p>
      )}

      {state.loading && !data ? (
        <div className="grid gap-3 md:grid-cols-2 lg:gap-4">
          <SkeletonCard lines={4} />
          <SkeletonCard lines={4} />
        </div>
      ) : state.error ? (
        <ErrorState error={state.error} onRetry={state.reload} />
      ) : list.length === 0 ? (
        <EmptyState icon={<PartyPopper size={20} strokeWidth={ICON_STROKE} />} title="В этой категории пока нет событий" description="Загляните позже — афиша обновляется каждую неделю." />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 lg:gap-4">
          {list.map((e) => (
            <li key={e.id}>
              <EventCard e={e} celebrate={justDone === e.id} onToggle={() => void toggle(e)} onTicket={() => setTicketId(e.id)} />
            </li>
          ))}
        </ul>
      )}

      <TicketSheet event={ticket} onClose={() => setTicketId(null)} onCancel={(e) => void toggle(e)} />
    </>
  );
}

function EventCard({ e, celebrate, onToggle, onTicket }: { e: CampusEvent; celebrate: boolean; onToggle: () => void; onTicket: () => void }) {
  const d = asDate(e.date);
  const fill = e.capacity ? Math.min(100, (e.registeredCount / e.capacity) * 100) : 0;
  const full = e.spotsLeft <= 0 && !e.isRegistered;
  return (
    <Card className={cn('flex h-full flex-col p-4 sm:p-5', e.isPast && 'opacity-60')}>
      <div className="flex gap-4">
        <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-lg border border-slate-200 bg-slate-50 py-2 dark:border-zinc-800 dark:bg-zinc-900">
          <span className="text-[11px] uppercase text-slate-500 dark:text-zinc-400">{monthShort.format(d).replace('.', '')}</span>
          <span className="text-xl font-semibold leading-tight text-slate-900 tabular-nums dark:text-zinc-50">{d.getDate()}</span>
          <span className="text-[11px] text-slate-500 dark:text-zinc-400">{weekday.format(d)}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="brand">{e.category}</Badge>
            {e.isPast && <Badge tone="neutral">Прошло</Badge>}
            {e.isRegistered && !e.isPast && (
              <Badge tone="success" icon={<Check size={12} strokeWidth={ICON_STROKE} />}>
                Вы записаны
              </Badge>
            )}
          </div>
          <h3 className="mt-1.5 text-[15px] font-semibold leading-snug text-slate-900 break-words dark:text-zinc-50">{e.title}</h3>
          <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-600 dark:text-zinc-400">
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Clock size={12} strokeWidth={ICON_STROKE} />
              {e.timeRange}
            </span>
            <span className="inline-flex min-w-0 items-center gap-1">
              <MapPin size={12} strokeWidth={ICON_STROKE} className="shrink-0" />
              <span className="truncate">{e.location}</span>
            </span>
          </p>
        </div>
      </div>
      {e.description && <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-slate-600 dark:text-zinc-400">{e.description}</p>}
      {e.tags.length > 0 && (
        <ul className="mt-2.5 flex flex-wrap gap-1">
          {e.tags.map((t) => (
            <li key={t} className="rounded-md border border-slate-200 px-1.5 py-0.5 text-[11px] text-slate-600 dark:border-zinc-800 dark:text-zinc-400">
              #{t}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
          <span className="inline-flex items-center gap-1">
            <Users size={12} strokeWidth={ICON_STROKE} />
            {e.organizer}
          </span>
          <span className="tabular-nums">
            <span className="font-medium text-slate-900 dark:text-zinc-50">{e.registeredCount}</span> / {e.capacity} мест
          </span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800">
          <div
            className={cn('h-full origin-left rounded-full transition-transform duration-300 ease-out', fill >= 90 ? 'bg-amber-500' : 'bg-blue-600 dark:bg-blue-500')}
            style={{ transform: `scaleX(${fill / 100})` }}
          />
        </div>
      </div>
      <div className="mt-auto flex gap-2 pt-4">
        {e.isRegistered ? (
          <Button
            onClick={onTicket}
            disabled={e.pending}
            icon={<Ticket size={16} strokeWidth={ICON_STROKE} className={celebrate ? 'animate-[check-in_220ms_ease-out]' : undefined} />}
            className={cn(
              'min-h-11 flex-1 border-emerald-600 bg-emerald-600 hover:border-emerald-700 hover:bg-emerald-700 dark:border-emerald-600 dark:bg-emerald-600 dark:hover:border-emerald-700 dark:hover:bg-emerald-700 sm:min-h-10',
              celebrate && 'animate-[pop_300ms_ease-out]',
            )}
          >
            Вы записаны • Билет
          </Button>
        ) : (
          <Button
            onClick={onToggle}
            disabled={e.isPast || full || e.pending}
            icon={<CalendarCheck2 size={16} strokeWidth={ICON_STROKE} />}
            className="min-h-11 flex-1 sm:min-h-10"
          >
            {e.isPast ? 'Событие прошло' : full ? 'Мест нет' : 'Записаться в 1 клик'}
          </Button>
        )}
      </div>
    </Card>
  );
}

function TicketSheet({ event: e, onClose, onCancel }: { event: CampusEvent | null; onClose: () => void; onCancel: (e: CampusEvent) => void }) {
  const { user } = useSession();
  return (
    <Sheet
      open={e !== null}
      onClose={onClose}
      title="Электронный билет"
      description={e ? e.title : undefined}
      footer={
        e && (
          <>
            {!e.isPast && (
              <Button variant="danger" onClick={() => onCancel(e)} loading={e.pending} className="min-h-11 sm:mr-auto sm:min-h-0">
                Отменить запись
              </Button>
            )}
            <Button variant="secondary" onClick={onClose} className="min-h-11 sm:min-h-0">
              Готово
            </Button>
          </>
        )
      }
    >
      {e && (
        <div className="mx-auto max-w-sm">
          <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-zinc-800">
            <div className="flex items-center justify-between bg-slate-50 px-4 py-3 dark:bg-zinc-900">
              <Badge tone="brand">{e.category}</Badge>
              <span className="text-xs text-slate-500 tabular-nums dark:text-zinc-400">
                {fmtYmd(e.date)} · {e.timeRange}
              </span>
            </div>
            <div className="flex flex-col items-center gap-3 px-4 py-5">
              <div className="rounded-lg border border-slate-200 bg-white dark:bg-white p-2 dark:border-zinc-700">
                <QRCode value={`ORBITA-EVENT|${e.ticketCode ?? e.id}|${user.id}`} size={168} title="QR-код билета" />
              </div>
              <p className="font-mono text-lg font-semibold tracking-wider text-slate-900 tabular-nums dark:text-zinc-50">{e.ticketCode ?? 'Оформляем…'}</p>
            </div>
            {/* линия отрыва билета */}
            <div className="relative border-t border-dashed border-slate-300 dark:border-zinc-700" aria-hidden />
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 px-4 py-4 text-sm">
              <dt className="text-xs text-slate-500 dark:text-zinc-400">Участник</dt>
              <dd className="truncate text-right text-slate-900 dark:text-zinc-100">{user.fullName}</dd>
              <dt className="text-xs text-slate-500 dark:text-zinc-400">Место</dt>
              <dd className="text-right text-slate-900 dark:text-zinc-100">{e.location}</dd>
              <dt className="text-xs text-slate-500 dark:text-zinc-400">Организатор</dt>
              <dd className="text-right text-slate-900 dark:text-zinc-100">{e.organizer}</dd>
            </dl>
          </div>
          <p className="mt-3 text-center text-xs text-slate-500 dark:text-zinc-400">Покажите QR-код на входе — волонтёр отсканирует его.</p>
        </div>
      )}
    </Sheet>
  );
}
