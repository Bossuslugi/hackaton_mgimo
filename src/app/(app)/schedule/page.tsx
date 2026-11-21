'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, CalendarOff, CalendarPlus, DoorOpen, MapPin, Search, UserRound } from 'lucide-react';
import { Bookings } from '@/components/schedule/Bookings';
import { ScheduleSearch } from '@/components/schedule/ScheduleSearch';
import { StudentOnly } from '@/components/shell/StudentOnly';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { buildIcs, downloadIcs } from '@/lib/ics';
import { Card } from '@/components/ui/Card';
import { useNow } from '@/components/ui/Countdown';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Segmented } from '@/components/ui/Segmented';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/cn';
import { fmtToday, isoWeekday, LESSON_TYPE_LABEL, minutesUntil, WEEKDAYS_FULL, WEEKDAYS_SHORT } from '@/lib/format';
import { toLessons } from '@/lib/normalize';
import type { Lesson } from '@/lib/types';
import { ICON_STROKE } from '@/lib/ui';
import { useApi } from '@/lib/use-api';

type View = 'today' | 'week';

function weekDates(now = new Date()): Date[] {
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() - (isoWeekday(now) - 1));
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

const dayNum = new Intl.DateTimeFormat('ru-RU', { day: 'numeric' });
const dayMonth = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' });

type Section = 'my' | 'search' | 'booking';

export default function SchedulePage() {
  return (
    <StudentOnly allowTeacher>
      <ScheduleHub />
    </StudentOnly>
  );
}

/** Три режима: моё расписание, поиск по группам/аудиториям, бронирование помещений. */
function ScheduleHub() {
  const [section, setSection] = useState<Section>('my');
  return (
    <>
      <Segmented<Section>
        ariaLabel="Режим расписания"
        value={section}
        onChange={setSection}
        className="mb-5 max-w-full"
        options={[
          { value: 'my', label: <><CalendarDays size={14} strokeWidth={ICON_STROKE} className="hidden sm:inline" /> <span className="sm:hidden">Моё</span><span className="hidden sm:inline">Моё расписание</span></> },
          { value: 'search', label: <><Search size={14} strokeWidth={ICON_STROKE} className="hidden sm:inline" /> <span className="xl:hidden">Поиск</span><span className="hidden xl:inline">Группы и аудитории</span></> },
          { value: 'booking', label: <><DoorOpen size={14} strokeWidth={ICON_STROKE} className="hidden sm:inline" /> <span className="sm:hidden">Брони</span><span className="hidden sm:inline xl:hidden">Бронирование</span><span className="hidden xl:inline">Бронирование помещений</span></> },
        ]}
      />
      {section === 'my' ? (
        <Schedule />
      ) : section === 'search' ? (
        <>
          <PageHeader title="Поиск по группам и аудиториям" description="Где сейчас пара у другой группы и свободна ли аудитория" />
          <ScheduleSearch />
        </>
      ) : (
        <>
          <PageHeader title="Бронирование помещений" description="Коворкинги, проектные аудитории и переговорные кампуса — в 2 клика" />
          <Bookings />
        </>
      )}
    </>
  );
}

