'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarSearch, CircleCheck, DoorOpen, MapPin, Search, UserRound, Users } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { useNow } from '@/components/ui/Countdown';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Field';
import { Segmented } from '@/components/ui/Segmented';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/cn';
import { isoWeekday, LESSON_TYPE_LABEL, minutesUntil, WEEKDAYS_FULL } from '@/lib/format';
import { toScheduleSearch } from '@/lib/normalize-v2';
import type { Lesson, ScheduleSearch as Result } from '@/lib/types';
import { ICON_STROKE } from '@/lib/ui';
import { useApi } from '@/lib/use-api';

type Mode = 'group' | 'room';

const PRESET: Record<Mode, string[]> = {
  group: ['М3203', 'Э4102', 'И2101'],
  room: ['Ауд. 301', 'Ауд. 402', 'Лаб. 105', 'Коворкинг А'],
};

/** Поиск по группам и аудиториям: GET /api/schedule?mode=group|room&query=… */
export function ScheduleSearch() {
  const [mode, setMode] = useState<Mode>('group');
  const [input, setInput] = useState(PRESET.group[0]);
  const [query, setQuery] = useState(PRESET.group[0]);
  const [known, setKnown] = useState<{ groups: string[]; rooms: string[] }>({ groups: [], rooms: [] });

  // поиск с задержкой 300 мс после ввода
  useEffect(() => {
    const t = window.setTimeout(() => setQuery(input.trim()), 300);
    return () => window.clearTimeout(t);
  }, [input]);

  const path = query ? `/api/schedule?mode=${mode}&query=${encodeURIComponent(query)}` : null;
  const { data, error, loading, reload } = useApi<Result>(path, toScheduleSearch);

  useEffect(() => {
    if (data && (data.availableGroups.length || data.availableRooms.length)) {
      setKnown({ groups: data.availableGroups, rooms: data.availableRooms });
    }
  }, [data]);

  const chips = useMemo(() => {
    const fromApi = mode === 'group' ? known.groups : known.rooms;
    const merged = [...PRESET[mode], ...fromApi.filter((x) => !PRESET[mode].includes(x))];
    return merged.slice(0, mode === 'group' ? 6 : 8);
  }, [mode, known]);

  const pick = (v: string) => {
    setInput(v);
    setQuery(v);
  };

  return (
    <>
      <Card className="mb-4 p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Segmented<Mode>
            ariaLabel="Искать по"
            value={mode}
            onChange={(m) => {
              setMode(m);
              pick(PRESET[m][0]);
            }}
            options={[
              { value: 'group', label: 'По группе' },
              { value: 'room', label: 'По аудитории' },
            ]}
          />
          <div className="relative min-w-0 flex-1">
            <Search size={16} strokeWidth={ICON_STROKE} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={50}
              placeholder={mode === 'group' ? 'Номер группы, например и2101' : 'Аудитория или корпус, например Лаб. 105'}
              aria-label={mode === 'group' ? 'Номер группы' : 'Аудитория'}
              className="pl-9 tabular-nums"
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Быстрый выбор">
          {chips.map((c) => {
            const on = c.toLowerCase() === query.toLowerCase();
            return (
              <button
                key={c}
                type="button"
                aria-pressed={on}
                onClick={() => pick(c)}
                className={cn(
                  'min-h-9 rounded-lg border px-3 text-sm tabular-nums transition-colors',
                  on
                    ? 'border-blue-200 bg-blue-50 font-medium text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-400'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-zinc-800 dark:bg-[#12141A] dark:text-zinc-400 dark:hover:bg-zinc-900',
                )}
              >
                {c}
              </button>
            );
          })}
        </div>
      </Card>

      {!query ? (
        <EmptyState icon={<CalendarSearch size={20} strokeWidth={ICON_STROKE} />} title="Введите группу или аудиторию" />
      ) : loading && !data ? (
        <Card className="space-y-3 p-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </Card>
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : data ? (
        <Results lessons={data.lessons} mode={mode} query={query} />
      ) : null}
    </>
  );
}

function Results({ lessons, mode, query }: { lessons: Lesson[]; mode: Mode; query: string }) {
  useNow(60_000);
  const today = isoWeekday();
  const byDay = useMemo(() => {
    const m = new Map<number, Lesson[]>();
    lessons.forEach((l) => m.set(l.dayOfWeek, [...(m.get(l.dayOfWeek) ?? []), l]));
    m.forEach((xs) => xs.sort((a, b) => a.startTime.localeCompare(b.startTime)));
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [lessons]);

  if (!lessons.length) {
    return (
      <EmptyState
        icon={mode === 'room' ? <DoorOpen size={20} strokeWidth={ICON_STROKE} /> : <Users size={20} strokeWidth={ICON_STROKE} />}
        title={mode === 'room' ? `«${query}»: занятий нет` : `Группа «${query}» не найдена`}
        description={mode === 'room' ? 'На этой неделе помещение свободно — его можно забронировать во вкладке «Бронирование».' : 'Проверьте номер группы, например М3203.'}
      />
    );
  }

  const todays = lessons.filter((l) => l.dayOfWeek === today);
  const now = todays.find((l) => minutesUntil(l.startTime) <= 0 && minutesUntil(l.endTime) > 0);
  const next = todays.filter((l) => minutesUntil(l.startTime) > 0).sort((a, b) => a.startTime.localeCompare(b.startTime))[0];
  const groups = Array.from(new Set(lessons.map((l) => l.group).filter(Boolean)));

  return (
    <>
      {/* статус «сейчас» */}
      <div
        className={cn(
          'mb-4 flex items-start gap-3 rounded-xl border p-4',
          now
            ? 'border-amber-200 bg-amber-50 dark:border-amber-800/60 dark:bg-amber-950/60'
            : 'border-emerald-200 bg-emerald-50 dark:border-emerald-800/60 dark:bg-emerald-950/60',
        )}
        role="status"
      >
        {now ? (
          <MapPin size={18} strokeWidth={ICON_STROKE} className="mt-0.5 shrink-0 text-amber-700 dark:text-amber-300" />
        ) : (
          <CircleCheck size={18} strokeWidth={ICON_STROKE} className="mt-0.5 shrink-0 text-emerald-700 dark:text-emerald-300" />
        )}
        <div className="min-w-0 text-sm">
          {now ? (
            <p className="text-amber-800 dark:text-amber-200">
              <b className="font-semibold">Сейчас идёт пара:</b> {now.subject} ·{' '}
              <span className="tabular-nums">
                {now.startTime}–{now.endTime}
              </span>{' '}
              · {mode === 'room' ? <span className="tabular-nums">группа {now.group}</span> : <span className="tabular-nums">{now.room}</span>}
            </p>
          ) : (
            <p className="text-emerald-800 dark:text-emerald-200">
              <b className="font-semibold">{mode === 'room' ? 'Сейчас свободна.' : 'Сейчас пар нет.'}</b>{' '}
              {next ? (
                <>
                  Следующая пара в <span className="tabular-nums">{next.startTime}</span> — {next.subject}
                  {mode === 'room' ? (
                    <span className="tabular-nums"> (группа {next.group})</span>
                  ) : (
                    <span className="tabular-nums"> ({next.room})</span>
                  )}
                  .
                </>
              ) : (
                'Сегодня больше занятий не запланировано.'
              )}
            </p>
          )}
          {mode === 'group' && groups.length > 1 && (
            <p className="mt-1 text-xs text-slate-600 tabular-nums dark:text-zinc-400">Найдено групп: {groups.join(', ')}</p>
          )}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2 lg:gap-4">
        {byDay.map(([d, xs]) => (
          <Card key={d} className={cn('overflow-hidden', d === today && 'border-blue-600 dark:border-blue-500')}>
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-zinc-800">
              <p className="text-sm font-medium text-slate-900 dark:text-zinc-50">{WEEKDAYS_FULL[d - 1] ?? `День ${d}`}</p>
              {d === today && <Badge tone="brand">Сегодня</Badge>}
            </div>
            <ul className="divide-y divide-slate-200 dark:divide-zinc-800">
              {xs.map((l) => {
                const live = d === today && minutesUntil(l.startTime) <= 0 && minutesUntil(l.endTime) > 0;
                return (
                  <li key={l.id} className="relative flex gap-3 px-4 py-3">
                    {live && <span className="absolute inset-y-0 left-0 w-0.5 bg-blue-600 dark:bg-blue-500" aria-hidden />}
                    <div className="w-11 shrink-0 tabular-nums">
                      <p className="text-sm font-semibold text-slate-900 dark:text-zinc-50">{l.startTime}</p>
                      <p className="text-xs text-slate-500 dark:text-zinc-400">{l.endTime}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge tone="neutral">{LESSON_TYPE_LABEL[l.type]}</Badge>
                        {l.group && <Badge tone="brand" className="tabular-nums">{l.group}</Badge>}
                        {l.isRescheduled && <Badge tone="warning">Перенос</Badge>}
                        {live && <Badge tone="brand">Идёт сейчас</Badge>}
                      </div>
                      <p className="mt-1 text-sm font-medium leading-snug text-slate-900 break-words dark:text-zinc-50">{l.subject}</p>
                      <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-600 dark:text-zinc-400">
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <MapPin size={12} strokeWidth={ICON_STROKE} />
                          {l.building ? `${l.building}, ` : ''}
                          {l.room}
                        </span>
                        {l.teacher && (
                          <span className="inline-flex min-w-0 items-center gap-1">
                            <UserRound size={12} strokeWidth={ICON_STROKE} className="shrink-0" />
                            <span className="truncate">{l.teacher}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        ))}
      </div>
    </>
  );
}
