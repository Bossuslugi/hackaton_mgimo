'use client';

import { useMemo, useState, type FormEvent } from 'react';
import {
  BookMarked,
  BookOpen,
  CalendarClock,
  CircleCheck,
  ClipboardList,
  Clock,
  ExternalLink,
  FileText,
  Search,
  Send,
  Sparkles,
} from 'lucide-react';
import { useCopilot } from '@/components/copilot/CopilotProvider';
import { StudentOnly } from '@/components/shell/StudentOnly';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Countdown } from '@/components/ui/Countdown';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input, Label, Select, Textarea } from '@/components/ui/Field';
import { Markdown } from '@/components/ui/Markdown';
import { PageHeader } from '@/components/ui/PageHeader';
import { Segmented } from '@/components/ui/Segmented';
import { Sheet } from '@/components/ui/Sheet';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { ApiError, post } from '@/lib/api';
import { cn } from '@/lib/cn';
import { fmtDate, fmtDateTime, MATERIAL_CATEGORY_LABEL, plural } from '@/lib/format';
import { toAssignment, toStudy } from '@/lib/normalize';
import type { Assignment, Material, MaterialCategory } from '@/lib/types';
import { ICON_STROKE } from '@/lib/ui';
import { useApi } from '@/lib/use-api';

type Tab = 'homework' | 'materials';
type HwFilter = 'active' | 'done' | 'all';
type Study = ReturnType<typeof toStudy>;

export default function StudyPage() {
  return (
    <StudentOnly>
      <StudyTrack />
    </StudentOnly>
  );
}

function StudyTrack() {
  const state = useApi<Study>('/api/study', toStudy);
  const [tab, setTab] = useState<Tab>('homework');
  const active = state.data?.assignments.filter((a) => a.status === 'ACTIVE' || a.status === 'OVERDUE').length ?? 0;

  return (
    <>
      <PageHeader
        title="Учёба и домашние задания"
        description="Дедлайны, сдача работ и материалы для подготовки"
        actions={
          <Segmented<Tab>
            ariaLabel="Раздел"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'homework', label: 'Домашние задания', count: state.data ? active : undefined },
              { value: 'materials', label: 'Материалы', count: state.data?.materials.length },
            ]}
          />
        }
      />
      {state.loading && !state.data ? (
        <div className="grid gap-3 md:grid-cols-2 lg:gap-4" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} lines={3} />
          ))}
        </div>
      ) : state.error ? (
        <ErrorState error={state.error} onRetry={state.reload} />
      ) : state.data ? (
        tab === 'homework' ? (
          <Homework
            items={state.data.assignments}
            onUpdate={(a) =>
              state.setData((d) => (d ? { ...d, assignments: d.assignments.map((x) => (x.id === a.id ? a : x)) } : d))
            }
          />
        ) : (
          <Materials items={state.data.materials} />
        )
      ) : null}
    </>
  );
}

// ───────────────────────── домашние задания

function Homework({ items, onUpdate }: { items: Assignment[]; onUpdate: (a: Assignment) => void }) {
  const [filter, setFilter] = useState<HwFilter>('active');
  const [submitting, setSubmitting] = useState<Assignment | null>(null);

  const isActive = (a: Assignment) => a.status === 'ACTIVE' || a.status === 'OVERDUE';
  const list = useMemo(() => {
    const xs = items.filter((a) => (filter === 'all' ? true : filter === 'active' ? isActive(a) : !isActive(a)));
    return xs.sort((a, b) =>
      filter === 'done' ? +new Date(b.deadline) - +new Date(a.deadline) : +new Date(a.deadline) - +new Date(b.deadline),
    );
  }, [items, filter]);

  const totalPoints = items.filter(isActive).reduce((s, a) => s + a.points, 0);

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Segmented<HwFilter>
          size="sm"
          ariaLabel="Фильтр заданий"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'active', label: 'Активные', count: items.filter(isActive).length },
            { value: 'done', label: 'Сданные', count: items.filter((a) => !isActive(a)).length },
            { value: 'all', label: 'Все', count: items.length },
          ]}
        />
        {totalPoints > 0 && (
          <p className="text-sm text-slate-500">
            На кону <span className="font-medium text-slate-900 tabular-nums">+{totalPoints}</span>{' '}
            {plural(totalPoints, ['балл', 'балла', 'баллов'])} БРС
          </p>
        )}
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={<CircleCheck size={20} strokeWidth={ICON_STROKE} />}
          title={filter === 'active' ? 'Все задания сданы' : 'Здесь пока пусто'}
          description={filter === 'active' ? 'Новые задания появятся, как только преподаватель их опубликует.' : undefined}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:gap-4">
          {list.map((a) => (
            <AssignmentCard key={a.id} a={a} onSubmit={() => setSubmitting(a)} />
          ))}
        </div>
      )}

      <SubmitSheet
        assignment={submitting}
        onClose={() => setSubmitting(null)}
        onDone={(a) => {
          onUpdate(a);
          setSubmitting(null);
        }}
      />
    </>
  );
}

