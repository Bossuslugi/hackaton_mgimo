'use client';

import { useMemo, useState } from 'react';
import { CalendarDays, Check, Dumbbell, MapPin, Trophy, UserRound } from 'lucide-react';
import { useSession } from '@/components/shell/SessionProvider';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Sheet } from '@/components/ui/Sheet';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { ApiError, post } from '@/lib/api';
import { cn } from '@/lib/cn';
import { fmtDate, plural } from '@/lib/format';
import { toSportSection, toSports, type SportSection, type SportsData } from '@/lib/normalize-v3';
import { ICON_STROKE } from '@/lib/ui';
import { useApi } from '@/lib/use-api';

const SPORTS = ['Плавание', 'Скалолазание', 'Футбол', 'Баскетбол', 'Настольный теннис', 'Тренажёрный зал', 'Киберспорт'];

/** Вкладка «Физкультура и секции»: GET /api/campus/sports, POST /api/campus/sports/[id]/enroll. */
export function Sports() {
  const toast = useToast();
  const { isAdmin, isTeacher } = useSession();
  const state = useApi<SportsData>('/api/campus/sports', toSports);
  const [sport, setSport] = useState('Все');
  const [confirm, setConfirm] = useState<SportSection | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [justId, setJustId] = useState<string | null>(null);

  const data = state.data;
  const current = data?.sections.find((s) => s.id === data.currentSectionId || s.isCurrent) ?? null;
  const list = useMemo(() => (data?.sections ?? []).filter((s) => sport === 'Все' || s.sportType === sport), [data, sport]);
  const student = !isAdmin && !isTeacher;
  const canEnroll = student && (data?.canEnroll ?? true);

  async function enroll(sec: SportSection) {
    setConfirm(null);
    setPendingId(sec.id);
    const before = data;
    // Optimistic UI: секция сразу становится текущей, счётчики пересчитаны
    state.setData((d) =>
      d
        ? {
            ...d,
            currentSectionId: sec.id,
            sections: d.sections.map((s) =>
              s.id === sec.id
                ? { ...s, isCurrent: true, enrolledCount: s.enrolledCount + 1, spotsLeft: Math.max(0, s.spotsLeft - 1) }
                : s.isCurrent
                  ? { ...s, isCurrent: false, enrolledCount: Math.max(0, s.enrolledCount - 1), spotsLeft: s.spotsLeft + 1 }
                  : s,
            ),
          }
        : d,
    );
    try {
      const raw = (await post(`/api/campus/sports/${encodeURIComponent(sec.id)}/enroll`)) as { section?: unknown; previousSection?: string | null } | null;
      const fresh = toSportSection(raw?.section ?? null);
      if (fresh) state.setData((d) => (d ? { ...d, sections: d.sections.map((s) => (s.id === fresh.id ? { ...fresh, isCurrent: true } : s)) } : d));
      setJustId(sec.id);
      window.setTimeout(() => setJustId((x) => (x === sec.id ? null : x)), 900);
      toast.success('Запись на физкультуру подтверждена', raw?.previousSection ? `${sec.title} вместо «${raw.previousSection}»` : sec.title);
    } catch (e) {
      state.setData(() => before);
      toast.error('Не удалось записаться', e instanceof ApiError ? e.message : undefined);
      if (e instanceof ApiError && e.status === 409) state.reload();
    } finally {
      setPendingId(null);
    }
  }

  if (state.loading && !data) {
    return (
      <div className="grid gap-3 lg:grid-cols-2">
        <SkeletonCard lines={3} />
        <SkeletonCard lines={3} />
      </div>
    );
  }
  if (state.error) return <ErrorState error={state.error} onRetry={state.reload} />;
  if (!data) return null;

  const pct = Math.max(0, Math.min(100, data.peProgressPercent));
  const left = Math.max(0, data.peTargetPoints - data.peCurrentPoints);

  return (
    <>
      <div className="mb-4 grid gap-3 lg:grid-cols-2 lg:gap-4">
        <Card className="p-4 sm:p-5">
          <CardHeader title="Спортивный зачёт" icon={<Trophy size={14} strokeWidth={ICON_STROKE} />} />
          <div className="mt-4 flex items-baseline gap-1.5">
            <span className="text-4xl font-semibold tracking-tight text-slate-900 tabular-nums dark:text-zinc-50">{data.peCurrentPoints}</span>
            <span className="text-sm text-slate-500 tabular-nums dark:text-zinc-400">/ {data.peTargetPoints} баллов</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800" role="progressbar" aria-valuenow={data.peCurrentPoints} aria-valuemin={0} aria-valuemax={data.peTargetPoints}>
            <div
              className={cn('h-full origin-left rounded-full transition-transform duration-500 ease-out', pct >= 100 ? 'bg-emerald-600' : 'bg-blue-600 dark:bg-blue-500')}
              style={{ transform: `scaleX(${pct / 100})` }}
            />
          </div>
          <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">
            {left === 0 ? (
              <span className="font-medium text-emerald-700 dark:text-emerald-300">Зачёт набран — так держать!</span>
            ) : (
              <>
                До зачёта: <span className="font-medium text-slate-900 tabular-nums dark:text-zinc-50">{left}</span> {plural(left, ['балл', 'балла', 'баллов'])} ·{' '}
                <span className="tabular-nums">{pct}%</span>
              </>
            )}
          </p>
        </Card>
        <Card className="p-4 sm:p-5">
          <CardHeader title="Текущая секция" icon={<Dumbbell size={14} strokeWidth={ICON_STROKE} />} />
          {current ? (
            <div className="mt-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone="brand">{current.sportType}</Badge>
                <Badge tone="success" icon={<Check size={12} strokeWidth={ICON_STROKE} />}>
                  Ваша секция
                </Badge>
              </div>
              <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-zinc-50">{current.title}</p>
              <SectionMeta s={current} />
              {data.enrolledAt && <p className="mt-2 text-xs text-slate-500 tabular-nums dark:text-zinc-400">Записаны с {fmtDate(data.enrolledAt)}</p>}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500 dark:text-zinc-400">
              {student ? 'Вы ещё не выбрали секцию — запишитесь в каталоге ниже.' : 'Запись в секции доступна студентам.'}
            </p>
          )}
        </Card>
      </div>

      <div className="-mx-4 mb-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
        <div role="group" aria-label="Вид спорта" className="flex w-max gap-1.5">
          {['Все', ...SPORTS].map((c) => {
            const on = c === sport;
            return (
              <button
                key={c}
                type="button"
                aria-pressed={on}
                onClick={() => setSport(c)}
                className={cn(
                  'min-h-9 rounded-full border px-3.5 text-sm transition-colors',
                  on
                    ? 'border-blue-600 bg-blue-600 text-white dark:border-blue-500 dark:bg-blue-500'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-zinc-800 dark:bg-[#12141A] dark:text-zinc-400 dark:hover:bg-zinc-900',
                )}
              >
                {c}
              </button>
            );
          })}
        </div>
      </div>

      {list.length === 0 ? (
        <EmptyState icon={<Dumbbell size={20} strokeWidth={ICON_STROKE} />} title="Секций этого вида пока нет" />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 lg:gap-4">
          {list.map((s) => {
            const fill = s.capacity ? Math.min(100, (s.enrolledCount / s.capacity) * 100) : 0;
            const full = s.spotsLeft <= 0 && !s.isCurrent;
            return (
              <li key={s.id}>
                <Card className={cn('flex h-full flex-col p-4 sm:p-5', s.isCurrent && 'border-blue-600 dark:border-blue-500')}>
                  <div className="flex items-start justify-between gap-2">
                    <Badge tone="neutral">{s.sportType}</Badge>
                    <span className="text-xs text-slate-500 tabular-nums dark:text-zinc-400">
                      свободно <span className="font-medium text-slate-900 dark:text-zinc-50">{s.spotsLeft}</span> / {s.capacity}
                    </span>
                  </div>
                  <h3 className="mt-2 text-[15px] font-semibold leading-snug text-slate-900 dark:text-zinc-50">{s.title}</h3>
                  <SectionMeta s={s} />
                  <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800">
                    <div
                      className={cn('h-full origin-left rounded-full transition-transform duration-300 ease-out', fill >= 90 ? 'bg-amber-500' : 'bg-blue-600 dark:bg-blue-500')}
                      style={{ transform: `scaleX(${fill / 100})` }}
                    />
                  </div>
                  <div className="mt-auto pt-4">
                    {s.isCurrent ? (
                      <Badge
                        tone="success"
                        icon={<Check size={12} strokeWidth={ICON_STROKE} className={justId === s.id ? 'animate-[check-in_220ms_ease-out]' : undefined} />}
                        className={cn('min-h-9 w-full justify-center text-sm', justId === s.id && 'animate-[pop_300ms_ease-out]')}
                      >
                        Ваша текущая секция
                      </Badge>
                    ) : (
                      <Button
                        block
                        variant={current ? 'secondary' : 'primary'}
                        disabled={!canEnroll || full || pendingId !== null}
                        loading={pendingId === s.id}
                        onClick={() => (current ? setConfirm(s) : void enroll(s))}
                        className="min-h-11 sm:min-h-10"
                      >
                        {!student ? 'Только для студентов' : full ? 'Мест нет' : current ? 'Перейти в эту секцию' : 'Записаться в секцию'}
                      </Button>
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <Sheet
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title="Сменить секцию?"
        description={confirm && current ? `${current.title} → ${confirm.title}` : undefined}
        footer={
          confirm && (
            <>
              <Button variant="secondary" onClick={() => setConfirm(null)} className="min-h-11 sm:min-h-0">
                Остаться
              </Button>
              <Button onClick={() => void enroll(confirm)} className="min-h-11 sm:min-h-0">
                Перейти
              </Button>
            </>
          )
        }
      >
        <p className="text-sm text-slate-600 dark:text-zinc-400">
          Место в текущей секции освободится. Набранные баллы зачёта сохранятся.
        </p>
      </Sheet>
    </>
  );
}

function SectionMeta({ s }: { s: SportSection }) {
  return (
    <ul className="mt-2 space-y-1 text-sm text-slate-600 dark:text-zinc-400">
      <li className="flex items-center gap-1.5">
        <UserRound size={14} strokeWidth={ICON_STROKE} className="shrink-0 text-slate-400 dark:text-zinc-500" />
        <span className="truncate">{s.coachName}</span>
      </li>
      <li className="flex items-center gap-1.5">
        <MapPin size={14} strokeWidth={ICON_STROKE} className="shrink-0 text-slate-400 dark:text-zinc-500" />
        <span className="truncate">{s.campusLocation}</span>
      </li>
      <li className="flex items-center gap-1.5 tabular-nums">
        <CalendarDays size={14} strokeWidth={ICON_STROKE} className="shrink-0 text-slate-400 dark:text-zinc-500" />
        {s.scheduleText}
      </li>
    </ul>
  );
}