function Schedule() {
  const { data, error, loading, reload } = useApi<Lesson[]>('/api/schedule', toLessons);
  const toast = useToast();
  const exportIcs = useCallback(() => {
    if (!data?.length) return;
    downloadIcs(buildIcs(data));
    toast.success('Файл orbita-schedule.ics скачан', `${data.length} занятий текущей недели — откройте файл, чтобы добавить в календарь.`);
  }, [data, toast]);
  // переход из командной палитры: /schedule?export=ics
  const autoExport = useRef(false);
  useEffect(() => {
    if (autoExport.current || !data?.length) return;
    if (new URLSearchParams(window.location.search).get('export') === 'ics') {
      autoExport.current = true;
      exportIcs();
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [data, exportIcs]);
  const today = Math.min(isoWeekday(), 6);
  const isSunday = isoWeekday() === 7;
  const [view, setView] = useState<View>('today');
  const [day, setDay] = useState<number>(isSunday ? 1 : today);
  const dates = useMemo(() => weekDates(), []);

  const byDay = useMemo(() => {
    const m = new Map<number, Lesson[]>();
    for (let d = 1; d <= 6; d++) m.set(d, []);
    (data ?? []).forEach((l) => m.get(l.dayOfWeek)?.push(l));
    m.forEach((xs) => xs.sort((a, b) => a.startTime.localeCompare(b.startTime)));
    return m;
  }, [data]);

  const moves = (data ?? []).filter((l) => l.isRescheduled).length;

  return (
    <>
      <PageHeader
        eyebrow={fmtToday()}
        title="Расписание"
        description={
          data ? (
            <span className="inline-flex flex-wrap items-center gap-2">
              <span className="tabular-nums">
                {data.length} {data.length === 1 ? 'занятие' : data.length < 5 ? 'занятия' : 'занятий'} на неделе
              </span>
              {moves > 0 && <Badge tone="warning">Переносов: {moves}</Badge>}
            </span>
          ) : undefined
        }
        actions={
          <>
            <Button
              variant="secondary"
              onClick={exportIcs}
              disabled={!data?.length}
              icon={<CalendarPlus size={16} strokeWidth={ICON_STROKE} />}
              className="min-h-11 sm:min-h-10"
              title="Импорт в Apple Calendar, Google Calendar, Яндекс Календарь"
            >
              <span className="sm:hidden">.ics</span>
              <span className="hidden sm:inline">Экспорт в календарь (.ics)</span>
            </Button>
            <Segmented<View>
              ariaLabel="Период"
              value={view}
              onChange={setView}
              options={[
                { value: 'today', label: 'Сегодня' },
                { value: 'week', label: 'Неделя' },
              ]}
            />
          </>
        }
      />

      {loading && !data ? (
        <ScheduleSkeleton />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : view === 'today' ? (
        isSunday ? (
          <EmptyState
            icon={<CalendarOff size={20} strokeWidth={ICON_STROKE} />}
            title="Воскресенье — выходной"
            description="Расписание на неделю — во вкладке «Неделя»."
          />
        ) : (
          <DayList lessons={byDay.get(today) ?? []} isToday />
        )
      ) : (
        <>
          {/* mobile / tablet: табы Пн–Сб */}
          <div className="lg:hidden">
            <div role="tablist" aria-label="День недели" className="grid grid-cols-6 gap-1 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#12141A] p-1">
              {WEEKDAYS_SHORT.map((w, i) => {
                const d = i + 1;
                const active = d === day;
                const count = byDay.get(d)?.length ?? 0;
                const hasMove = byDay.get(d)?.some((l) => l.isRescheduled);
                return (
                  <button
                    key={w}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setDay(d)}
                    className={cn(
                      'relative flex min-h-14 flex-col items-center justify-center rounded-lg transition-colors',
                      active ? 'bg-blue-600 dark:bg-blue-500 text-white' : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800',
                    )}
                  >
                    <span className={cn('text-[11px]', active ? 'text-blue-100' : d === today && !isSunday ? 'font-semibold text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-zinc-400')}>
                      {w}
                    </span>
                    <span className="text-base font-semibold tabular-nums">{dayNum.format(dates[i])}</span>
                    <span
                      className={cn(
                        'absolute bottom-1.5 size-1 rounded-full',
                        count === 0 ? 'bg-transparent' : hasMove ? 'bg-amber-500' : active ? 'bg-white dark:bg-[#12141A]' : 'bg-slate-300 dark:bg-zinc-600',
                      )}
                      aria-hidden
                    />
                  </button>
                );
              })}
            </div>
            <div className="mt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                {WEEKDAYS_FULL[day - 1]} · <span className="tabular-nums">{dayMonth.format(dates[day - 1])}</span>
              </p>
              <DayList lessons={byDay.get(day) ?? []} isToday={day === today && !isSunday} />
            </div>
          </div>

          {/* desktop: вся неделя */}
          <div className="hidden gap-4 lg:grid lg:grid-cols-2 xl:grid-cols-3">
            {WEEKDAYS_FULL.map((w, i) => {
              const d = i + 1;
              const lessons = byDay.get(d) ?? [];
              const isToday = d === today && !isSunday;
              return (
                <Card key={w} className={cn('flex flex-col', isToday && 'border-blue-600 dark:border-blue-500')}>
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 px-4 py-3">
                    <p className="text-sm font-medium text-slate-900 dark:text-zinc-50">
                      {w}
                      <span className="ml-2 font-normal text-slate-500 dark:text-zinc-400 tabular-nums">{dayMonth.format(dates[i])}</span>
                    </p>
                    {isToday && <Badge tone="brand">Сегодня</Badge>}
                  </div>
                  {lessons.length === 0 ? (
                    <p className="flex flex-1 items-center justify-center px-4 py-8 text-sm text-slate-400 dark:text-zinc-500">Нет занятий</p>
                  ) : (
                    <ul className="divide-y divide-slate-200 dark:divide-zinc-800">
                      {lessons.map((l) => (
                        <li key={l.id}>
                          <LessonRow lesson={l} isToday={isToday} compact />
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}

function DayList({ lessons, isToday }: { lessons: Lesson[]; isToday: boolean }) {
  if (!lessons.length) {
    return (
      <EmptyState
        icon={<CalendarOff size={20} strokeWidth={ICON_STROKE} />}
        title="Занятий нет"
        description="В этот день пар не запланировано."
      />
    );
  }
  return (
    <Card className="overflow-hidden">
      <ul className="divide-y divide-slate-200 dark:divide-zinc-800">
        {lessons.map((l) => (
          <li key={l.id}>
            <LessonRow lesson={l} isToday={isToday} />
          </li>
        ))}
      </ul>
    </Card>
  );
}

function LessonRow({ lesson: l, isToday, compact }: { lesson: Lesson; isToday: boolean; compact?: boolean }) {
  useNow(60_000);
  const past = isToday && minutesUntil(l.endTime) <= 0;
  const live = isToday && minutesUntil(l.startTime) <= 0 && !past;

  return (
    <div
      className={cn(
        'relative flex gap-3 sm:gap-4',
        compact ? 'px-4 py-3' : 'px-4 py-4 sm:px-5',
        past && 'opacity-55',
        l.isRescheduled && 'bg-amber-50/40 dark:bg-amber-950/60',
      )}
    >
      {live && <span className="absolute inset-y-0 left-0 w-0.5 bg-blue-600 dark:bg-blue-500" aria-hidden />}
      <div className={cn('shrink-0 tabular-nums', compact ? 'w-11' : 'w-12 sm:w-14')}>
        <p className={cn('font-semibold text-slate-900 dark:text-zinc-50', compact ? 'text-sm' : 'text-base')}>{l.startTime}</p>
        <p className="text-xs text-slate-500 dark:text-zinc-400">{l.endTime}</p>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone="neutral">{LESSON_TYPE_LABEL[l.type]}</Badge>
          {l.isRescheduled && <Badge tone="warning">Перенос</Badge>}
          {live && <Badge tone="brand">Идёт сейчас</Badge>}
        </div>
        <p className={cn('mt-1.5 font-medium leading-snug text-slate-900 dark:text-zinc-50 break-words', compact ? 'text-sm' : 'text-[15px]')}>
          {l.subject}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600 dark:text-zinc-400">
          <span className="inline-flex items-center gap-1.5">
            <MapPin size={14} strokeWidth={ICON_STROKE} className="text-slate-400 dark:text-zinc-500" />
            {l.isRescheduled && l.oldRoom && (
              <s className="text-slate-400 dark:text-zinc-500 tabular-nums" aria-label={`Старая аудитория ${l.oldRoom}`}>
                {l.oldRoom}
              </s>
            )}
            <span className={cn('tabular-nums', l.isRescheduled && 'font-medium text-amber-700 dark:text-amber-300')}>{l.room}</span>
          </span>
          {l.teacher && !compact && (
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <UserRound size={14} strokeWidth={ICON_STROKE} className="shrink-0 text-slate-400 dark:text-zinc-500" />
              <span className="truncate">{l.teacher}</span>
            </span>
          )}
        </div>
        {l.isRescheduled && l.note && <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-300">{l.note}</p>}
      </div>
    </div>
  );
}

function ScheduleSkeleton() {
  return (
    <Card className="divide-y divide-slate-200 dark:divide-zinc-800" aria-busy="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex gap-4 px-4 py-4 sm:px-5">
          <div className="w-12 space-y-2">
            <Skeleton className="h-4 w-11" />
            <Skeleton className="h-3 w-9" />
          </div>
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </Card>
  );
}
