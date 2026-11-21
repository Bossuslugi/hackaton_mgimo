'use client';

import { useMemo, useState, type FormEvent } from 'react';
import {
  CalendarClock,
  CircleCheck,
  ClipboardCheck,
  ExternalLink,
  FilePlus2,
  Inbox,
  MessageSquareText,
  Plus,
  Search,
  Send,
  Users,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { messagesHref } from '@/components/messages/WriteTeacherButton';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input, Label, Select, Textarea } from '@/components/ui/Field';
import { Markdown } from '@/components/ui/Markdown';
import { PageHeader } from '@/components/ui/PageHeader';
import { Segmented } from '@/components/ui/Segmented';
import { Sheet } from '@/components/ui/Sheet';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { ApiError, patch, post } from '@/lib/api';
import { cn } from '@/lib/cn';
import { fmtDateTime, initials, MATERIAL_CATEGORY_LABEL, plural } from '@/lib/format';
import { toAssignment, toStudy } from '@/lib/normalize';
import { toTeacherCabinet } from '@/lib/normalize-v2';
import type { Assignment, AssignmentStatus, TeacherCabinet as Cabinet } from '@/lib/types';
import { ICON_STROKE } from '@/lib/ui';
import { useApi } from '@/lib/use-api';
import { CodeEditor } from './CodeEditor';

type Filter = 'review' | 'graded' | 'all';

const STATUS: Record<AssignmentStatus, { label: string; tone: BadgeTone }> = {
  ACTIVE: { label: 'Не сдано', tone: 'neutral' },
  SUBMITTED: { label: 'На проверке', tone: 'warning' },
  GRADED: { label: 'Оценено', tone: 'success' },
  OVERDUE: { label: 'Просрочено', tone: 'danger' },
};

const DEFAULT_GROUPS = ['М3203', 'Э4102'];

