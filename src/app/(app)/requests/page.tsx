'use client';

import { useState } from 'react';
import { ArrowRight, Clock, Inbox, ScrollText } from 'lucide-react';
import { AdminPanel } from '@/components/admin/AdminPanel';
import { PAYLOAD_LABELS, REQUEST_CATALOG } from '@/components/requests/catalog';
import { CertificateModal } from '@/components/requests/CertificateModal';
import { RequestFormSheet, type RequestSubmission } from '@/components/requests/RequestForm';
import { RequestStepper } from '@/components/requests/RequestStepper';
import { useSession } from '@/components/shell/SessionProvider';
import { StudentOnly } from '@/components/shell/StudentOnly';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { ApiError, post } from '@/lib/api';
import { fmtDateTime, REQUEST_STATUS_LABEL, REQUEST_STATUS_TONE, REQUEST_TYPE_LABEL } from '@/lib/format';
import { toRequest, toRequests } from '@/lib/normalize';
import type { RequestType, StudentRequest } from '@/lib/types';
import { ICON_STROKE } from '@/lib/ui';
import { useApi } from '@/lib/use-api';

export default function RequestsPage() {
  const { isAdmin } = useSession();
  if (isAdmin) return <AdminPanel queueOnly />;
  return (
    <StudentOnly>
      <StudentRequests />
    </StudentOnly>
  );
}

