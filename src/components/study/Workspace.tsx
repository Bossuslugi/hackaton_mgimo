'use client';

import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  BookOpen,
  CalendarClock,
  CircleCheck,
  ExternalLink,
  FileCode2,
  Link2,
  MessageSquareQuote,
  RotateCcw,
  Send,
  Sparkles,
  Target,
} from 'lucide-react';
import { useCopilot } from '@/components/copilot/CopilotProvider';
import { WriteTeacherButton } from '@/components/messages/WriteTeacherButton';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Countdown } from '@/components/ui/Countdown';
import { Input, Label, Textarea } from '@/components/ui/Field';
import { Markdown } from '@/components/ui/Markdown';
import { Segmented } from '@/components/ui/Segmented';
import { Sheet } from '@/components/ui/Sheet';
import { useToast } from '@/components/ui/Toast';
import { ApiError, post } from '@/lib/api';
import { cn } from '@/lib/cn';
import { fmtDateTime, MATERIAL_CATEGORY_LABEL, plural } from '@/lib/format';
import { toAssignment } from '@/lib/normalize';
import type { Assignment, Material } from '@/lib/types';
import { ICON_STROKE } from '@/lib/ui';
import { CodeEditor } from './CodeEditor';

type Pane = 'task' | 'solution';

const draftKey = (id: string) => `orbita-draft-${id}`;

function readDraft(id: string): string | null {
  try {
    return localStorage.getItem(draftKey(id));
  } catch {
    return null;
  }
}
function writeDraft(id: string, v: string | null) {
  try {
    if (v === null) localStorage.removeItem(draftKey(id));
    else localStorage.setItem(draftKey(id), v);
  } catch {
    /* черновик — удобство, не критично */
  }
}

export function isHttpsUrl(v: string): boolean {
  try {
    const u = new URL(v.trim());
    return u.protocol === 'https:' && Boolean(u.hostname);
  } catch {
    return false;
  }
}

/**
 * Интерактивная рабочая зона: Split-View на ≥ lg, вкладки «Условие / Решение» на мобильном.
 * POST /api/study/assignments/[id]/submit { solutionText, submissionUrl?, studentComment? }
 */
export function Workspace({
  assignment,
  materials,
  onClose,
  onUpdate,
}: {
  assignment: Assignment | null;
  materials: Material[];
  onClose: () => void;
  onUpdate: (a: Assignment) => void;
}) {
  if (!assignment || typeof document === 'undefined') return null;
  return createPortal(
    <WorkspaceInner key={assignment.id} a={assignment} materials={materials} onClose={onClose} onUpdate={onUpdate} />,
    document.body,
  );
}