/** Кабинет преподавателя: GET /api/teacher/assignments, создание и проверка онлайн-заданий. */
export function TeacherCabinet() {
  const state = useApi<Cabinet>('/api/teacher/assignments', toTeacherCabinet);
  const [filter, setFilter] = useState<Filter>('review');
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [reviewId, setReviewId] = useState<string | null>(null);

  const items = state.data?.assignments ?? [];
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((a) =>
        filter === 'review' ? a.status === 'SUBMITTED' : filter === 'graded' ? a.status === 'GRADED' : true,
      )
      .filter((a) => !q || `${a.title} ${a.student?.fullName ?? ''} ${a.group ?? ''} ${a.subject}`.toLowerCase().includes(q))
      .sort((a, b) => {
        const rank = (x: Assignment) => (x.status === 'SUBMITTED' ? 0 : x.status === 'ACTIVE' ? 1 : x.status === 'OVERDUE' ? 2 : 3);
        return rank(a) - rank(b) || +new Date(b.submittedAt ?? b.deadline) - +new Date(a.submittedAt ?? a.deadline);
      });
  }, [items, filter, query]);

  const reviewing = reviewId ? (items.find((a) => a.id === reviewId) ?? null) : null;
  const update = (a: Assignment) =>
    state.setData((d) => {
      if (!d) return d;
      const assignments = d.assignments.map((x) => (x.id === a.id ? { ...x, ...a } : x));
      const toReview = assignments.filter((x) => x.status === 'SUBMITTED').length;
      return { ...d, assignments, toReview };
    });

  const s = state.data;
  const issued = s ? new Set(s.assignments.map((a) => `${a.title}|${a.group}`)).size : 0;

  return (
    <>
      <PageHeader
        eyebrow="Кабинет преподавателя"
        title="Онлайн-задания и проверка"
        description="Выдавайте задачи группам, читайте решения прямо на сайте и выставляйте баллы в БРС"
        actions={
          <Button onClick={() => setCreating(true)} icon={<Plus size={16} strokeWidth={ICON_STROKE} />} className="min-h-11 sm:min-h-10">
            Создать онлайн-задание
          </Button>
        }
      />

      {state.loading && !s ? (
        <div className="grid gap-3 md:grid-cols-2" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} lines={2} />
          ))}
        </div>
      ) : state.error ? (
        <ErrorState error={state.error} onRetry={state.reload} />
      ) : s ? (
        <>
          <dl className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            <Kpi label="Ждут проверки" value={s.toReview} tone={s.toReview ? 'warning' : undefined} icon={<Inbox size={14} strokeWidth={ICON_STROKE} />} />
            <Kpi label="Оценено" value={s.summary.GRADED} icon={<CircleCheck size={14} strokeWidth={ICON_STROKE} />} />
            <Kpi label="Выдано заданий" value={issued} icon={<FilePlus2 size={14} strokeWidth={ICON_STROKE} />} />
            <Kpi label="Группы" value={s.groups.join(', ') || '—'} icon={<Users size={14} strokeWidth={ICON_STROKE} />} />
          </dl>

          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Segmented<Filter>
              size="sm"
              ariaLabel="Фильтр работ"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'review', label: 'На проверке', count: s.summary.SUBMITTED ? items.filter((a) => a.status === 'SUBMITTED').length : 0 },
                { value: 'graded', label: 'Оценённые', count: items.filter((a) => a.status === 'GRADED').length },
                { value: 'all', label: 'Все', count: items.length },
              ]}
            />
            <div className="relative sm:w-72">
              <Search size={16} strokeWidth={ICON_STROKE} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Студент, группа, задание" aria-label="Поиск по работам" className="pl-9" />
            </div>
          </div>

          {list.length === 0 ? (
            <EmptyState
              icon={<ClipboardCheck size={20} strokeWidth={ICON_STROKE} />}
              title={filter === 'review' ? 'Новых решений нет' : 'Здесь пока пусто'}
              description={filter === 'review' ? 'Как только студент отправит решение, оно появится здесь, а вам придёт уведомление.' : undefined}
              action={
                <Button variant="secondary" size="sm" onClick={() => setCreating(true)} icon={<Plus size={14} strokeWidth={ICON_STROKE} />}>
                  Создать онлайн-задание
                </Button>
              }
            />
          ) : (
            <Card className="overflow-hidden">
              <ul className="divide-y divide-slate-200 dark:divide-zinc-800">
                {list.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => setReviewId(a.id)}
                      className="flex w-full min-w-0 items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-zinc-900 sm:items-center sm:px-5"
                    >
                      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-xs font-medium text-slate-700 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300">
                        {initials(a.student?.fullName ?? '—')}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="truncate text-sm font-medium text-slate-900 dark:text-zinc-50">{a.student?.fullName ?? 'Студент'}</span>
                          <span className="text-xs text-slate-500 tabular-nums dark:text-zinc-400">{a.student?.group ?? a.group}</span>
                        </span>
                        <span className="mt-0.5 block truncate text-sm text-slate-600 dark:text-zinc-400">{a.title}</span>
                        <span className="mt-0.5 block text-xs text-slate-500 tabular-nums dark:text-zinc-400">
                          {a.submittedAt ? `Сдано ${fmtDateTime(a.submittedAt)}` : `Дедлайн ${fmtDateTime(a.deadline)}`}
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1.5">
                        <Badge tone={STATUS[a.status].tone}>{STATUS[a.status].label}</Badge>
                        {a.status === 'GRADED' && (
                          <span className="text-xs font-medium text-slate-900 tabular-nums dark:text-zinc-50">
                            {a.gradeAwarded ?? a.score} / {a.points}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      ) : null}

      <CreateAssignmentSheet
        open={creating}
        cabinet={s}
        onClose={() => setCreating(false)}
        onCreated={() => {
          setCreating(false);
          setFilter('all');
          state.reload();
        }}
      />
      <ReviewSheet assignment={reviewing} onClose={() => setReviewId(null)} onGraded={update} />
    </>
  );
}

function Kpi({ label, value, icon, tone }: { label: string; value: number | string; icon: React.ReactNode; tone?: 'warning' }) {
  return (
    <Card className={cn('min-w-0 p-4', tone === 'warning' && 'border-amber-200 dark:border-amber-800/60')}>
      <dt className={cn('flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400', tone === 'warning' && 'text-amber-700 dark:text-amber-300')}>
        {icon}
        {label}
      </dt>
      <dd className={cn('mt-1.5 font-semibold tracking-tight text-slate-900 tabular-nums dark:text-zinc-50', typeof value === 'number' ? 'text-2xl' : 'break-words text-base leading-snug')}>{value}</dd>
    </Card>
  );
}

// ───────────────────────── проверка решения

