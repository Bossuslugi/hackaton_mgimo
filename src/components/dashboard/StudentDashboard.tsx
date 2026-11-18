'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CircleCheck,
  Clock,
  DoorOpen,
  FileText,
  Flame,
  Gauge,
  MapPin,
  Megaphone,
  ScrollText,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { useCopilot } from '@/components/copilot/CopilotProvider';
import { CertificateModal } from '@/components/requests/CertificateModal';
import { RequestStepper } from '@/components/requests/RequestStepper';
import { useSession } from '@/components/shell/SessionProvider';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Countdown, useNow } from '@/components/ui/Countdown';
import { ErrorState } from '@/components/ui/ErrorState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Progress } from '@/components/ui/Progress';
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton';
import { STIPEND_THRESHOLD } from '@/lib/brs';
import { cn } from '@/lib/cn';
import {
  firstName,
  fmtToday,
  greeting,
  inMinutesLabel,
  isoWeekday,
  LESSON_TYPE_LABEL,
  minutesUntil,
  plural,
  REQUEST_STATUS_LABEL,
  REQUEST_STATUS_TONE,
  REQUEST_TYPE_LABEL,
  WEEKDAYS_FULL,
} from '@/lib/format';
import { toDashboard } from '@/lib/normalize';
import type { Announcement, Assignment, DashboardData, Lesson, StudentRequest } from '@/lib/types';
import { ICON_STROKE } from '@/lib/ui';
import { useApi } from '@/lib/use-api';

const linkCls =
  'inline-flex min-h-11 items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 sm:min-h-0';