function AssignmentCard({ a, onSubmit }: { a: Assignment; onSubmit: () => void }) {
  const copilot = useCopilot();
  const active = a.status === 'ACTIVE' || a.status === 'OVERDUE';

  const askAi = () =>
    copilot.open({
      mode: 'TUTOR',
      context: { kind: 'assignment', id: a.id, title: a.title, subject: a.subject, text: a.description },
      prompt: `Разбери задание «${a.title}» по дисциплине «${a.subject}»: с чего начать, ключевые шаги и типичные ошибки.`,
    });

  return (
    <Card className="flex flex-col p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 truncate text-xs text-slate-500">{a.subject}</p>
        {active ? (
          <Countdown deadline={a.deadline} />
        ) : a.status === 'GRADED' ? (
          <Badge tone="success" className="tabular-nums">
            Оценено{a.score !== null && a.score !== undefined ? ` · ${a.score}` : ''}
          </Badge>
        ) : (
          <Badge tone="brand">На проверке</Badge>
        )}
      </div>
      <h3 className="mt-1.5 text-[15px] font-semibold leading-snug text-slate-900 break-words">{a.title}</h3>
      {a.description && <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-slate-600">{a.description}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5 tabular-nums">
          <CalendarClock size={14} strokeWidth={ICON_STROKE} />
          до {fmtDateTime(a.deadline)}
        </span>
        {a.points > 0 && (
          <Badge tone="brand" className="tabular-nums">
            +{a.points} {plural(a.points, ['балл', 'балла', 'баллов'])} БРС
          </Badge>
        )}
      </div>

      {!active && a.submissionLink && (
        <a
          href={a.submissionLink}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex min-w-0 items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700"
        >
          <ExternalLink size={14} strokeWidth={ICON_STROKE} className="shrink-0" />
          <span className="truncate">{a.submissionLink}</span>
        </a>
      )}
      {!active && a.submittedAt && (
        <p className="mt-1 text-xs text-slate-500 tabular-nums">Сдано {fmtDateTime(a.submittedAt)}</p>
      )}

      <div className="mt-auto flex flex-col gap-2 pt-4 sm:flex-row">
        {active && (
          <Button onClick={onSubmit} icon={<Send size={16} strokeWidth={ICON_STROKE} />} className="min-h-11 sm:min-h-10 sm:flex-1">
            Сдать работу
          </Button>
        )}
        <Button
          variant="secondary"
          onClick={askAi}
          icon={<Sparkles size={16} strokeWidth={ICON_STROKE} className="text-blue-600" />}
          className="min-h-11 sm:min-h-10 sm:flex-1"
        >
          Разобрать с ИИ
        </Button>
      </div>
    </Card>
  );
}

function SubmitSheet({
  assignment,
  onClose,
  onDone,
}: {
  assignment: Assignment | null;
  onClose: () => void;
  onDone: (a: Assignment) => void;
}) {
  const toast = useToast();
  const [link, setLink] = useState('');
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const close = () => {
    setLink('');
    setComment('');
    setError(null);
    onClose();
  };

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    if (!assignment) return;
    let url: URL | null = null;
    try {
      url = new URL(link.trim());
    } catch {
      url = null;
    }
    if (!url || !/^https?:$/.test(url.protocol)) {
      setError('Вставьте ссылку на работу, начиная с https://');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const raw = await post(`/api/study/assignments/${assignment.id}/submit`, {
        link: url.toString(),
        comment: comment.trim(),
      });
      const fromApi = raw && typeof raw === 'object' && 'assignment' in raw ? toAssignment((raw as { assignment: unknown }).assignment) : null;
      onDone({
        ...assignment,
        ...(fromApi ?? {}),
        status: fromApi?.status && fromApi.status !== 'ACTIVE' ? fromApi.status : 'SUBMITTED',
        submissionLink: fromApi?.submissionLink ?? url.toString(),
        submittedAt: fromApi?.submittedAt ?? new Date().toISOString(),
      });
      toast.success('Работа отправлена', `${assignment.subject} · ${assignment.title}`);
      setLink('');
      setComment('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось отправить работу.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={assignment !== null}
      onClose={close}
      title="Сдать работу"
      description={assignment ? `${assignment.subject} · ${assignment.title}` : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={close} className="min-h-11 sm:min-h-0">
            Отмена
          </Button>
          <Button onClick={() => void submit()} loading={busy} icon={<Send size={16} strokeWidth={ICON_STROKE} />} className="min-h-11 sm:min-h-0">
            Отправить на проверку
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        {assignment && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
            <Clock size={14} strokeWidth={ICON_STROKE} className="text-slate-400" />
            <span className="tabular-nums">Дедлайн {fmtDateTime(assignment.deadline)}</span>
            <Countdown deadline={assignment.deadline} />
          </div>
        )}
        <div>
          <Label htmlFor="sub-link" hint="GitHub, Диск, Overleaf">
            Ссылка на работу
          </Label>
          <Input
            id="sub-link"
            type="url"
            inputMode="url"
            placeholder="https://github.com/…"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            aria-invalid={Boolean(error)}
            data-autofocus
          />
        </div>
        <div>
          <Label htmlFor="sub-comment" hint="Необязательно">
            Комментарий преподавателю
          </Label>
          <Textarea
            id="sub-comment"
            placeholder="Что сделано, на что обратить внимание"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </div>
        {error && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Sheet>
  );
}

// ───────────────────────── материалы

const CATEGORY_ICON: Record<MaterialCategory, typeof BookOpen> = {
  NOTES: BookOpen,
  CHEATSHEET: BookMarked,
  TICKETS: ClipboardList,
  LAB_TEMPLATE: FileText,
};

function Materials({ items }: { items: Material[] }) {
  const copilot = useCopilot();
  const [subject, setSubject] = useState('ALL');
  const [category, setCategory] = useState<MaterialCategory | 'ALL'>('ALL');
  const [query, setQuery] = useState('');
  const [reading, setReading] = useState<Material | null>(null);

  const subjects = useMemo(() => Array.from(new Set(items.map((m) => m.subject))).sort(), [items]);
  const list = items.filter(
    (m) =>
      (subject === 'ALL' || m.subject === subject) &&
      (category === 'ALL' || m.category === category) &&
      (!query.trim() || `${m.title} ${m.description ?? ''}`.toLowerCase().includes(query.trim().toLowerCase())),
  );

  const cats: (MaterialCategory | 'ALL')[] = ['ALL', 'NOTES', 'CHEATSHEET', 'TICKETS', 'LAB_TEMPLATE'];

  return (
    <>
      <Card className="mb-4 p-3 sm:p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="relative">
            <Search size={16} strokeWidth={ICON_STROKE} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по материалам"
              aria-label="Поиск по материалам"
              className="pl-9"
            />
          </div>
          <Select value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Предмет">
            <option value="ALL">Все предметы</option>
            {subjects.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Категория">
          {cats.map((c) => {
            const on = c === category;
            return (
              <button
                key={c}
                type="button"
                aria-pressed={on}
                onClick={() => setCategory(c)}
                className={cn(
                  'min-h-9 rounded-lg border px-3 text-sm transition-colors',
                  on ? 'border-blue-200 bg-blue-50 font-medium text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                )}
              >
                {c === 'ALL' ? 'Все' : MATERIAL_CATEGORY_LABEL[c]}
              </button>
            );
          })}
        </div>
      </Card>

      {list.length === 0 ? (
        <EmptyState
          icon={<Search size={20} strokeWidth={ICON_STROKE} />}
          title="Ничего не нашлось"
          description="Попробуйте другой предмет или категорию."
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setSubject('ALL');
                setCategory('ALL');
                setQuery('');
              }}
            >
              Сбросить фильтры
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:gap-4 xl:grid-cols-3">
          {list.map((m) => {
            const Icon = CATEGORY_ICON[m.category];
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setReading(m)}
                className="group flex min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-slate-300 sm:p-5"
              >
                <div className="flex items-center justify-between gap-2">
                  <Badge tone="neutral" icon={<Icon size={12} strokeWidth={ICON_STROKE} />}>
                    {MATERIAL_CATEGORY_LABEL[m.category]}
                  </Badge>
                  {m.readingMinutes && (
                    <span className="text-xs text-slate-400 tabular-nums">{m.readingMinutes} мин</span>
                  )}
                </div>
                <h3 className="mt-3 text-[15px] font-semibold leading-snug text-slate-900 break-words group-hover:text-blue-700">
                  {m.title}
                </h3>
                <p className="mt-1 truncate text-xs text-slate-500">{m.subject}</p>
                {m.description && <p className="mt-2 line-clamp-2 text-sm text-slate-600">{m.description}</p>}
                {m.updatedAt && (
                  <p className="mt-auto pt-3 text-xs text-slate-400 tabular-nums">Обновлено {fmtDate(m.updatedAt)}</p>
                )}
              </button>
            );
          })}
        </div>
      )}

      <Sheet
        open={reading !== null}
        onClose={() => setReading(null)}
        size="xl"
        title={reading?.title ?? ''}
        description={reading ? `${reading.subject} · ${MATERIAL_CATEGORY_LABEL[reading.category]}` : undefined}
        footer={
          reading && (
            <Button
              variant="secondary"
              icon={<Sparkles size={16} strokeWidth={ICON_STROKE} className="text-blue-600" />}
              className="min-h-11 sm:min-h-0"
              onClick={() => {
                const m = reading;
                setReading(null);
                copilot.open({
                  mode: 'TUTOR',
                  context: { kind: 'material', id: m.id, title: m.title, subject: m.subject, text: m.contentMarkdown.slice(0, 4000) },
                  prompt: `Разбери материал «${m.title}»: выдели главное и задай мне 3 вопроса для самопроверки.`,
                });
              }}
            >
              Разобрать с ИИ
            </Button>
          )
        }
      >
        {reading && (
          <div className="mx-auto max-w-2xl py-1">
            {reading.contentMarkdown.trim() ? (
              <Markdown source={reading.contentMarkdown} />
            ) : (
              <p className="text-sm text-slate-500">Текст материала пока не загружен.</p>
            )}
          </div>
        )}
      </Sheet>
    </>
  );
}