function ReviewSheet({
  assignment: a,
  onClose,
  onGraded,
}: {
  assignment: Assignment | null;
  onClose: () => void;
  onGraded: (a: Assignment) => void;
}) {
  const toast = useToast();
  const router = useRouter();
  const [grade, setGrade] = useState('');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showTask, setShowTask] = useState(false);
  const [lastId, setLastId] = useState<string | null>(null);

  // подставляем текущую оценку при открытии другой работы
  if (a && a.id !== lastId) {
    setLastId(a.id);
    setGrade(a.gradeAwarded !== null && a.gradeAwarded !== undefined ? String(a.gradeAwarded) : '');
    setFeedback(a.teacherFeedback ?? '');
    setError(null);
    setShowTask(false);
  }

  const canGrade = a?.status === 'SUBMITTED' || a?.status === 'GRADED';

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    if (!a) return;
    const n = Number(grade);
    if (grade.trim() === '' || !Number.isInteger(n) || n < 0 || n > a.points) {
      setError(`Балл — целое число от 0 до ${a.points}`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const raw = await patch(`/api/teacher/assignments/${a.id}/grade`, {
        gradeAwarded: n,
        ...(feedback.trim() ? { teacherFeedback: feedback.trim() } : {}),
      });
      const body = raw as { assignment?: unknown; brs?: { subject: string; currentTotal: number } | null } | null;
      const next = body?.assignment ? toAssignment(body.assignment) : null;
      onGraded({ ...a, ...(next ?? {}), student: next?.student ?? a.student, status: 'GRADED', gradeAwarded: n, score: n, teacherFeedback: feedback.trim() || null });
      toast.success(
        'Оценка выставлена',
        body?.brs ? `${a.student?.fullName ?? 'Студент'}: итог по «${body.brs.subject}» — ${body.brs.currentTotal} / 100` : undefined,
      );
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить оценку.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={a !== null}
      onClose={onClose}
      size="xl"
      title={a ? `${a.student?.fullName ?? 'Студент'} · ${a.student?.group ?? a.group ?? ''}` : ''}
      description={a ? `${a.subject} · ${a.title}` : undefined}
      footer={
        a && (
          <>
            {a.student && (
              <Button
                variant="ghost"
                onClick={() => router.push(messagesHref(a.student!.id, `Добрый день! По вашему решению «${a.title}»: `))}
                icon={<MessageSquareText size={16} strokeWidth={ICON_STROKE} />}
                className="min-h-11 sm:mr-auto sm:min-h-0"
              >
                Написать студенту
              </Button>
            )}
            <Button variant="secondary" onClick={onClose} className="min-h-11 sm:min-h-0">
              Закрыть
            </Button>
            {canGrade && (
              <Button onClick={() => void submit()} loading={busy} icon={<Send size={16} strokeWidth={ICON_STROKE} />} className="min-h-11 sm:min-h-0">
                {a.status === 'GRADED' ? 'Изменить оценку' : 'Выставить балл'}
              </Button>
            )}
          </>
        )
      }
    >
      {a && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 tabular-nums dark:text-zinc-400">
            <Badge tone={STATUS[a.status].tone}>{STATUS[a.status].label}</Badge>
            <span className="inline-flex items-center gap-1">
              <CalendarClock size={12} strokeWidth={ICON_STROKE} />
              Дедлайн {fmtDateTime(a.deadline)}
            </span>
            {a.submittedAt && (
              <span className={cn(new Date(a.submittedAt) > new Date(a.deadline) && 'text-red-700 dark:text-red-300')}>
                · сдано {fmtDateTime(a.submittedAt)}
                {new Date(a.submittedAt) > new Date(a.deadline) && ' (после дедлайна)'}
              </span>
            )}
          </div>

          {a.taskPrompt && (
            <div className="rounded-lg border border-slate-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setShowTask((v) => !v)}
                aria-expanded={showTask}
                className="flex min-h-11 w-full items-center justify-between px-3 text-left text-sm font-medium text-slate-900 dark:text-zinc-50"
              >
                Условие задачи
                <span className="text-xs font-normal text-slate-500 dark:text-zinc-400">{showTask ? 'Свернуть' : 'Показать'}</span>
              </button>
              {showTask && (
                <div className="border-t border-slate-200 px-3 pb-3 dark:border-zinc-800">
                  <Markdown source={a.taskPrompt} compact />
                </div>
              )}
            </div>
          )}

          <div>
            <p className="mb-1.5 text-sm font-medium text-slate-900 dark:text-zinc-50">Решение студента</p>
            {a.solutionText ? (
              <CodeEditor value={a.solutionText} readOnly ariaLabel="Решение студента" className="max-h-[22rem] min-h-40" />
            ) : (
              <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-sm text-slate-500 dark:border-zinc-800 dark:text-zinc-400">
                {a.status === 'ACTIVE' || a.status === 'OVERDUE' ? 'Студент ещё не отправил решение.' : 'Решение приложено ссылкой.'}
              </p>
            )}
          </div>

          {a.submissionLink && (
            <a
              href={a.submissionLink}
              target="_blank"
              rel="noreferrer noopener"
              className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-blue-600 hover:border-slate-300 dark:border-zinc-800 dark:text-blue-400 dark:hover:border-zinc-700"
            >
              <ExternalLink size={14} strokeWidth={ICON_STROKE} className="shrink-0" />
              <span className="truncate">{a.submissionLink}</span>
            </a>
          )}

          {a.studentComment && (
            <blockquote className="border-l-2 border-blue-600 bg-slate-50 py-2 pl-3 pr-2 text-sm text-slate-700 dark:border-blue-500 dark:bg-zinc-900 dark:text-zinc-300">
              {a.studentComment}
            </blockquote>
          )}

          {canGrade && (
            <form onSubmit={submit} noValidate className="grid gap-4 border-t border-slate-200 pt-4 dark:border-zinc-800 sm:grid-cols-[10rem_minmax(0,1fr)]">
              <div>
                <Label htmlFor="grade" hint={`макс. ${a.points}`}>
                  Балл БРС
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="grade"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={a.points}
                    step={1}
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    aria-invalid={Boolean(error)}
                    className="tabular-nums"
                    data-autofocus
                  />
                  <span className="shrink-0 text-sm text-slate-500 tabular-nums dark:text-zinc-400">/ {a.points}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {[a.points, Math.round(a.points * 0.8), Math.round(a.points * 0.6)]
                    .filter((v, i, xs) => xs.indexOf(v) === i)
                    .map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setGrade(String(v))}
                        className="min-h-8 rounded-md border border-slate-200 px-2 text-xs text-slate-600 tabular-nums hover:bg-slate-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900"
                      >
                        {v}
                      </button>
                    ))}
                </div>
              </div>
              <div>
                <Label htmlFor="feedback" hint="Увидит студент">
                  Рецензия
                </Label>
                <Textarea
                  id="feedback"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Что получилось, что исправить, как добрать баллы"
                />
              </div>
              {error && (
                <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800/60 dark:bg-red-950/60 dark:text-red-300 sm:col-span-2">
                  {error}
                </p>
              )}
              <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
            </form>
          )}
        </div>
      )}
    </Sheet>
  );
}