function StudentRequests() {
  const { user } = useSession();
  const toast = useToast();
  const { data, error, loading, reload, setData } = useApi<StudentRequest[]>('/api/requests', toRequests);
  const [formType, setFormType] = useState<RequestType | null>(null);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [cert, setCert] = useState<StudentRequest | null>(null);

  const list = [...(data ?? [])].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  const openOf = (t: RequestType) => list.find((r) => r.type === t && (r.status === 'CREATED' || r.status === 'PENDING'));

  async function submit(s: RequestSubmission) {
    setBusy(true);
    setServerError(null);
    try {
      const raw = await post('/api/requests', {
        type: s.type,
        ...(s.comment ? { comment: s.comment } : {}),
        ...(Object.keys(s.payload).length ? { payload: s.payload } : {}),
      });
      const created =
        toRequest(raw) ??
        ({ id: String(Date.now()), type: s.type, status: 'CREATED', createdAt: new Date().toISOString(), payload: s.payload, comment: s.comment } as StudentRequest);
      setData((xs) => [created, ...(xs ?? []).filter((x) => x.id !== created.id)]);
      setFormType(null);
      toast.success('Заявка отправлена в деканат', `${REQUEST_TYPE_LABEL[s.type]} · статус «${REQUEST_STATUS_LABEL[created.status]}»`);
    } catch (e) {
      setServerError(e instanceof ApiError ? e.message : 'Не удалось создать заявку.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Заявки и справки" description="Онлайн-заявки с нужными полями, подпись ЭЦП деканата и печатный бланк с QR-кодом" />

      <section aria-labelledby="catalog">
        <h2 id="catalog" className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-400">
          Оформить онлайн
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:gap-4 xl:grid-cols-4">
          {REQUEST_CATALOG.map((c) => {
            const pending = openOf(c.type);
            return (
              <Card key={c.type} className="flex flex-col p-4 sm:p-5">
                <c.icon size={20} strokeWidth={ICON_STROKE} className="text-slate-700 dark:text-zinc-300" />
                <h3 className="mt-3 text-[15px] font-semibold text-slate-900 dark:text-zinc-50">{c.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-zinc-400">{c.text}</p>
                <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400">
                  <Clock size={12} strokeWidth={ICON_STROKE} />
                  {c.eta}
                </p>
                <div className="mt-auto pt-4">
                  {pending ? (
                    <Button variant="secondary" block disabled className="min-h-11 sm:min-h-10">
                      Уже на проверке
                    </Button>
                  ) : (
                    <Button
                      block
                      variant="secondary"
                      disabled={loading}
                      onClick={() => {
                        setServerError(null);
                        setFormType(c.type);
                      }}
                      icon={<ArrowRight size={16} strokeWidth={ICON_STROKE} />}
                      className="min-h-11 flex-row-reverse sm:min-h-10"
                    >
                      Оформить
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="mine" className="mt-8">
        <h2 id="mine" className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-400">
          Мои заявки {data && <span className="tabular-nums">· {data.length}</span>}
        </h2>
        {loading && !data ? (
          <div className="space-y-3">
            <SkeletonCard lines={2} />
            <SkeletonCard lines={2} />
          </div>
        ) : error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : list.length === 0 ? (
          <EmptyState
            icon={<Inbox size={20} strokeWidth={ICON_STROKE} />}
            title="Заявок пока нет"
            description="Оформите справку выше — статус появится здесь и на «Фокусе дня»."
          />
        ) : (
          <ul className="space-y-3">
            {list.map((r) => (
              <li key={r.id}>
                <Card className="p-4 sm:p-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-8">
                    <div className="min-w-0 md:w-64 md:shrink-0">
                      <div className="flex items-start justify-between gap-2 md:block">
                        <p className="text-sm font-semibold text-slate-900 dark:text-zinc-50">{REQUEST_TYPE_LABEL[r.type]}</p>
                        <Badge tone={REQUEST_STATUS_TONE[r.status]} className="md:mt-1.5">
                          {REQUEST_STATUS_LABEL[r.status]}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-slate-500 tabular-nums dark:text-zinc-400">
                        № заявки {r.id.slice(-6)} · {fmtDateTime(r.createdAt)}
                      </p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <RequestStepper request={r} />
                      <RequestDetails r={r} />
                    </div>
                    <div className="md:w-56 md:shrink-0 md:text-right">
                      {r.status === 'APPROVED' ? (
                        <>
                          <Button
                            onClick={() => setCert(r)}
                            icon={<ScrollText size={16} strokeWidth={ICON_STROKE} />}
                            className="min-h-11 w-full md:min-h-10 md:w-auto"
                          >
                            Открыть цифровую справку
                          </Button>
                          {r.registryNumber && (
                            <p className="mt-1.5 font-mono text-xs text-slate-500 tabular-nums dark:text-zinc-400">Рег. № {r.registryNumber}</p>
                          )}
                        </>
                      ) : r.status === 'REJECTED' ? (
                        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-left text-sm text-red-700 dark:border-red-800/60 dark:bg-red-950/60 dark:text-red-300">
                          {r.adminComment ?? 'Заявка отклонена деканатом.'}
                        </p>
                      ) : (
                        <p className="text-sm text-slate-500 dark:text-zinc-400">Деканат проверяет данные. Уведомим, когда документ будет подписан.</p>
                      )}
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
        {loading && data && <Skeleton className="mt-3 h-1 w-full" />}
      </section>

      <RequestFormSheet type={formType} onClose={() => setFormType(null)} onSubmit={(s) => void submit(s)} busy={busy} error={serverError} />
      <CertificateModal request={cert} user={user} onClose={() => setCert(null)} />
    </>
  );
}

function formatValue(key: string, v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  if (key === 'language') return v === 'en' ? 'English' : 'Русский';
  if (key === 'amountRequested' && typeof v === 'number') return `${v.toLocaleString('ru-RU')} ₽`;
  if (key === 'achievements') return null;
  return String(v);
}

/** Поля из payloadJson и строки комментария — аккуратным списком «ключ — значение». */
function RequestDetails({ r }: { r: StudentRequest }) {
  const p = r.payload ?? {};
  const rows = Object.entries(p)
    .map(([k, v]) => [PAYLOAD_LABELS[k] ?? k, formatValue(k, v)] as const)
    .filter((x): x is readonly [string, string] => x[1] !== null);
  const commentRows = (r.comment ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const i = l.indexOf(': ');
      return i > 0 && i < 40 ? ([l.slice(0, i), l.slice(i + 2)] as const) : (['Комментарий', l] as const);
    });
  const achievements = Array.isArray(p.achievements) ? (p.achievements as { type?: string; title?: string; date?: string }[]) : [];
  const all = [...rows, ...commentRows];
  if (!all.length && !achievements.length) return null;

  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-900">
      {all.length > 0 && (
        <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[auto_minmax(0,1fr)]">
          {all.map(([k, v], i) => (
            <div key={`${k}-${i}`} className="contents">
              <dt className="text-xs text-slate-500 sm:pt-0.5 dark:text-zinc-400">{k}</dt>
              <dd className="min-w-0 break-words text-slate-900 tabular-nums dark:text-zinc-100">{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {achievements.length > 0 && (
        <ul className={`space-y-1 ${all.length ? 'mt-2 border-t border-slate-200 pt-2 dark:border-zinc-800' : ''}`}>
          {achievements.map((a, i) => (
            <li key={i} className="flex items-baseline gap-2 text-sm">
              <Badge tone="neutral">{a.type ?? 'Достижение'}</Badge>
              <span className="min-w-0 flex-1 break-words text-slate-900 dark:text-zinc-100">{a.title}</span>
              {a.date && <span className="shrink-0 text-xs text-slate-500 tabular-nums dark:text-zinc-400">{a.date}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