export function StudentDashboard() {
  const { user } = useSession();
  const { data, error, loading, reload } = useApi<DashboardData>('/api/dashboard', toDashboard);
  const [cert, setCert] = useState<StudentRequest | null>(null);

  const hot = data?.deadlines.filter((d) => d.status === 'ACTIVE' || d.status === 'OVERDUE') ?? [];
  const summary = data
    ? [
        hot.length ? `${hot.length} ${plural(hot.length, ['дедлайн', 'дедлайна', 'дедлайнов'])} в работе` : 'дедлайнов нет',
        data.nextLesson ? `ближайшая пара в ${data.nextLesson.startTime}` : 'пар сегодня больше нет',
      ].join(' · ')
    : undefined;

  return (
    <>
      <PageHeader
        eyebrow={fmtToday()}
        title={`${greeting()}, ${firstName(user.fullName)}`}
        description={summary ? <>Фокус дня: {summary}</> : 'Собираем фокус дня…'}
      />

      {loading && !data ? (
        <DashboardSkeleton />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : data ? (
        <div className="space-y-3 lg:space-y-4">
          {data.announcements.length > 0 && <Announcements items={data.announcements} />}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6 lg:gap-4">
            <NextLessonCard lesson={data.nextLesson} className="sm:col-span-2 lg:col-span-4" />
            <AverageCard value={data.averageScore} className="lg:col-span-2" />
            <DeadlinesCard items={hot} className="sm:col-span-2 lg:col-span-3 lg:row-span-2" />
            <RequestCard request={data.activeRequest} onOpen={setCert} className="lg:col-span-3" />
            <CopilotCard className="lg:col-span-3" />
          </div>
        </div>
      ) : null}

      <CertificateModal request={cert} user={user} onClose={() => setCert(null)} />
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6 lg:gap-4" aria-busy="true">
      <div className="rounded-xl border border-slate-200 bg-white p-5 sm:col-span-2 lg:col-span-4">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="mt-5 h-8 w-40" />
        <Skeleton className="mt-3 h-5 w-2/3" />
        <div className="mt-5 flex gap-2">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-24" />
        </div>
      </div>
      <SkeletonCard className="lg:col-span-2" lines={2} />
      <SkeletonCard className="sm:col-span-2 lg:col-span-3" lines={5} />
      <SkeletonCard className="lg:col-span-3" lines={2} />
      <SkeletonCard className="lg:col-span-3" lines={2} />
    </div>
  );
}

function Announcements({ items }: { items: Announcement[] }) {
  const top = items.slice(0, 2);
  return (
    <div className="space-y-2">
      {top.map((a) => {
        const urgent = a.type === 'URGENT';
        const Icon = urgent ? Megaphone : DoorOpen;
        return (
          <div
            key={a.id}
            className={cn(
              'flex gap-3 rounded-xl border p-3.5 sm:p-4',
              urgent ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50',
            )}
            role="status"
          >
            <Icon
              size={18}
              strokeWidth={ICON_STROKE}
              className={cn('mt-0.5 shrink-0', urgent ? 'text-red-700' : 'text-amber-700')}
            />
            <div className="min-w-0">
              <p className={cn('text-sm font-medium', urgent ? 'text-red-800' : 'text-amber-800')}>{a.title}</p>
              <p className={cn('mt-0.5 text-sm break-words', urgent ? 'text-red-700' : 'text-amber-700')}>{a.body}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function NextLessonCard({ lesson, className }: { lesson: Lesson | null; className?: string }) {
  useNow(30_000);
  if (!lesson) {
    return (
      <Card className={cn('flex flex-col p-4 sm:p-5', className)}>
        <CardHeader title="Ближайшая пара" icon={<CalendarDays size={14} strokeWidth={ICON_STROKE} />} />
        <div className="flex flex-1 flex-col items-start justify-center py-6">
          <p className="text-base font-medium text-slate-900">На сегодня занятий больше нет</p>
          <p className="mt-1 text-sm text-slate-500">Хорошее время, чтобы закрыть дедлайны.</p>
        </div>
        <Link href="/schedule" className={linkCls}>
          Расписание на неделю <ArrowRight size={14} strokeWidth={ICON_STROKE} />
        </Link>
      </Card>
    );
  }
  const today = lesson.dayOfWeek === isoWeekday();
  const minsToStart = minutesUntil(lesson.startTime);
  const minsToEnd = minutesUntil(lesson.endTime);
  const live = today && minsToStart <= 0 && minsToEnd > 0;

  return (
    <Card className={cn('flex flex-col p-4 sm:p-5', className)}>
      <CardHeader
        title="Ближайшая пара"
        icon={<CalendarDays size={14} strokeWidth={ICON_STROKE} />}
        action={
          live ? (
            <Badge tone="brand">Идёт сейчас</Badge>
          ) : today ? (
            <Badge tone="brand" className="tabular-nums">
              {inMinutesLabel(minsToStart)}
            </Badge>
          ) : (
            <Badge tone="neutral">{WEEKDAYS_FULL[lesson.dayOfWeek - 1] ?? ''}</Badge>
          )
        }
      />
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
        <div className="shrink-0">
          <p className="text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">{lesson.startTime}</p>
          <p className="mt-0.5 text-sm text-slate-500 tabular-nums">до {lesson.endTime}</p>
        </div>
        <div className="min-w-0 flex-1 sm:border-l sm:border-slate-200 sm:pl-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{LESSON_TYPE_LABEL[lesson.type]}</Badge>
            {lesson.isRescheduled && <Badge tone="warning">Перенос</Badge>}
          </div>
          <p className="mt-2 text-lg font-semibold leading-snug text-slate-900 break-words">{lesson.subject}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <MapPin size={14} strokeWidth={ICON_STROKE} className="text-slate-400" />
              {lesson.isRescheduled && lesson.oldRoom && (
                <s className="text-slate-400 tabular-nums">{lesson.oldRoom}</s>
              )}
              <span className={cn('tabular-nums', lesson.isRescheduled && 'font-medium text-amber-700')}>
                {lesson.room}
              </span>
            </span>
            {lesson.teacher && (
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <UserRound size={14} strokeWidth={ICON_STROKE} className="shrink-0 text-slate-400" />
                <span className="truncate">{lesson.teacher}</span>
              </span>
            )}
          </div>
          {lesson.note && <p className="mt-2 text-xs text-amber-700">{lesson.note}</p>}
        </div>
      </div>
      <div className="mt-auto pt-3">
        <Link href="/schedule" className={linkCls}>
          Всё расписание <ArrowRight size={14} strokeWidth={ICON_STROKE} />
        </Link>
      </div>
    </Card>
  );
}

function AverageCard({ value, className }: { value: number | null; className?: string }) {
  const v = value ?? 0;
  const ok = v >= STIPEND_THRESHOLD;
  return (
    <Card className={cn('flex flex-col p-4 sm:p-5', className)}>
      <CardHeader title="Средний балл БРС" icon={<Gauge size={14} strokeWidth={ICON_STROKE} />} />
      <div className="mt-4 flex items-baseline gap-1.5">
        <span className="text-4xl font-semibold tracking-tight text-slate-900 tabular-nums">
          {value === null ? '—' : v.toLocaleString('ru-RU', { maximumFractionDigits: 1 })}
        </span>
        <span className="text-sm text-slate-400 tabular-nums">/ 100</span>
      </div>
      <Progress value={v} marker={STIPEND_THRESHOLD} tone={ok ? 'success' : 'warning'} className="mt-4" />
      <div className="mt-1.5 flex justify-between text-[11px] text-slate-400 tabular-nums">
        <span>0</span>
        <span>{STIPEND_THRESHOLD} — повышенная</span>
      </div>
      <div className="mt-3">
        {value === null ? null : ok ? (
          <Badge tone="success" icon={<CircleCheck size={12} strokeWidth={ICON_STROKE} />}>
            Повышенная стипендия сохраняется
          </Badge>
        ) : (
          <Badge tone="warning" className="tabular-nums">
            До повышенной: +{(STIPEND_THRESHOLD - v).toLocaleString('ru-RU', { maximumFractionDigits: 1 })}
          </Badge>
        )}
      </div>
      <div className="mt-auto pt-3">
        <Link href="/grades" className={linkCls}>
          Симулятор БРС <ArrowRight size={14} strokeWidth={ICON_STROKE} />
        </Link>
      </div>
    </Card>
  );
}

function DeadlinesCard({ items, className }: { items: Assignment[]; className?: string }) {
  const sorted = [...items].sort((a, b) => +new Date(a.deadline) - +new Date(b.deadline)).slice(0, 5);
  return (
    <Card className={cn('flex flex-col p-4 sm:p-5', className)}>
      <CardHeader
        title="Горящие дедлайны"
        icon={<Flame size={14} strokeWidth={ICON_STROKE} />}
        action={items.length > 0 && <span className="text-xs text-slate-500 tabular-nums">{items.length}</span>}
      />
      {sorted.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
          <CircleCheck size={20} strokeWidth={ICON_STROKE} className="text-emerald-600" />
          <p className="mt-2 text-sm font-medium text-slate-900">Все задания сданы</p>
          <p className="mt-0.5 text-sm text-slate-500">Новые дедлайны появятся здесь.</p>
        </div>
      ) : (
        <ul className="-mx-1 mt-3 divide-y divide-slate-200">
          {sorted.map((a) => (
            <li key={a.id}>
              <Link
                href="/study"
                className="flex items-start gap-3 rounded-lg px-1 py-3 transition-colors hover:bg-slate-50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-slate-500">{a.subject}</p>
                  <p className="mt-0.5 text-sm font-medium leading-snug text-slate-900 break-words">{a.title}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <Countdown deadline={a.deadline} />
                  {a.points > 0 && <span className="text-xs text-slate-500 tabular-nums">+{a.points} б.</span>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-auto pt-2">
        <Link href="/study" className={linkCls}>
          Все задания <ArrowRight size={14} strokeWidth={ICON_STROKE} />
        </Link>
      </div>
    </Card>
  );
}

function RequestCard({
  request,
  onOpen,
  className,
}: {
  request: StudentRequest | null;
  onOpen: (r: StudentRequest) => void;
  className?: string;
}) {
  return (
    <Card className={cn('flex flex-col p-4 sm:p-5', className)}>
      <CardHeader title="Активная заявка" icon={<FileText size={14} strokeWidth={ICON_STROKE} />} />
      {!request ? (
        <div className="flex flex-1 flex-col items-start justify-center py-5">
          <p className="text-sm font-medium text-slate-900">Активных заявок нет</p>
          <p className="mt-0.5 text-sm text-slate-500">Справка об обучении — в один клик.</p>
          <Link href="/requests" className={cn(linkCls, 'mt-2')}>
            Заказать справку <ArrowRight size={14} strokeWidth={ICON_STROKE} />
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-3 flex items-start justify-between gap-3">
            <p className="min-w-0 text-sm font-medium text-slate-900">{REQUEST_TYPE_LABEL[request.type]}</p>
            <Badge tone={REQUEST_STATUS_TONE[request.status]}>{REQUEST_STATUS_LABEL[request.status]}</Badge>
          </div>
          <div className="mt-4">
            <RequestStepper request={request} compact />
          </div>
          <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
            {request.status === 'APPROVED' ? (
              <Button size="sm" onClick={() => onOpen(request)} icon={<ScrollText size={14} strokeWidth={ICON_STROKE} />} className="min-h-11 sm:min-h-0">
                Открыть цифровую справку
              </Button>
            ) : (
              <Link href="/requests" className={linkCls}>
                Все заявки <ArrowRight size={14} strokeWidth={ICON_STROKE} />
              </Link>
            )}
          </div>
        </>
      )}
    </Card>
  );
}

function CopilotCard({ className }: { className?: string }) {
  const copilot = useCopilot();
  const prompts: { text: string; mode: 'TUTOR' | 'DEANERY'; icon: typeof BookOpen }[] = [
    { text: 'Составь план на сегодня по моим дедлайнам', mode: 'TUTOR', icon: Clock },
    { text: 'Что будет, если не сдать РК вовремя?', mode: 'DEANERY', icon: ScrollText },
    { text: 'Объясни тему ближайшей пары за 5 минут', mode: 'TUTOR', icon: BookOpen },
  ];
  return (
    <Card className={cn('flex flex-col p-4 sm:p-5', className)}>
      <CardHeader title="Орбита Copilot" icon={<Sparkles size={14} strokeWidth={ICON_STROKE} />} />
      <p className="mt-3 text-sm text-slate-600">Тьютор по предметам и справочная деканата в одном окне.</p>
      <ul className="mt-3 space-y-1.5">
        {prompts.map((p) => (
          <li key={p.text}>
            <button
              type="button"
              onClick={() => copilot.open({ mode: p.mode, prompt: p.text, context: null })}
              className="flex min-h-11 w-full items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
            >
              <p.icon size={14} strokeWidth={ICON_STROKE} className="shrink-0 text-slate-400" />
              <span className="min-w-0 flex-1">{p.text}</span>
              <ArrowRight size={14} strokeWidth={ICON_STROKE} className="shrink-0 text-slate-400" />
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