function WorkspaceInner({
  a,
  materials,
  onClose,
  onUpdate,
}: {
  a: Assignment;
  materials: Material[];
  onClose: () => void;
  onUpdate: (a: Assignment) => void;
}) {
  const toast = useToast();
  const copilot = useCopilot();
  const titleId = useId();
  const root = useRef<HTMLDivElement>(null);
  const graded = a.status === 'GRADED';
  const initial = a.solutionText ?? readDraft(a.id) ?? a.starterTemplate ?? '';
  const [pane, setPane] = useState<Pane>('task');
  const [code, setCode] = useState(initial);
  const [url, setUrl] = useState(a.submissionLink ?? '');
  const [comment, setComment] = useState(a.studentComment ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState<Material | null>(null);

  // привязанная методичка, иначе — первый конспект по предмету
  const material = useMemo(
    () =>
      (a.material && materials.find((m) => m.id === a.material!.id)) ??
      materials.find((m) => m.subject === a.subject && m.category === 'NOTES') ??
      materials.find((m) => m.subject === a.subject) ??
      null,
    [a, materials],
  );

  // Esc закрывает, скролл страницы заблокирован
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    root.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('[data-sheet]')) onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, []);

  // автосохранение черновика
  useEffect(() => {
    if (graded) return;
    const t = window.setTimeout(() => {
      if (code && code !== a.starterTemplate && code !== a.solutionText) writeDraft(a.id, code);
    }, 400);
    return () => window.clearTimeout(t);
  }, [code, a, graded]);

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    const link = url.trim();
    const text = code.trim() && code !== a.starterTemplate ? code : '';
    if (link && !isHttpsUrl(link)) {
      setError('Ссылка должна начинаться с https:// — например, https://github.com/…');
      setPane('solution');
      return;
    }
    if (!text && !link) {
      setError('Напишите решение в редакторе или приложите ссылку на репозиторий/файл.');
      setPane('solution');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const raw = await post(`/api/study/assignments/${a.id}/submit`, {
        ...(text ? { solutionText: code } : {}),
        ...(link ? { submissionUrl: link } : {}),
        ...(comment.trim() ? { studentComment: comment.trim() } : {}),
      });
      const body = raw as { assignment?: unknown; late?: boolean } | null;
      const fromApi = body?.assignment ? toAssignment(body.assignment) : null;
      const next: Assignment = {
        ...a,
        ...(fromApi ?? {}),
        status: fromApi?.status && fromApi.status !== 'ACTIVE' ? fromApi.status : 'SUBMITTED',
        solutionText: fromApi?.solutionText ?? (text ? code : a.solutionText),
        submissionLink: fromApi?.submissionLink ?? (link || a.submissionLink),
        submittedAt: fromApi?.submittedAt ?? new Date().toISOString(),
      };
      writeDraft(a.id, null);
      onUpdate(next);
      toast.success(
        body?.late ? 'Решение отправлено после дедлайна' : 'Решение отправлено преподавателю',
        `${a.subject} · ${a.title}`,
      );
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось отправить решение.');
    } finally {
      setBusy(false);
    }
  }

  const statusBadge =
    a.status === 'GRADED' ? (
      <Badge tone="success" icon={<CircleCheck size={12} strokeWidth={ICON_STROKE} />}>
        Проверено
      </Badge>
    ) : a.status === 'SUBMITTED' ? (
      <Badge tone="brand">На проверке</Badge>
    ) : (
      <Countdown deadline={a.deadline} />
    );

  return (
    <div
      ref={root}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex flex-col bg-slate-50 outline-none animate-[sheet-in_200ms_ease-out] dark:bg-zinc-950"
    >
      {/* шапка рабочей зоны */}
      <header className="flex shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-2 py-2 dark:border-zinc-800 dark:bg-[#12141A] sm:px-4">
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть рабочую зону"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50 sm:size-9"
        >
          <ArrowLeft size={18} strokeWidth={ICON_STROKE} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-slate-500 dark:text-zinc-400">
            {a.subject}
            {a.authorName && <span className="hidden sm:inline"> · {a.authorName}</span>}
          </p>
          <h2 id={titleId} className="truncate text-sm font-semibold text-slate-900 dark:text-zinc-50 sm:text-base">
            {a.title}
          </h2>
        </div>
        <div className="hidden shrink-0 items-center gap-2 sm:flex">{statusBadge}</div>
        {!graded && (
          <Button
            onClick={() => void submit()}
            loading={busy}
            icon={<Send size={16} strokeWidth={ICON_STROKE} />}
            className="hidden lg:inline-flex"
          >
            Отправить решение преподавателю
          </Button>
        )}
      </header>

      {/* вкладки на мобильном */}
      <div className="shrink-0 border-b border-slate-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-[#12141A] lg:hidden">
        <Segmented<Pane>
          block
          ariaLabel="Панель рабочей зоны"
          value={pane}
          onChange={setPane}
          options={[
            { value: 'task', label: 'Условие' },
            { value: 'solution', label: graded ? 'Решение и оценка' : 'Решение' },
          ]}
        />
      </div>

      <div className="grid min-h-0 flex-1 lg:grid-cols-2">
        {/* ЛЕВАЯ ПАНЕЛЬ — условие */}
        <section
          aria-label="Условие задачи"
          className={cn(
            'min-h-0 overflow-y-auto overscroll-contain border-slate-200 dark:border-zinc-800 lg:block lg:border-r',
            pane === 'task' ? 'block' : 'hidden',
          )}
        >
          <div className="mx-auto max-w-2xl px-4 py-5 sm:px-6">
            <div className="flex flex-wrap items-center gap-2 sm:hidden">{statusBadge}</div>

            <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-0 sm:grid-cols-3">
              <Criterion icon={<Target size={14} strokeWidth={ICON_STROKE} />} label="Вес в БРС" value={`${a.points} ${plural(a.points, ['балл', 'балла', 'баллов'])}`} />
              <Criterion icon={<CalendarClock size={14} strokeWidth={ICON_STROKE} />} label="Дедлайн" value={fmtDateTime(a.deadline)} />
              <Criterion
                icon={<FileCode2 size={14} strokeWidth={ICON_STROKE} />}
                label="Формат сдачи"
                value="Код или ссылка"
                className="col-span-2 sm:col-span-1"
              />
            </div>

            {material && (
              <button
                type="button"
                onClick={() => setReading(material)}
                className="mt-3 flex w-full min-w-0 items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left transition-colors hover:border-slate-300 dark:border-zinc-800 dark:bg-[#12141A] dark:hover:border-zinc-700"
              >
                <BookOpen size={16} strokeWidth={ICON_STROKE} className="shrink-0 text-blue-600 dark:text-blue-400" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-900 dark:text-zinc-50">{material.title}</span>
                  <span className="block text-xs text-slate-500 dark:text-zinc-400">
                    {MATERIAL_CATEGORY_LABEL[material.category]} · быстрый просмотр
                  </span>
                </span>
                <ExternalLink size={14} strokeWidth={ICON_STROKE} className="shrink-0 text-slate-400 dark:text-zinc-500" />
              </button>
            )}

            <div className="mt-5">
              {a.taskPrompt.trim() ? (
                <Markdown source={a.taskPrompt} />
              ) : (
                <>
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-400">Задание</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-zinc-300">
                    {a.description ?? 'Условие задания опубликовано преподавателем в LMS.'}
                  </p>
                </>
              )}
            </div>

            <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-200 pt-4 dark:border-zinc-800">
              <Button
                variant="secondary"
                size="sm"
                icon={<Sparkles size={14} strokeWidth={ICON_STROKE} className="text-blue-600 dark:text-blue-400" />}
                className="min-h-11 sm:min-h-9"
                onClick={() =>
                  copilot.open({
                    mode: 'TUTOR',
                    context: { kind: 'assignment', id: a.id, title: a.title, subject: a.subject, text: (a.taskPrompt || a.description || '').slice(0, 4000) },
                    prompt: `Помоги начать задачу «${a.title}»: план решения без готового кода.`,
                  })
                }
              >
                Разобрать с ИИ
              </Button>
              <WriteTeacherButton
                teacherName={a.authorName}
                draft={`Добрый день! Подскажите по поводу задания «${a.title}»: `}
              />
            </div>
          </div>
        </section>

        {/* ПРАВАЯ ПАНЕЛЬ — решение */}
        <section
          aria-label="Решение"
          className={cn('min-h-0 flex-col lg:flex', pane === 'solution' ? 'flex' : 'hidden')}
        >
          <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
            {graded && <GradePanel a={a} />}

            <div className="flex min-h-[18rem] flex-1 flex-col">
              <div className="mb-1.5 flex items-baseline justify-between gap-2">
                <label htmlFor="ws-code" className="text-sm font-medium text-slate-900 dark:text-zinc-50">
                  {graded ? 'Отправленное решение' : 'Решение'}
                </label>
                {!graded && a.starterTemplate && code !== a.starterTemplate && (
                  <button
                    type="button"
                    onClick={() => setCode(a.starterTemplate ?? '')}
                    className="inline-flex min-h-9 items-center gap-1 rounded-md px-1.5 text-xs text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-50"
                  >
                    <RotateCcw size={12} strokeWidth={ICON_STROKE} />
                    Вернуть шаблон
                  </button>
                )}
              </div>
              <CodeEditor
                id="ws-code"
                value={code}
                onChange={setCode}
                readOnly={graded}
                placeholder="Напишите решение здесь…"
                className="min-h-[16rem] flex-1"
              />
              <p className="mt-1.5 text-xs text-slate-500 tabular-nums dark:text-zinc-400">
                {code.split('\n').length} {plural(code.split('\n').length, ['строка', 'строки', 'строк'])} ·{' '}
                {code.length.toLocaleString('ru-RU')} / 20 000 символов{!graded && ' · черновик сохраняется на устройстве'}
              </p>
            </div>

            <div>
              <Label htmlFor="ws-url" hint="Необязательно · только https://">
                Ссылка на репозиторий или файл
              </Label>
              <div className="relative">
                <Link2 size={16} strokeWidth={ICON_STROKE} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
                <Input
                  id="ws-url"
                  type="url"
                  inputMode="url"
                  placeholder="https://github.com/…"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  readOnly={graded}
                  aria-invalid={url.trim() !== '' && !isHttpsUrl(url)}
                  className="pl-9"
                />
              </div>
              {url.trim() !== '' && !isHttpsUrl(url) && (
                <p className="mt-1 text-xs text-red-700 dark:text-red-300">Ссылка должна начинаться с https://</p>
              )}
            </div>

            <div>
              <Label htmlFor="ws-comment" hint="Необязательно">
                Комментарий преподавателю
              </Label>
              <Textarea
                id="ws-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                readOnly={graded}
                placeholder="Что сделано, на что обратить внимание"
                className="min-h-20"
              />
            </div>

            {error && (
              <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800/60 dark:bg-red-950/60 dark:text-red-300">
                {error}
              </p>
            )}
            <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
          </form>

          {!graded && (
            <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-zinc-800 dark:bg-[#12141A] sm:px-6 lg:hidden">
              <Button block size="lg" loading={busy} onClick={() => void submit()} icon={<Send size={16} strokeWidth={ICON_STROKE} />}>
                {a.status === 'SUBMITTED' ? 'Отправить повторно' : 'Отправить решение преподавателю'}
              </Button>
            </div>
          )}
        </section>
      </div>

      <Sheet
        open={reading !== null}
        onClose={() => setReading(null)}
        size="xl"
        title={reading?.title ?? ''}
        description={reading ? `${reading.subject} · ${MATERIAL_CATEGORY_LABEL[reading.category]}` : undefined}
      >
        {reading && (
          <div className="mx-auto max-w-2xl py-1">
            {reading.contentMarkdown.trim() ? (
              <Markdown source={reading.contentMarkdown} />
            ) : (
              <p className="text-sm text-slate-500 dark:text-zinc-400">Текст материала пока не загружен.</p>
            )}
          </div>
        )}
      </Sheet>
    </div>
  );
}

