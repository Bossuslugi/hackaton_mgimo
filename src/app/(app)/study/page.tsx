'use client';

import { useMemo, useState } from 'react';
import {
  BookMarked,
  BookOpen,
  CalendarClock,
  Code2,
  CircleCheck,
  ClipboardList,
  ExternalLink,
  FileText,
  ListChecks,
  Search,
  Sparkles,
} from 'lucide-react';
import { useCopilot } from '@/components/copilot/CopilotProvider';
import { WriteTeacherButton } from '@/components/messages/WriteTeacherButton';
import { useSession } from '@/components/shell/SessionProvider';
import { StudentOnly } from '@/components/shell/StudentOnly';
import { TeacherCabinet } from '@/components/study/TeacherCabinet';
import { QuizPanel } from '@/components/study/QuizPanel';
import { Workspace } from '@/components/study/Workspace';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Countdown } from '@/components/ui/Countdown';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input, Select } from '@/components/ui/Field';
import { Markdown } from '@/components/ui/Markdown';
import { PageHeader } from '@/components/ui/PageHeader';
import { Segmented } from '@/components/ui/Segmented';
import { Sheet } from '@/components/ui/Sheet';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { cn } from '@/lib/cn';
import { fmtDate, fmtDateTime, MATERIAL_CATEGORY_LABEL, plural } from '@/lib/format';
import { toStudy } from '@/lib/normalize';
import type { Assignment, Material, MaterialCategory } from '@/lib/types';
import { ICON_STROKE } from '@/lib/ui';
import { useApi } from '@/lib/use-api';

type Tab = 'homework' | 'materials';
type HwFilter = 'active' | 'done' | 'all';
type Study = ReturnType<typeof toStudy>;

export default function StudyPage() {
  const { isTeacher } = useSession();
  if (isTeacher) return <TeacherCabinet />;
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
            materials={state.data.materials}
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

function Homework({ items, materials, onUpdate }: { items: Assignment[]; materials: Material[]; onUpdate: (a: Assignment) => void }) {
  const [filter, setFilter] = useState<HwFilter>('active');
  const [openId, setOpenId] = useState<string | null>(null);
  const open = openId ? (items.find((a) => a.id === openId) ?? null) : null;

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
          <p className="text-sm text-slate-500 dark:text-zinc-400">
            На кону <span className="font-medium text-slate-900 dark:text-zinc-50 tabular-nums">+{totalPoints}</span>{' '}
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
            <AssignmentCard key={a.id} a={a} onOpen={() => setOpenId(a.id)} />
          ))}
        </div>
      )}

      <Workspace assignment={open} materials={materials} onClose={() => setOpenId(null)} onUpdate={onUpdate} />
    </>
  );
}

