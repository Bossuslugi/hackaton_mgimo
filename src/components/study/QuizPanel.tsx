'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Check, RotateCcw, Sparkles, Trophy, X } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { ApiError, post } from '@/lib/api';
import { cn } from '@/lib/cn';
import { toQuiz, type Quiz } from '@/lib/normalize-v3';
import { ICON_STROKE } from '@/lib/ui';

const SOURCE_LABEL: Record<string, string> = {
  llm: 'Сгенерировано ИИ',
  bank: 'Банк вопросов методички',
  rules: 'Автовопросы по терминам',
};

/** Мини-тест от ИИ по методичке: POST /api/ai/quiz { materialId }, мгновенная проверка ответов. */
export function QuizPanel({ materialId, onBack }: { materialId: string; onBack: () => void }) {
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = toQuiz(await post('/api/ai/quiz', { materialId }));
      if (!q.questions.length) throw new ApiError(422, 'По этому тексту не удалось составить вопросы.', null);
      setQuiz(q);
      setAnswers(q.questions.map(() => null));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось получить тест.');
    } finally {
      setLoading(false);
    }
  }, [materialId]);

  useEffect(() => {
    void load();
  }, [load]);

  const done = quiz !== null && answers.every((a) => a !== null);
  const score = quiz ? answers.filter((a, i) => a === quiz.questions[i].correctIndex).length : 0;

  return (
    <div className="mx-auto max-w-2xl py-1">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-1.5 text-sm text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          <ArrowLeft size={16} strokeWidth={ICON_STROKE} />
          К тексту методички
        </button>
        {quiz && (
          <Badge tone="brand" icon={<Sparkles size={12} strokeWidth={ICON_STROKE} />}>
            {SOURCE_LABEL[quiz.source] ?? 'Мини-тест'}
          </Badge>
        )}
      </div>

      {loading ? (
        <div className="space-y-4" aria-busy="true" aria-label="Готовим вопросы">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2 rounded-xl border border-slate-200 p-4 dark:border-zinc-800">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800/60 dark:bg-red-950/60 dark:text-red-300">
          <p>{error}</p>
          <Button variant="secondary" size="sm" onClick={() => void load()} icon={<RotateCcw size={14} strokeWidth={ICON_STROKE} />} className="mt-3">
            Попробовать ещё раз
          </Button>
        </div>
      ) : quiz ? (
        <>
          <ol className="space-y-4">
            {quiz.questions.map((q, qi) => {
              const picked = answers[qi];
              const answered = picked !== null;
              const right = picked === q.correctIndex;
              return (
                <li key={qi} className="rounded-xl border border-slate-200 p-4 dark:border-zinc-800">
                  <p className="text-sm font-medium leading-relaxed text-slate-900 dark:text-zinc-50">
                    <span className="mr-1.5 text-slate-400 tabular-nums dark:text-zinc-500">{qi + 1}.</span>
                    {q.question}
                  </p>
                  <div className="mt-3 grid gap-2" role="radiogroup" aria-label={`Вопрос ${qi + 1}`}>
                    {q.options.map((opt, oi) => {
                      const isCorrect = oi === q.correctIndex;
                      const isPicked = oi === picked;
                      return (
                        <button
                          key={oi}
                          type="button"
                          role="radio"
                          aria-checked={isPicked}
                          disabled={answered}
                          onClick={() => setAnswers((xs) => xs.map((x, i) => (i === qi ? oi : x)))}
                          className={cn(
                            'flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-[color,background-color,border-color,transform] duration-150 active:scale-[0.99]',
                            !answered && 'border-slate-200 bg-white text-slate-700 hover:border-blue-600 hover:bg-blue-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-blue-500 dark:hover:bg-blue-500/10',
                            answered && isCorrect && 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/60 dark:text-emerald-200',
                            answered && isPicked && !isCorrect && 'border-red-200 bg-red-50 text-red-800 dark:border-red-800/60 dark:bg-red-950/60 dark:text-red-200',
                            answered && !isPicked && !isCorrect && 'border-slate-200 text-slate-400 dark:border-zinc-800 dark:text-zinc-600',
                          )}
                        >
                          <span
                            className={cn(
                              'inline-flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium tabular-nums',
                              answered && isCorrect
                                ? 'border-emerald-600 bg-emerald-600 text-white'
                                : answered && isPicked
                                  ? 'border-red-600 bg-red-600 text-white'
                                  : 'border-slate-300 text-slate-500 dark:border-zinc-700 dark:text-zinc-400',
                            )}
                            aria-hidden
                          >
                            {answered && isCorrect ? (
                              <Check size={12} strokeWidth={2.5} className="animate-[check-in_200ms_ease-out]" />
                            ) : answered && isPicked ? (
                              <X size={12} strokeWidth={2.5} />
                            ) : (
                              'АБВГ'[oi] ?? oi + 1
                            )}
                          </span>
                          <span className="min-w-0 break-words">{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                  {answered && (
                    <p
                      className={cn(
                        'mt-3 animate-[toast-in_180ms_ease-out] rounded-lg px-3 py-2 text-sm leading-relaxed',
                        right ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200' : 'bg-slate-50 text-slate-700 dark:bg-zinc-900 dark:text-zinc-300',
                      )}
                    >
                      <b className="font-semibold">{right ? 'Верно. ' : 'Не совсем. '}</b>
                      {q.explanation}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
          {done && (
            <div className="mt-4 flex flex-col gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-500/30 dark:bg-blue-500/10 sm:flex-row sm:items-center">
              <Trophy size={20} strokeWidth={ICON_STROKE} className="shrink-0 text-blue-700 dark:text-blue-400" />
              <p className="flex-1 text-sm text-blue-800 dark:text-blue-300">
                Результат: <b className="font-semibold tabular-nums">{score} из {quiz.questions.length}</b>.{' '}
                {score === quiz.questions.length ? 'Отлично — тема усвоена!' : 'Перечитайте разделы с ошибками и пройдите тест ещё раз.'}
              </p>
              <Button variant="secondary" size="sm" onClick={() => void load()} icon={<RotateCcw size={14} strokeWidth={ICON_STROKE} />} className="min-h-11 sm:min-h-9">
                Новые вопросы
              </Button>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
