'use client';

import Link from 'next/link';
import { ArrowRight, CalendarDays, ClipboardCheck, Inbox, MapPin, MessagesSquare, Users } from 'lucide-react';
import { useSession } from '@/components/shell/SessionProvider';
import { StatsWidget } from '@/components/stats/StatsWidget';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { PageHeader } from '@/components/ui/PageHeader';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { cn } from '@/lib/cn';
import { firstName, fmtDateTime, fmtToday, greeting, LESSON_TYPE_LABEL, WEEKDAYS_FULL } from '@/lib/format';
import { toAssignments, toLesson, unwrapOne } from '@/lib/normalize';
import type { Assignment, Lesson } from '@/lib/types';
import { ICON_STROKE } from '@/lib/ui';
import { useApi } from '@/lib/use-api';

interface TeacherDash {
  nextLesson: Lesson | null;
  toReview: number;
  graded: number;
  issued: number;
  groups: string[];
  unreadMessages: number;
  recent: Assignment[];
}

function toTeacherDash(raw: unknown): TeacherDash {
  const r = unwrapOne(raw) ?? {};
  const st = (r.stats && typeof r.stats === 'object' ? r.stats : {}) as Record<string, unknown>;
  const n = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0);
  return {
    nextLesson: toLesson(r.nextLesson ?? r.nextClass ?? null),
    toReview: n(st.toReview),
    graded: n(st.graded),
    issued: n(st.assignmentsIssued),
    groups: Array.isArray(st.groups) ? st.groups.map(String) : [],
    unreadMessages: n(st.unreadMessages),
    recent: toAssignments(r.recentSubmissions ?? []),
  };
}

const linkCls = 'inline-flex min-h-11 items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 sm:min-h-0';

export function TeacherDashboard() {
  const { user } = useSession();
  const { data, error, loading, reload } = useApi<TeacherDash>('/api/dashboard', toTeacherDash);

  return (
    <>
      <PageHeader
        eyebrow={fmtToday()}
        title={`${greeting()}, ${firstName(user.fullName)} ${user.fullName.split(/\s+/)[2] ?? ''}`.trim()}
        description={data ? `На проверке: ${data.toReview} · группы ${data.groups.join(', ') || '—'}` : 'Собираем сводку…'}
      />
      {loading && !data ? (
        <div className="grid gap-3 lg:grid-cols-3 lg:gap-4">
          <SkeletonCard lines={3} className="lg:col-span-2" />
          <SkeletonCard lines={3} />
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : data ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6 lg:gap-4">
          <Card className="flex flex-col p-4 sm:col-span-2 sm:p-5 lg:col-span-4">
            <CardHeader title="Ближайшая пара" icon={<CalendarDays size={14} strokeWidth={ICON_STROKE} />} />
            {data.nextLesson ? (
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:gap-6">
                <div className="shrink-0">
                  <p className="text-3xl font-semibold tracking-tight text-slate-900 tabular-nums dark:text-zinc-50">{data.nextLesson.startTime}</p>
                  <p className="text-sm text-slate-500 tabular-nums dark:text-zinc-400">
                    {WEEKDAYS_FULL[data.nextLesson.dayOfWeek - 1]} · до {data.nextLesson.endTime}
                  </p>
                </div>
                <div className="min-w-0 sm:border-l sm:border-slate-200 dark:sm:border-zinc-800 sm:pl-6 sm:dark:border-zinc-800">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge tone="neutral">{LESSON_TYPE_LABEL[data.nextLesson.type]}</Badge>
                    {data.nextLesson.group && <Badge tone="brand" className="tabular-nums">{data.nextLesson.group}</Badge>}
                  </div>
                  <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-zinc-50">{data.nextLesson.subject}</p>
                  <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-slate-600 tabular-nums dark:text-zinc-400">
                    <MapPin size={14} strokeWidth={ICON_STROKE} className="text-slate-400 dark:text-zinc-500" />
                    {data.nextLesson.room}
                  </p>
                </div>
              </div>
            ) : (
              <p className="py-6 text-sm text-slate-500 dark:text-zinc-400">На сегодня занятий больше нет.</p>
            )}
            <div className="mt-auto pt-3">
              <Link href="/schedule" className={linkCls}>
                Расписание и аудитории <ArrowRight size={14} strokeWidth={ICON_STROKE} />
              </Link>
            </div>
          </Card>

          <Card className="grid grid-cols-2 gap-3 p-4 sm:p-5 lg:col-span-2">
            <Mini label="На проверке" value={data.toReview} icon={<Inbox size={14} strokeWidth={ICON_STROKE} />} warn={data.toReview > 0} />
            <Mini label="Оценено" value={data.graded} icon={<ClipboardCheck size={14} strokeWidth={ICON_STROKE} />} />
            <Mini label="Выдано" value={data.issued} icon={<Users size={14} strokeWidth={ICON_STROKE} />} />
            <Mini label="Сообщения" value={data.unreadMessages} icon={<MessagesSquare size={14} strokeWidth={ICON_STROKE} />} />
          </Card>

          <Card className="flex flex-col p-4 sm:col-span-2 sm:p-5 lg:col-span-6">
            <CardHeader
              title="Свежие решения"
              icon={<Inbox size={14} strokeWidth={ICON_STROKE} />}
              action={
                <Link href="/study" className={linkCls}>
                  Кабинет <ArrowRight size={14} strokeWidth={ICON_STROKE} />
                </Link>
              }
            />
            {data.recent.length === 0 ? (
              <p className="py-6 text-sm text-slate-500 dark:text-zinc-400">Новых решений пока нет.</p>
            ) : (
              <ul className="mt-2 divide-y divide-slate-200 dark:divide-zinc-800">
                {data.recent.slice(0, 5).map((a) => (
                  <li key={a.id} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900 dark:text-zinc-50">
                        {a.student?.fullName ?? 'Студент'} <span className="font-normal text-slate-500 tabular-nums dark:text-zinc-400">· {a.student?.group ?? a.group}</span>
                      </p>
                      <p className="truncate text-sm text-slate-600 dark:text-zinc-400">{a.title}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <Badge tone={a.status === 'GRADED' ? 'success' : 'warning'}>{a.status === 'GRADED' ? `${a.gradeAwarded ?? a.score} / ${a.points}` : 'На проверке'}</Badge>
                      {a.submittedAt && <p className="mt-1 text-xs text-slate-500 tabular-nums dark:text-zinc-400">{fmtDateTime(a.submittedAt)}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <StatsWidget className="sm:col-span-2 lg:col-span-6" />
        </div>
      ) : null}
    </>
  );
}

function Mini({ label, value, icon, warn }: { label: string; value: number; icon: React.ReactNode; warn?: boolean }) {
  return (
    <div className="min-w-0">
      <p className={cn('flex items-start gap-1.5 text-xs leading-tight text-slate-500 dark:text-zinc-400', warn && 'text-amber-700 dark:text-amber-300')}>
        {icon}
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums dark:text-zinc-50">{value}</p>
    </div>
  );
}
