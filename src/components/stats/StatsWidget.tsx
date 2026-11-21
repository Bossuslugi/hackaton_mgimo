'use client';

import { useState } from 'react';
import { Activity, Clock, Table2, Trophy } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { cn } from '@/lib/cn';
import { fmtHours, isoWeekday, plural } from '@/lib/format';
import { toStats } from '@/lib/normalize-v2';
import type { StatsData } from '@/lib/types';
import { ICON_STROKE } from '@/lib/ui';
import { useApi } from '@/lib/use-api';

/*
 * «Время в вузе и учебная активность» — GET /api/stats.
 * Палитра двух серий проверена валидатором dataviz (light + dark):
 *   пары — blue-600 / blue-500, самостоятельная работа — teal-600.
 */
const SERIES = {
  study: { label: 'Пары', cls: 'bg-blue-600 dark:bg-blue-500' },
  self: { label: 'Самостоятельная работа и коворкинг', short: 'Самост.', cls: 'bg-teal-600' },
};

export function StatsWidget({ className, compact }: { className?: string; compact?: boolean }) {
  const { data, error, loading, reload } = useApi<StatsData>('/api/stats', toStats);
  if (loading && !data) return <SkeletonCard className={className} lines={6} />;
  if (error) return <div className={className}><ErrorState error={error} onRetry={reload} /></div>;
  if (!data) return null;
  return <StatsCard s={data} className={className} compact={compact} />;
}

function StatsCard({ s, className, compact }: { s: StatsData; className?: string; compact?: boolean }) {
  const [table, setTable] = useState(false);
  const isStudent = s.role === 'STUDENT';
  return (
    <Card className={cn('flex flex-col p-4 sm:p-5', className)}>
      <CardHeader
        title="Время в вузе и учебная активность"
        icon={<Activity size={14} strokeWidth={ICON_STROKE} />}
        action={
          <button
            type="button"
            onClick={() => setTable((v) => !v)}
            aria-pressed={table}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
          >
            <Table2 size={14} strokeWidth={ICON_STROKE} />
            {table ? 'Диаграмма' : 'Таблица'}
          </button>
        }
      />

      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Kpi label="В кампусе за неделю" value={fmtHours(s.campusHoursWeek)} unit="ч" icon={<Clock size={12} strokeWidth={ICON_STROKE} />} />
        <Kpi label="За семестр" value={fmtHours(s.campusHoursSemester)} unit="ч" />
        {isStudent && s.rankInGroup !== null && s.groupSize ? (
          <Kpi
            label="Рейтинг в группе"
            value={`Топ-${s.rankInGroup}`}
            unit={`из ${s.groupSize}`}
            icon={<Trophy size={12} strokeWidth={ICON_STROKE} />}
            className="col-span-2 sm:col-span-1"
          />
        ) : (
          <Kpi label="Аудиторных часов" value={fmtHours(s.classHoursWeek)} unit="ч/нед" className="col-span-2 sm:col-span-1" />
        )}
      </dl>

      <div className={cn('mt-5 grid gap-5', !compact && 'md:grid-cols-[minmax(0,1fr)_auto]')}>
        {table ? <ActivityTable s={s} /> : <WeekBars s={s} />}
        {s.attendancePercent !== null && <AttendanceRing value={s.attendancePercent} />}
      </div>

      {!compact && s.timeBreakdown.length > 0 && <Breakdown items={s.timeBreakdown} />}
    </Card>
  );
}

function Kpi({
  label,
  value,
  unit,
  icon,
  className,
}: {
  label: string;
  value: string;
  unit?: string;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-900', className)}>
      <dt className="flex items-center gap-1 truncate text-xs text-slate-500 dark:text-zinc-400">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 flex items-baseline gap-1">
        <span className="text-2xl font-semibold tracking-tight text-slate-900 tabular-nums dark:text-zinc-50">{value}</span>
        {unit && <span className="text-xs text-slate-500 tabular-nums dark:text-zinc-400">{unit}</span>}
      </dd>
    </div>
  );
}