// ───────────────────────── создание задания

function defaultDeadline(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  d.setHours(23, 59, 0, 0);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

const PROMPT_TEMPLATE = `## Условие

Опишите задачу.

## Формат ввода и вывода

- Вход: …
- Выход: …

## Критерии оценки

- корректность — 60%
- сложность алгоритма — 30%
- оформление кода — 10%`;

function CreateAssignmentSheet({
  open,
  cabinet,
  onClose,
  onCreated,
}: {
  open: boolean;
  cabinet: Cabinet | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const toast = useToast();
  const materialsState = useApi(open ? '/api/study' : null, toStudy);
  const groups = cabinet?.groups.length ? cabinet.groups : DEFAULT_GROUPS;
  const subjects = cabinet?.subjects ?? [];

  const [group, setGroup] = useState('');
  const [subject, setSubject] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [prompt, setPrompt] = useState(PROMPT_TEMPLATE);
  const [template, setTemplate] = useState('');
  const [deadline, setDeadline] = useState(defaultDeadline);
  const [weight, setWeight] = useState('5');
  const [materialId, setMaterialId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const g = group || groups[0] || '';
  const subj = subject || subjects[0] || '';
  const materials = (materialsState.data?.materials ?? []).filter((m) => !subj || m.subject === subj);

  function reset() {
    setGroup('');
    setSubject('');
    setTitle('');
    setDescription('');
    setPrompt(PROMPT_TEMPLATE);
    setTemplate('');
    setDeadline(defaultDeadline());
    setWeight('5');
    setMaterialId('');
    setError(null);
  }

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    const w = Number(weight);
    const dl = new Date(deadline);
    if (!g) return setError('Выберите группу.');
    if (!subj.trim()) return setError('Укажите дисциплину.');
    if (title.trim().length < 3) return setError('Название — от 3 символов.');
    if (!prompt.trim()) return setError('Напишите условие задачи.');
    if (Number.isNaN(dl.getTime()) || dl.getTime() <= Date.now()) return setError('Дедлайн должен быть в будущем.');
    if (!Number.isInteger(w) || w < 1 || w > 40) return setError('Максимальный балл БРС — от 1 до 40.');
    setBusy(true);
    setError(null);
    try {
      const raw = await post('/api/teacher/assignments', {
        groupName: g,
        subject: subj.trim(),
        title: title.trim(),
        description: description.trim(),
        taskPrompt: prompt,
        starterTemplate: template.trim() ? template : null,
        deadline: dl.toISOString(),
        brsWeight: w,
        ...(materialId ? { materialId } : {}),
      });
      const recipients = (raw as { recipients?: number } | null)?.recipients ?? 0;
      toast.success('Задание опубликовано', `${g} · ${recipients} ${plural(recipients, ['студент получил', 'студента получили', 'студентов получили'])} уведомление`);
      reset();
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось создать задание.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      size="xl"
      title="Новое онлайн-задание"
      description="Студенты группы увидят задачу в «Учёбе и ДЗ» и смогут решить её прямо на сайте"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} className="min-h-11 sm:min-h-0">
            Отмена
          </Button>
          <Button onClick={() => void submit()} loading={busy} icon={<Send size={16} strokeWidth={ICON_STROKE} />} className="min-h-11 sm:min-h-0">
            Опубликовать группе {g}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Группа</Label>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Группа">
            {groups.map((x) => (
              <button
                key={x}
                type="button"
                role="radio"
                aria-checked={g === x}
                onClick={() => setGroup(x)}
                className={cn(
                  'min-h-10 rounded-lg border px-3 text-sm tabular-nums transition-colors',
                  g === x
                    ? 'border-blue-200 bg-blue-50 font-medium text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-400'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-zinc-800 dark:bg-[#12141A] dark:text-zinc-400 dark:hover:bg-zinc-900',
                )}
              >
                {x}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label htmlFor="t-subject">Дисциплина</Label>
          {subjects.length > 0 ? (
            <Select id="t-subject" value={subj} onChange={(e) => setSubject(e.target.value)}>
              {subjects.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </Select>
          ) : (
            <Input id="t-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Алгоритмы и структуры данных" />
          )}
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="t-title">Название</Label>
          <Input id="t-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Онлайн-задача: бинарный поиск" data-autofocus />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="t-desc" hint="Необязательно · видно в карточке">
            Краткое описание
          </Label>
          <Input id="t-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Реализовать lower_bound за O(log n)" />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="t-prompt" hint="Markdown">
            Условие задачи
          </Label>
          <Textarea id="t-prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} className="code-editor min-h-48 text-[13px]" />
        </div>
        <div className="sm:col-span-2">
          <Label hint="Необязательно · предзаполнит редактор студента">Шаблон ответа</Label>
          <CodeEditor value={template} onChange={setTemplate} placeholder={'def lower_bound(a, x):\n    ...'} ariaLabel="Шаблон ответа" className="h-40" />
        </div>
        <div>
          <Label htmlFor="t-deadline">Дедлайн</Label>
          <Input id="t-deadline" type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="tabular-nums" />
        </div>
        <div>
          <Label htmlFor="t-weight" hint="1–40">
            Макс. балл БРС
          </Label>
          <Input id="t-weight" type="number" inputMode="numeric" min={1} max={40} value={weight} onChange={(e) => setWeight(e.target.value)} className="tabular-nums" />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="t-material" hint="Необязательно · кнопка рядом с условием">
            Методичка к задаче
          </Label>
          <Select id="t-material" value={materialId} onChange={(e) => setMaterialId(e.target.value)}>
            <option value="">Без методички</option>
            {materials.map((m) => (
              <option key={m.id} value={m.id}>
                {MATERIAL_CATEGORY_LABEL[m.category]} · {m.title}
              </option>
            ))}
          </Select>
        </div>
        {error && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800/60 dark:bg-red-950/60 dark:text-red-300 sm:col-span-2">
            {error}
          </p>
        )}
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Sheet>
  );
}