function AssignmentCard({ a, onOpen }: { a: Assignment; onOpen: () => void }) {
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
        <p className="min-w-0 truncate text-xs text-slate-500 dark:text-zinc-400">{a.subject}</p>
        {active ? (
          <Countdown deadline={a.deadline} />
        ) : a.status === 'GRADED' ? (
          <Badge tone="success" className="tabular-nums">
            Оценено{(a.gradeAwarded ?? a.score) !== null && (a.gradeAwarded ?? a.score) !== undefined ? ` · ${a.gradeAwarded ?? a.score} / ${a.points}` : ''}
          </Badge>
        ) : (
          <Badge tone="brand">На проверке</Badge>
        )}
      </div>
      <h3 className="mt-1.5 text-[15px] font-semibold leading-snug text-slate-900 dark:text-zinc-50 break-words">{a.title}</h3>
      {a.description && <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-slate-600 dark:text-zinc-400">{a.description}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500 dark:text-zinc-400">
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
          className="mt-3 inline-flex min-w-0 items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-400"
        >
          <ExternalLink size={14} strokeWidth={ICON_STROKE} className="shrink-0" />
          <span className="truncate">{a.submissionLink}</span>
        </a>
      )}
      {!active && a.submittedAt && (
        <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400 tabular-nums">Сдано {fmtDateTime(a.submittedAt)}</p>
      )}

      {a.status === 'GRADED' && a.teacherFeedback && (
        <p className="mt-3 line-clamp-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/60 dark:text-emerald-200">
          {a.teacherFeedback}
        </p>
      )}

      <div className="mt-auto flex flex-col gap-2 pt-4 sm:flex-row sm:flex-wrap">
        <Button
          variant={active ? 'primary' : 'secondary'}
          onClick={onOpen}
          icon={<Code2 size={16} strokeWidth={ICON_STROKE} />}
          className="min-h-11 sm:min-h-10 sm:flex-1"
        >
          {active ? 'Открыть задачу и решить' : a.status === 'GRADED' ? 'Решение и рецензия' : 'Открыть решение'}
        </Button>
        <Button
          variant="secondary"
          onClick={askAi}
          icon={<Sparkles size={16} strokeWidth={ICON_STROKE} className="text-blue-600 dark:text-blue-400" />}
          className="min-h-11 sm:min-h-10 sm:flex-1"
        >
          Разобрать с ИИ
        </Button>
      </div>
      <WriteTeacherButton
        teacherName={a.authorName}
        draft={`Добрый день! Подскажите по поводу задания «${a.title}»: `}
        className="mt-1 self-start px-2 text-slate-500 dark:text-zinc-400"
      />
    </Card>
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
  const [reading, setReadingRaw] = useState<Material | null>(null);
  const [quiz, setQuiz] = useState(false);
  const setReading = (m: Material | null) => {
    setQuiz(false);
    setReadingRaw(m);
  };

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
            <Search size={16} strokeWidth={ICON_STROKE} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
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
                  on ? 'border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 font-medium text-blue-700 dark:text-blue-400' : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#12141A] text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-900',
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
                className="group flex min-w-0 flex-col rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#12141A] p-4 text-left transition-colors hover:border-slate-300 dark:hover:border-zinc-700 sm:p-5"
              >
                <div className="flex items-center justify-between gap-2">
                  <Badge tone="neutral" icon={<Icon size={12} strokeWidth={ICON_STROKE} />}>
                    {MATERIAL_CATEGORY_LABEL[m.category]}
                  </Badge>
                  {m.readingMinutes && (
                    <span className="text-xs text-slate-400 dark:text-zinc-500 tabular-nums">{m.readingMinutes} мин</span>
                  )}
                </div>
                <h3 className="mt-3 text-[15px] font-semibold leading-snug text-slate-900 dark:text-zinc-50 break-words group-hover:text-blue-700 dark:group-hover:text-blue-400">
                  {m.title}
                </h3>
                <p className="mt-1 truncate text-xs text-slate-500 dark:text-zinc-400">{m.subject}</p>
                {m.description && <p className="mt-2 line-clamp-2 text-sm text-slate-600 dark:text-zinc-400">{m.description}</p>}
                {m.updatedAt && (
                  <p className="mt-auto pt-3 text-xs text-slate-400 dark:text-zinc-500 tabular-nums">Обновлено {fmtDate(m.updatedAt)}</p>
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
            <>
            {!quiz && (
              <Button
                onClick={() => setQuiz(true)}
                icon={<ListChecks size={16} strokeWidth={ICON_STROKE} />}
                className="min-h-11 sm:min-h-0"
              >
                Проверить знания (Мини-тест от ИИ)
              </Button>
            )}
            <Button
              variant="secondary"
              icon={<Sparkles size={16} strokeWidth={ICON_STROKE} className="text-blue-600 dark:text-blue-400" />}
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
            </>
          )
        }
      >
        {reading && quiz ? (
          <QuizPanel materialId={reading.id} onBack={() => setQuiz(false)} />
        ) : reading && (
          <div className="mx-auto max-w-2xl py-1">
            {reading.contentMarkdown.trim() ? (
              <Markdown source={reading.contentMarkdown} />
            ) : (
              <p className="text-sm text-slate-500 dark:text-zinc-400">Текст материала пока не загружен.</p>
            )}
          </div>
        )}
      </Sheet>
    </>
  );
}