function Criterion({ icon, label, value, className }: { icon: React.ReactNode; label: string; value: string; className?: string }) {
  return (
    <div className={cn('min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-[#12141A]', className)}>
      <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400">
        {icon}
        {label}
      </p>
      <p className="mt-0.5 truncate text-sm font-medium text-slate-900 tabular-nums dark:text-zinc-50">{value}</p>
    </div>
  );
}

function GradePanel({ a }: { a: Assignment }) {
  const got = a.gradeAwarded ?? a.score ?? 0;
  const pct = a.points ? Math.round((got / a.points) * 100) : 0;
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800/60 dark:bg-emerald-950/60">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-800 dark:text-emerald-200">
          <CircleCheck size={16} strokeWidth={ICON_STROKE} />
          Работа проверена
        </p>
        <p className="text-2xl font-semibold tracking-tight text-emerald-800 tabular-nums dark:text-emerald-200">
          {got}
          <span className="text-sm font-normal text-emerald-700 dark:text-emerald-300"> / {a.points}</span>
        </p>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/50">
        <div className="h-full rounded-full bg-emerald-600" style={{ width: `${pct}%` }} />
      </div>
      {a.teacherFeedback && (
        <div className="mt-3 flex gap-2 text-sm text-emerald-800 dark:text-emerald-200">
          <MessageSquareQuote size={16} strokeWidth={ICON_STROKE} className="mt-0.5 shrink-0" />
          <p className="break-words">
            <span className="font-medium">Рецензия{a.authorName ? ` · ${a.authorName}` : ''}:</span> {a.teacherFeedback}
          </p>
        </div>
      )}
    </div>
  );
}
