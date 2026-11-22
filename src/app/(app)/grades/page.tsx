'use client';

import { useMemo, useState } from 'react';
import { Award, BookOpen, Calculator, CircleCheck, RotateCcw, TriangleAlert, Target } from 'lucide-react';
import { StudentOnly } from '@/components/shell/StudentOnly';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { WriteTeacherButton } from '@/components/messages/WriteTeacherButton';
import { StatsWidget } from '@/components/stats/StatsWidget';
import { PageHeader } from '@/components/ui/PageHeader';
import { Progress } from '@/components/ui/Progress';
import { Segmented } from '@/components/ui/Segmented';
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton';
import {
  average,
  gradeOf,
  headroom,
  isDebt,
  projectedTotal,
  STIPEND_THRESHOLD,
  type SimDelta,
  zeroDelta,
} from '@/lib/brs';
import { cn } from '@/lib/cn';
import { toGrades } from '@/lib/normalize';
import type { SubjectGrade } from '@/lib/types';
import { ICON_STROKE } from '@/lib/ui';
import { useApi } from '@/lib/use-api';

type Mode = 'current' | 'sim';
const fmt1 = (n: number) => n.toLocaleString('ru-RU', { maximumFractionDigits: 1 });

export default function GradesPage() {
  return (
    <StudentOnly>
      <Grades />
    </StudentOnly>
  );
}

