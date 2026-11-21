'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { CalendarCheck2, CalendarX2, Check, DoorOpen, Info, MapPin, Minus, Plus, Users, X } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input, Label } from '@/components/ui/Field';
import { Sheet } from '@/components/ui/Sheet';
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { api, ApiError, post } from '@/lib/api';
import { cn } from '@/lib/cn';
import { fmtYmd, plural } from '@/lib/format';
import { toBooking, toBookings } from '@/lib/normalize-v2';
import type { Booking, BookingsData, Room } from '@/lib/types';
import { ICON_STROKE } from '@/lib/ui';
import { useApi } from '@/lib/use-api';

const PURPOSES = ['Подготовка к хакатону', 'Репетиция выступления', 'Командный проект', 'Подготовка к РК', 'Встреча студсовета'];
const weekdayShort = new Intl.DateTimeFormat('ru-RU', { weekday: 'short' });
const dayNum = new Intl.DateTimeFormat('ru-RU', { day: 'numeric' });

function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}
const asDate = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
};

interface Draft {
  room: Room;
  timeSlot: string;
}

/** Бронирование помещений: GET/POST /api/bookings, DELETE /api/bookings/[id]. */
export function Bookings() {
  const [date, setDate] = useState<string | null>(null);
  const state = useApi<BookingsData>(date ? `/api/bookings?date=${date}` : '/api/bookings', toBookings);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [cancelling, setCancelling] = useState<Booking | null>(null);
  const data = state.data;
  const today = data?.today ?? null;
  const current = date ?? data?.date ?? null;
  const days = useMemo(() => (today ? Array.from({ length: 10 }, (_, i) => addDays(today, i)) : []), [today]);

  const active = (data?.myBookings ?? []).filter((b) => b.status === 'CONFIRMED' && (!today || b.date >= today));
  const past = (data?.myBookings ?? []).filter((b) => !active.includes(b));

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start">
      <div className="min-w-0">
        {/* выбор даты */}
        <div className="-mx-4 mb-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
          <div role="radiogroup" aria-label="Дата бронирования" className="flex w-max gap-1.5">
            {days.length === 0
              ? Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-14 w-12 rounded-lg" />)
              : days.map((d) => {
                  const on = d === current;
                  const dt = asDate(d);
                  const sunday = dt.getDay() === 0;
                  return (
                    <button
                      key={d}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      aria-label={fmtYmd(d)}
                      onClick={() => setDate(d)}
                      className={cn(
                        'flex min-h-14 w-12 flex-col items-center justify-center rounded-lg border transition-colors',
                        on
                          ? 'border-blue-600 bg-blue-600 text-white dark:border-blue-500 dark:bg-blue-500'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-800 dark:bg-[#12141A] dark:text-zinc-300 dark:hover:bg-zinc-900',
                        sunday && !on && 'text-slate-400 dark:text-zinc-500',
                      )}
                    >
                      <span className={cn('text-[11px]', on ? 'text-blue-100' : 'text-slate-500 dark:text-zinc-400')}>
                        {d === today ? 'Сег.' : weekdayShort.format(dt)}
                      </span>
                      <span className="text-base font-semibold tabular-nums">{dayNum.format(dt)}</span>
                    </button>
                  );
                })}
          </div>
        </div>

        {state.loading && !data ? (
          <div className="grid gap-3 md:grid-cols-2">
            <SkeletonCard lines={4} />
            <SkeletonCard lines={4} />
          </div>
        ) : state.error ? (
          <ErrorState error={state.error} onRetry={state.reload} />
        ) : data ? (
          <>
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Помещения кампуса · <span className="tabular-nums">{current ? fmtYmd(current) : ''}</span>
            </p>
            <div className={cn('grid gap-3 md:grid-cols-2 lg:gap-4 xl:grid-cols-1 2xl:grid-cols-2', state.loading && 'opacity-60')}>
              {data.rooms.map((r) => (
                <RoomCard key={r.roomName} room={r} onPick={(timeSlot) => setDraft({ room: r, timeSlot })} />
              ))}
            </div>
          </>
        ) : null}
      </div>

      {/* мои брони */}
      <Card className="order-first p-4 sm:p-5 xl:sticky xl:top-24 xl:order-none">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-400">Мои брони</h2>
          <span className="text-xs text-slate-500 tabular-nums dark:text-zinc-400">{active.length} / 3 активных</span>
        </div>
        {!data ? (
          <Skeleton className="mt-4 h-16 w-full" />
        ) : active.length === 0 && past.length === 0 ? (
          <div className="py-6 text-center">
            <CalendarCheck2 size={20} strokeWidth={ICON_STROKE} className="mx-auto text-slate-400 dark:text-zinc-500" />
            <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">Броней пока нет. Выберите свободный слот в каталоге.</p>
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {[...active, ...past.slice(0, 4)].map((b, i) => (
              <li
                key={b.id ?? `${b.roomName}-${b.date}-${b.timeSlot}-${i}`}
                className={cn(
                  'rounded-lg border border-slate-200 p-3 dark:border-zinc-800',
                  b.status === 'CANCELLED' && 'opacity-60',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-zinc-50">{b.roomName}</p>
                    <p className="mt-0.5 text-xs text-slate-500 tabular-nums dark:text-zinc-400">
                      {fmtYmd(b.date)} · {b.timeSlot}
                    </p>
                  </div>
                  {b.status === 'CANCELLED' ? (
                    <Badge tone="neutral">Отменена</Badge>
                  ) : active.includes(b) ? (
                    <Badge tone="success">Подтверждена</Badge>
                  ) : (
                    <Badge tone="neutral">Прошла</Badge>
                  )}
                </div>
                {b.purpose && (
                  <p className="mt-1.5 truncate text-xs text-slate-600 dark:text-zinc-400">
                    {b.purpose} · <span className="tabular-nums">{b.participantsCount} чел.</span>
                  </p>
                )}
                {active.includes(b) && b.id && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCancelling(b)}
                    icon={<X size={14} strokeWidth={ICON_STROKE} />}
                    className="-ml-2 mt-1 min-h-11 text-red-700 hover:bg-red-50 hover:text-red-800 dark:text-red-300 dark:hover:bg-red-950/60 dark:hover:text-red-200 sm:min-h-9"
                  >
                    Отменить бронь
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 flex gap-1.5 text-xs leading-relaxed text-slate-500 dark:text-zinc-400">
          <Info size={14} strokeWidth={ICON_STROKE} className="mt-0.5 shrink-0" />
          Бронь — на 1 пару (1,5 ч), до 14 дней вперёд, не больше 3 активных. Отменяйте заранее, чтобы слот достался другим.
        </p>
      </Card>

      <BookingSheet
        draft={draft}
        date={current}
        onClose={() => setDraft(null)}
        onConflict={() => state.reload()}
        onBooked={(b) => {
          setDraft(null);
          state.setData((d) =>
            d
              ? {
                  ...d,
                  myBookings: [b, ...d.myBookings],
                  rooms: d.rooms.map((r) =>
                    r.roomName === b.roomName && d.date === b.date
                      ? { ...r, slots: r.slots.map((s) => (s.timeSlot === b.timeSlot ? { ...s, taken: true, available: false } : s)) }
                      : r,
                  ),
                }
              : d,
          );
        }}
      />

      <CancelSheet
        booking={cancelling}
        onClose={() => setCancelling(null)}
        onCancelled={() => {
          setCancelling(null);
          state.reload();
        }}
      />
    </div>
  );
}

function RoomCard({ room: r, onPick }: { room: Room; onPick: (slot: string) => void }) {
  const free = r.slots.filter((s) => s.available).length;
  return (
    <Card className="flex flex-col p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold leading-snug text-slate-900 break-words dark:text-zinc-50">{r.roomName}</h3>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500 dark:text-zinc-400">
            <MapPin size={12} strokeWidth={ICON_STROKE} className="shrink-0" />
            <span className="truncate">{r.building}</span>
          </p>
        </div>
        <Badge tone="neutral" icon={<Users size={12} strokeWidth={ICON_STROKE} />} className="tabular-nums">
          до {r.capacity}
        </Badge>
      </div>
      {r.description && <p className="mt-2 line-clamp-2 text-sm text-slate-600 dark:text-zinc-400">{r.description}</p>}
      {r.equipment.length > 0 && (
        <ul className="mt-2.5 flex flex-wrap gap-1" aria-label="Оборудование">
          {r.equipment.map((e) => (
            <li key={e} className="rounded-md border border-slate-200 px-1.5 py-0.5 text-[11px] text-slate-600 dark:border-zinc-800 dark:text-zinc-400">
              {e}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs font-medium text-slate-500 dark:text-zinc-400">Слоты</p>
        <p className="text-xs text-slate-500 tabular-nums dark:text-zinc-400">
          свободно {free} из {r.slots.length}
        </p>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {r.slots.map((s) => (
          <button
            key={s.timeSlot}
            type="button"
            disabled={!s.available}
            onClick={() => onPick(s.timeSlot)}
            aria-label={`${s.timeSlot}: ${s.taken ? 'занято' : s.available ? 'свободно, забронировать' : 'время прошло'}`}
            className={cn(
              'flex min-h-11 flex-col items-center justify-center rounded-lg border px-1 text-xs tabular-nums transition-colors sm:min-h-10',
              s.available
                ? 'border-slate-200 bg-white text-slate-900 hover:border-blue-600 hover:bg-blue-50 hover:text-blue-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-blue-500 dark:hover:bg-blue-500/10 dark:hover:text-blue-400'
                : s.taken
                  ? 'cursor-not-allowed border-transparent bg-slate-100 text-slate-400 line-through dark:bg-zinc-800/60 dark:text-zinc-600'
                  : 'cursor-not-allowed border-dashed border-slate-200 text-slate-400 dark:border-zinc-800 dark:text-zinc-600',
            )}
          >
            {s.timeSlot.replace(' – ', '–')}
          </button>
        ))}
      </div>
    </Card>
  );
}

function BookingSheet({
  draft,
  date,
  onClose,
  onBooked,
  onConflict,
}: {
  draft: Draft | null;
  date: string | null;
  onClose: () => void;
  onBooked: (b: Booking) => void;
  onConflict: () => void;
}) {
  const toast = useToast();
  const [purpose, setPurpose] = useState('');
  const [people, setPeople] = useState(2);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const cap = draft?.room.capacity || 50;

  useEffect(() => {
    if (draft) {
      setError(null);
      setPeople((p) => Math.min(Math.max(1, p), draft.room.capacity || 50));
    }
  }, [draft]);

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    if (!draft || !date) return;
    if (purpose.trim().length < 3) {
      setError('Опишите цель бронирования (от 3 символов).');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const raw = await post('/api/bookings', {
        roomName: draft.room.roomName,
        building: draft.room.building,
        date,
        timeSlot: draft.timeSlot,
        purpose: purpose.trim(),
        participantsCount: people,
      });
      const b = toBooking(raw) ?? {
        roomName: draft.room.roomName,
        building: draft.room.building,
        date,
        timeSlot: draft.timeSlot,
        participantsCount: people,
        status: 'CONFIRMED' as const,
        isMine: true,
        purpose: purpose.trim(),
      };
      // микро-анимация успеха на кнопке, затем закрытие шторки
      setDone(true);
      window.setTimeout(() => {
        setDone(false);
        setPurpose('');
        onBooked(b);
        toast.success('Помещение забронировано', `${b.roomName} · ${fmtYmd(b.date)}, ${b.timeSlot}`);
      }, 450);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Не удалось забронировать помещение.';
      setError(msg);
      if (err instanceof ApiError && err.status === 409) onConflict();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={draft !== null}
      onClose={onClose}
      title="Бронирование помещения"
      description={draft && date ? `${draft.room.roomName} · ${fmtYmd(date)}, ${draft.timeSlot}` : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} className="min-h-11 sm:min-h-0">
            Отмена
          </Button>
          <Button
            onClick={() => !done && void submit()}
            loading={busy}
            icon={<Check size={16} strokeWidth={ICON_STROKE} className={done ? 'animate-[check-in_200ms_ease-out]' : undefined} />}
            className={cn('min-h-11 sm:min-h-0', done && 'animate-[pop_300ms_ease-out] border-emerald-600 bg-emerald-600 hover:border-emerald-600 hover:bg-emerald-600 dark:border-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-600')}
          >
            {done ? 'Забронировано' : 'Забронировать'}
          </Button>
        </>
      }
    >
      {draft && (
        <form onSubmit={submit} noValidate className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
            <DoorOpen size={18} strokeWidth={ICON_STROKE} className="mt-0.5 shrink-0 text-slate-500 dark:text-zinc-400" />
            <div className="min-w-0 text-sm">
              <p className="font-medium text-slate-900 dark:text-zinc-50">{draft.room.roomName}</p>
              <p className="text-slate-600 tabular-nums dark:text-zinc-400">
                {draft.room.building} · до {draft.room.capacity} чел.
              </p>
            </div>
          </div>
          <div>
            <Label htmlFor="b-purpose">Цель</Label>
            <Input id="b-purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} maxLength={200} placeholder="Например, подготовка к хакатону" data-autofocus />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {PURPOSES.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPurpose(p)}
                  aria-pressed={purpose === p}
                  className={cn(
                    'min-h-9 rounded-full border px-3 text-xs transition-colors',
                    purpose === p
                      ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-400'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900',
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="b-people" hint={`максимум ${cap}`}>
              Количество человек
            </Label>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => setPeople((p) => Math.max(1, p - 1))} aria-label="Меньше" square className="max-sm:size-11">
                <Minus size={16} strokeWidth={ICON_STROKE} />
              </Button>
<div className="w-20">
              <Input
                id="b-people"
                type="number"
                inputMode="numeric"
                min={1}
                max={cap}
                value={people}
                onChange={(e) => setPeople(Math.min(cap, Math.max(1, Number(e.target.value) || 1)))}
                className="text-center tabular-nums"
              />
              </div>
              <Button variant="secondary" onClick={() => setPeople((p) => Math.min(cap, p + 1))} aria-label="Больше" square className="max-sm:size-11">
                <Plus size={16} strokeWidth={ICON_STROKE} />
              </Button>
              <span className="text-sm text-slate-500 dark:text-zinc-400">{plural(people, ['человек', 'человека', 'человек'])}</span>
            </div>
          </div>
          {error && (
            <p role="alert" className="flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800/60 dark:bg-red-950/60 dark:text-red-300">
              <CalendarX2 size={16} strokeWidth={ICON_STROKE} className="mt-0.5 shrink-0" />
              {error}
            </p>
          )}
          <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
        </form>
      )}
    </Sheet>
  );
}

function CancelSheet({ booking, onClose, onCancelled }: { booking: Booking | null; onClose: () => void; onCancelled: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  async function cancel() {
    if (!booking?.id) return;
    setBusy(true);
    try {
      await api(`/api/bookings/${encodeURIComponent(booking.id)}`, 'DELETE');
      toast.success('Бронь отменена', `${booking.roomName} · ${fmtYmd(booking.date)}, ${booking.timeSlot}`);
      onCancelled();
    } catch (e) {
      toast.error('Не удалось отменить бронь', e instanceof ApiError ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet
      open={booking !== null}
      onClose={onClose}
      title="Отменить бронь?"
      description={booking ? `${booking.roomName} · ${fmtYmd(booking.date)}, ${booking.timeSlot}` : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} className="min-h-11 sm:min-h-0">
            Оставить
          </Button>
          <Button variant="danger" onClick={() => void cancel()} loading={busy} className="min-h-11 sm:min-h-0">
            Отменить бронь
          </Button>
        </>
      }
    >
      <p className="text-sm text-slate-600 dark:text-zinc-400">Слот освободится и станет доступен другим студентам.</p>
    </Sheet>
  );
}