/** Столбцы Пн–Сб: пары снизу, самостоятельная работа сверху, 2px зазор между сегментами. */
function WeekBars({ s }: { s: StatsData }) {
  const [hover, setHover] = useState<number | null>(null);
  const days = s.weeklyActivity.filter((d) => d.dayOfWeek >= 1 && d.dayOfWeek <= 6);
  const max = Math.max(1, ...days.map((d) => d.campusHours));
  const top = Math.ceil(max / 2) * 2;
  const today = isoWeekday();
  const H = 132;

  return (
    <figure className="min-w-0">
      <figcaption className="sr-only">Часы в кампусе по дням недели: пары и самостоятельная работа</figcaption>
      <div className="flex gap-2">
        {/* шкала */}
        <div className="flex flex-col justify-between pb-6 text-right text-[11px] text-slate-400 tabular-nums dark:text-zinc-500" style={{ height: H + 24 }} aria-hidden>
          <span>{top} ч</span>
          <span>{top / 2}</span>
          <span>0</span>
        </div>
        <div className="relative min-w-0 flex-1">
          <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-slate-200 dark:border-zinc-800" aria-hidden />
          <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-slate-200 dark:border-zinc-800" style={{ top: H / 2 }} aria-hidden />
          <ul className="relative flex items-end gap-1.5 sm:gap-2.5" style={{ height: H + 24 }}>
            {days.map((d, i) => {
              const self = Math.max(0, d.campusHours - d.studyHours);
              const studyH = (d.studyHours / top) * H;
              const selfH = (self / top) * H;
              const isHover = hover === i;
              return (
                <li
                  key={d.dayOfWeek}
                  className="relative flex h-full min-w-0 flex-1 cursor-default flex-col items-center justify-end"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  tabIndex={0}
                  aria-label={`${d.day}: всего ${fmtHours(d.campusHours)} ч, пары ${fmtHours(d.studyHours)} ч, самостоятельно ${fmtHours(self)} ч`}
                >
                  {isHover && (
                    <div
                      role="tooltip"
                      className="absolute bottom-full z-10 mb-1 w-max rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                    >
                      <p className="font-medium text-slate-900 dark:text-zinc-50">
                        {d.day} · <span className="tabular-nums">{fmtHours(d.campusHours)} ч</span>
                      </p>
                      <p className="mt-1 flex items-center gap-1.5 text-slate-600 dark:text-zinc-400">
                        <span className={cn('size-2 rounded-sm', SERIES.study.cls)} />
                        Пары <span className="ml-auto pl-3 tabular-nums">{fmtHours(d.studyHours)}</span>
                      </p>
                      <p className="flex items-center gap-1.5 text-slate-600 dark:text-zinc-400">
                        <span className={cn('size-2 rounded-sm', SERIES.self.cls)} />
                        {SERIES.self.short} <span className="ml-auto pl-3 tabular-nums">{fmtHours(self)}</span>
                      </p>
                    </div>
                  )}
                  <div className={cn('flex w-full max-w-9 flex-col gap-[2px] transition-opacity', hover !== null && !isHover && 'opacity-50')}>
                    {selfH > 0 && <div className={cn('w-full rounded-t-[4px]', SERIES.self.cls)} style={{ height: selfH }} />}
                    {studyH > 0 && (
                      <div className={cn('w-full', SERIES.study.cls, selfH > 0 ? '' : 'rounded-t-[4px]')} style={{ height: studyH }} />
                    )}
                  </div>
                  <span
                    className={cn(
                      'mt-1.5 h-[18px] text-[11px] leading-[18px]',
                      d.dayOfWeek === today ? 'font-semibold text-slate-900 dark:text-zinc-50' : 'text-slate-500 dark:text-zinc-400',
                    )}
                  >
                    {d.day}
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="absolute inset-x-0 border-t border-slate-300 dark:border-zinc-700" style={{ top: H }} aria-hidden />
        </div>
      </div>
      <Legend />
    </figure>
  );
}

function Legend() {
  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-zinc-400">
      {[SERIES.study, SERIES.self].map((x) => (
        <li key={x.label} className="inline-flex items-center gap-1.5">
          <span className={cn('size-2.5 rounded-sm', x.cls)} aria-hidden />
          {x.label}
        </li>
      ))}
    </ul>
  );
}

function ActivityTable({ s }: { s: StatsData }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-slate-200 dark:border-zinc-800">
      <table className="w-full text-left text-sm tabular-nums">
        <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-zinc-900 dark:text-zinc-400">
          <tr>
            <th className="px-3 py-2 font-medium">День</th>
            <th className="px-3 py-2 text-right font-medium">Пары</th>
            <th className="px-3 py-2 text-right font-medium">Самост.</th>
            <th className="px-3 py-2 text-right font-medium">Всего</th>
          </tr>
        </thead>
        <tbody>
          {s.weeklyActivity.map((d) => (
            <tr key={d.dayOfWeek} className="border-t border-slate-200 text-slate-700 dark:border-zinc-800 dark:text-zinc-300">
              <td className="px-3 py-1.5">{d.day}</td>
              <td className="px-3 py-1.5 text-right">{fmtHours(d.studyHours)}</td>
              <td className="px-3 py-1.5 text-right">{fmtHours(Math.max(0, d.campusHours - d.studyHours))}</td>
              <td className="px-3 py-1.5 text-right font-medium text-slate-900 dark:text-zinc-50">{fmtHours(d.campusHours)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Кольцо посещаемости: одно значение, трек — нейтральный, заполнение — brand. */
function AttendanceRing({ value }: { value: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const tone = pct >= 85 ? 'text-blue-600 dark:text-blue-500' : pct >= 70 ? 'text-amber-500' : 'text-red-600 dark:text-red-400';
  return (
    <div className="flex items-center gap-4 md:flex-col md:justify-center md:gap-2 md:px-2">
      <svg viewBox="0 0 80 80" className="size-24 shrink-0 -rotate-90" role="img" aria-label={`Посещаемость ${pct}%`}>
        <circle cx="40" cy="40" r={r} fill="none" strokeWidth="7" className="stroke-slate-100 dark:stroke-zinc-800" />
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          strokeWidth="7"
          strokeLinecap="round"
          stroke="currentColor"
          strokeDasharray={`${(pct / 100) * c} ${c}`}
          className={tone}
        />
        <text
          x="40"
          y="40"
          transform="rotate(90 40 40)"
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-slate-900 text-[17px] font-semibold tabular-nums dark:fill-zinc-50"
        >
          {pct}%
        </text>
      </svg>
      <div className="md:text-center">
        <p className="text-sm font-medium text-slate-900 dark:text-zinc-50">Посещаемость</p>
        <p className="text-xs text-slate-500 dark:text-zinc-400">{pct >= 85 ? 'выше порога допуска' : 'ниже рекомендуемых 85%'}</p>
      </div>
    </div>
  );
}

/** Структура времени: ранжированные горизонтальные полосы одного тона (величина, не идентичность). */
function Breakdown({ items }: { items: StatsData['timeBreakdown'] }) {
  const sorted = [...items].sort((a, b) => b.hours - a.hours);
  const max = Math.max(1, ...sorted.map((t) => t.percent));
  return (
    <div className="mt-5 border-t border-slate-200 pt-4 dark:border-zinc-800">
      <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-400">Структура недели</p>
      <ul className="mt-3 space-y-2.5">
        {sorted.map((t) => (
          <li key={t.category} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[13rem_minmax(0,1fr)_8rem]">
            <span className="truncate text-sm text-slate-700 dark:text-zinc-300">{t.category}</span>
            <span className="whitespace-nowrap text-right text-xs text-slate-500 tabular-nums dark:text-zinc-400 sm:order-last">
              {fmtHours(t.hours)} {plural(Math.round(t.hours), ['час', 'часа', 'часов'])} · {t.percent}%
            </span>
            <span className="col-span-2 h-1.5 rounded-full bg-slate-100 dark:bg-zinc-800 sm:col-span-1">
              <span className="block h-full rounded-full bg-blue-600 dark:bg-blue-500" style={{ width: `${(t.percent / max) * 100}%` }} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