function Grades() {
  const { data, error, loading, reload } = useApi<SubjectGrade[]>('/api/grades', toGrades);
  const [mode, setMode] = useState<Mode>('current');
  const [deltas, setDeltas] = useState<Record<string, SimDelta>>({});

  const subjects = data ?? [];
  const delta = (s: SubjectGrade) => deltas[s.id] ?? zeroDelta();
  const totals = subjects.map((s) => (mode === 'sim' ? projectedTotal(s, delta(s)) : s.total));
  const avg = average(totals);
  const debts = subjects.filter((s, i) => isDebt(totals[i], mode === 'current' && s.hasDebt));
  const below = subjects
    .map((s, i) => ({ s, t: totals[i] }))
    .filter((x) => x.t < STIPEND_THRESHOLD);
  const stipend = subjects.length > 0 && below.length === 0;

  const setPart = (id: string, part: keyof SimDelta, v: number) =>
    setDeltas((d) => ({ ...d, [id]: { ...(d[id] ?? zeroDelta()), [part]: v } }));

  return (
    <>
      <PageHeader
        title="Успеваемость (БРС)"
        description="Балльно-рейтинговая система: лабораторные, рубежный контроль, посещаемость"
        actions={
          <Segmented<Mode>
            ariaLabel="Режим"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'current', label: 'Текущие баллы' },
              { value: 'sim', label: 'Симулятор' },
            ]}
          />
        }
      />

      {loading && !data ? (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="p-4">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="mt-3 h-7 w-14" />
              </Card>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={i} lines={4} />
            ))}
          </div>
        </>
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : subjects.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={20} strokeWidth={ICON_STROKE} />}
          title="Оценок пока нет"
          description="Баллы появятся после первых контрольных точек семестра."
        />
      ) : (
        <>
          {/* сводка */}
          <div className={cn('mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4', mode === 'sim' && 'lg:sticky lg:top-20 lg:z-20')}>
            <Stat
              label={mode === 'sim' ? 'Прогноз среднего' : 'Средний балл'}
              value={fmt1(avg)}
              suffix="/ 100"
              accent={mode === 'sim'}
            />
            <Stat label="Дисциплин" value={String(subjects.length)} />
            <Stat
              label="Задолженности"
              value={String(debts.length)}
              tone={debts.length ? 'danger' : 'success'}
            />
            <Card className={cn('p-4', stipend ? 'border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/60' : 'border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/60')}>
              <div className={cn('flex items-center gap-2 text-xs', stipend ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300')}>
                <Award size={14} strokeWidth={ICON_STROKE} />
                Повышенная стипендия
              </div>
              <p className={cn('mt-1.5 text-sm font-semibold', stipend ? 'text-emerald-800 dark:text-emerald-200' : 'text-amber-800 dark:text-amber-200')}>
                {stipend ? (mode === 'sim' ? 'Сохранится' : 'Сохраняется') : 'Под угрозой'}
              </p>
              <p className={cn('mt-0.5 text-xs leading-snug', stipend ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300')}>
                {stipend
                  ? `Все дисциплины ≥ ${STIPEND_THRESHOLD}`
                  : `Ниже ${STIPEND_THRESHOLD}: ${below
                      .slice(0, 2)
                      .map((x) => `${short(x.s.name)} (${x.t})`)
                      .join(', ')}${below.length > 2 ? ` и ещё ${below.length - 2}` : ''}`}
              </p>
            </Card>
          </div>

          {mode === 'sim' && (
            <div className="mb-4 flex flex-col gap-3 rounded-xl border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-3">
                <Calculator size={18} strokeWidth={ICON_STROKE} className="mt-0.5 shrink-0 text-blue-700 dark:text-blue-400" />
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  <b className="font-semibold">Симулятор БРС «Что если?».</b> Двигайте ползунки — сколько баллов вы ещё наберёте за оставшиеся работы. Итог и стипендия пересчитываются
                  сразу. Правило: повышенная стипендия при итоге <b className="tabular-nums">≥ {STIPEND_THRESHOLD}</b> по
                  каждой дисциплине.
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<Target size={14} strokeWidth={ICON_STROKE} />}
                  onClick={() =>
                    setDeltas(
                      Object.fromEntries(
                        subjects.map((s) => {
                          const h = headroom(s);
                          const need = Math.max(0, STIPEND_THRESHOLD - s.total);
                          // минимально необходимое: сначала РК, потом лабы, потом посещаемость
                          const rk = Math.min(h.rk, need);
                          const labs = Math.min(h.labs, need - rk);
                          const attendance = Math.min(h.attendance, need - rk - labs);
                          return [s.id, { rk, labs, attendance }];
                        }),
                      ),
                    )
                  }
                  className="min-h-11 sm:min-h-9"
                >
                  До 85 минимально
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<RotateCcw size={14} strokeWidth={ICON_STROKE} />}
                  onClick={() => setDeltas({})}
                  className="min-h-11 sm:min-h-9"
                >
                  Сброс
                </Button>
              </div>
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2 lg:gap-4">
            {subjects.map((s) =>
              mode === 'sim' ? (
                <SimCard key={s.id} s={s} d={delta(s)} onChange={(part, v) => setPart(s.id, part, v)} />
              ) : (
                <SubjectCard key={s.id} s={s} />
              ),
            )}
          </div>
          {mode === 'current' && <StatsWidget className="mt-4 lg:mt-6" />}
        </>
      )}
    </>
  );
}

const short = (name: string) => (name.length > 18 ? `${name.slice(0, 16).trim()}…` : name);

function Stat({
  label,
  value,
  suffix,
  tone,
  accent,
}: {
  label: string;
  value: string;
  suffix?: string;
  tone?: 'danger' | 'success';
  accent?: boolean;
}) {
  return (
    <Card className={cn('p-4', accent && 'border-blue-200 dark:border-blue-500/30')}>
      <p className="truncate text-xs text-slate-500 dark:text-zinc-400">{label}</p>
      <p className="mt-1.5 flex items-baseline gap-1">
        <span
          className={cn(
            'text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl',
            tone === 'danger' ? 'text-red-700 dark:text-red-300' : accent ? 'text-blue-700 dark:text-blue-400' : 'text-slate-900 dark:text-zinc-50',
          )}
        >
          {value}
        </span>
        {suffix && <span className="text-xs text-slate-400 dark:text-zinc-500 tabular-nums">{suffix}</span>}
      </p>
    </Card>
  );
}

const PARTS: { key: keyof SimDelta; label: string; val: (s: SubjectGrade) => number; max: (s: SubjectGrade) => number }[] = [
  { key: 'labs', label: 'Лабораторные', val: (s) => s.labs, max: (s) => s.labsMax },
  { key: 'rk', label: 'Рубежный контроль', val: (s) => s.rk, max: (s) => s.rkMax },
  { key: 'attendance', label: 'Посещаемость', val: (s) => s.attendance, max: (s) => s.attendanceMax },
];

function SubjectCard({ s }: { s: SubjectGrade }) {
  const g = gradeOf(s.total);
  const debt = isDebt(s.total, s.hasDebt);
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold leading-snug text-slate-900 dark:text-zinc-50 break-words">{s.name}</h3>
          {s.teacher && (
            <div className="-my-1 flex min-w-0 items-center gap-1">
              <p className="min-w-0 truncate text-xs text-slate-500 dark:text-zinc-400">{s.teacher}</p>
              <WriteTeacherButton
                teacherName={s.teacher}
                iconOnly
                label="Написать преподавателю"
                draft={`Добрый день! Подскажите, пожалуйста, по дисциплине «${s.name}»: `}
                className="-my-1 shrink-0 text-slate-400 dark:text-zinc-500"
              />
            </div>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-2xl font-semibold leading-none tracking-tight text-slate-900 dark:text-zinc-50 tabular-nums">
            {s.total}
            <span className="ml-0.5 text-xs font-normal text-slate-400 dark:text-zinc-500">/100</span>
          </p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Badge tone={g.tone}>{g.label}</Badge>
        {debt && (
          <Badge tone="danger" icon={<TriangleAlert size={12} strokeWidth={ICON_STROKE} />}>
            Задолженность
          </Badge>
        )}
        {s.total >= STIPEND_THRESHOLD && (
          <Badge tone="success" icon={<CircleCheck size={12} strokeWidth={ICON_STROKE} />}>
            Стипендия
          </Badge>
        )}
      </div>
      <dl className="mt-4 space-y-3">
        {PARTS.map((p) => (
          <div key={p.key}>
            <div className="flex items-baseline justify-between text-sm">
              <dt className="text-slate-600 dark:text-zinc-400">{p.label}</dt>
              <dd className="tabular-nums text-slate-900 dark:text-zinc-50">
                {p.val(s)}
                <span className="text-slate-400 dark:text-zinc-500"> / {p.max(s)}</span>
              </dd>
            </div>
            <Progress value={p.val(s)} max={p.max(s)} tone="brand" className="mt-1.5" />
          </div>
        ))}
        <div className="flex items-baseline justify-between border-t border-slate-200 dark:border-zinc-800 pt-3 text-sm">
          <dt className="font-medium text-slate-900 dark:text-zinc-50">Итог</dt>
          <dd className="font-semibold tabular-nums text-slate-900 dark:text-zinc-50">{s.total} / 100</dd>
        </div>
      </dl>
    </Card>
  );
}

function SimCard({ s, d, onChange }: { s: SubjectGrade; d: SimDelta; onChange: (k: keyof SimDelta, v: number) => void }) {
  const h = headroom(s);
  const total = projectedTotal(s, d);
  const diff = total - s.total;
  const before = gradeOf(s.total);
  const after = gradeOf(total);
  const ok = total >= STIPEND_THRESHOLD;
  const maxPossible = projectedTotal(s, h);

  return (
    <Card className={cn('p-4 sm:p-5', ok ? 'border-emerald-200 dark:border-emerald-800/60' : isDebt(total) ? 'border-red-200 dark:border-red-800/60' : '')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold leading-snug text-slate-900 dark:text-zinc-50 break-words">{s.name}</h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400 tabular-nums">
            Сейчас {s.total} · максимум возможный {maxPossible}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-2xl font-semibold leading-none tracking-tight text-slate-900 dark:text-zinc-50 tabular-nums">{total}</p>
          <p className={cn('mt-1 text-xs tabular-nums', diff > 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-400 dark:text-zinc-500')}>
            {diff > 0 ? `+${diff}` : '±0'}
          </p>
        </div>
      </div>

      <Progress value={total} marker={STIPEND_THRESHOLD} tone={ok ? 'success' : isDebt(total) ? 'danger' : 'warning'} className="mt-3" />
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
        <Badge tone={before.tone}>{before.label}</Badge>
        {after.label !== before.label && (
          <>
            <span className="text-slate-400 dark:text-zinc-500">→</span>
            <Badge tone={after.tone}>{after.label}</Badge>
          </>
        )}
        {ok ? (
          <Badge tone="success">≥ 85 · стипендия</Badge>
        ) : (
          <span className="text-slate-500 dark:text-zinc-400 tabular-nums">
            до 85: {maxPossible >= STIPEND_THRESHOLD ? `ещё +${STIPEND_THRESHOLD - total}` : 'недостижимо'}
          </span>
        )}
      </div>

      <div className="mt-3 space-y-1">
        {PARTS.map((p) => {
          const max = h[p.key];
          const v = Math.min(d[p.key], max);
          const fill = max ? (v / max) * 100 : 0;
          const id = `sim-${s.id}-${p.key}`;
          return (
            <div key={p.key}>
              <div className="flex items-baseline justify-between text-sm">
                <label htmlFor={id} className="text-slate-600 dark:text-zinc-400">
                  {p.label}
                </label>
                <span className="tabular-nums text-slate-900 dark:text-zinc-50">
                  {p.val(s) + v}
                  <span className="text-slate-400 dark:text-zinc-500"> / {p.max(s)}</span>
                  {v > 0 && <span className="ml-1.5 text-emerald-700 dark:text-emerald-300">+{v}</span>}
                </span>
              </div>
              <input
                id={id}
                type="range"
                className="range w-full"
                min={0}
                max={max}
                step={1}
                value={v}
                disabled={max === 0}
                onChange={(e) => onChange(p.key, Number(e.target.value))}
                style={{ ['--fill' as string]: `${fill}%` }}
                aria-valuetext={`плюс ${v} из ${max}`}
              />
            </div>
          );
        })}
      </div>
    </Card>
  );
}
