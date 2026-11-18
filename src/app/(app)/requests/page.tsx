'use client';

import { useState } from 'react';
import { Clock, FileText, GraduationCap, HandCoins, Inbox, RotateCcw, ScrollText, Shield } from 'lucide-react';
import { AdminPanel } from '@/components/admin/AdminPanel';
import { CertificateModal } from '@/components/requests/CertificateModal';
import { RequestStepper } from '@/components/requests/RequestStepper';
import { useSession } from '@/components/shell/SessionProvider';
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

const CATALOG: { type: RequestType; title: string; text: string; eta: string; icon: typeof FileText }[] = [
  {
    type: 'STUDY_CERTIFICATE',
    title: 'Справка об обучении',
    text: 'По месту требования: работа, соцзащита, банк, общежитие.',
    eta: '~1 рабочий день',
    icon: GraduationCap,
  },
  {
    type: 'MILITARY_CERTIFICATE',
    title: 'Справка для военкомата',
    text: 'Для отсрочки от призыва на период обучения.',
    eta: '~2 рабочих дня',
    icon: Shield,
  },
  {
    type: 'FINANCIAL_AID',
    title: 'Заявление на матпомощь',
    text: 'Рассматривает стипендиальная комиссия факультета.',
    eta: '~5 рабочих дней',
    icon: HandCoins,
  },
  {
    type: 'RETAKE',
    title: 'Заявление на пересдачу',
    text: 'Направление на повторную аттестацию по дисциплине.',
    eta: '~2 рабочих дня',
    icon: RotateCcw,
  },
];

export default function RequestsPage() {
  const { isAdmin } = useSession();
  return isAdmin ? <AdminPanel queueOnly /> : <StudentRequests />;
}

function StudentRequests() {
  const { user } = useSession();
  const toast = useToast();
  const { data, error, loading, reload, setData } = useApi<StudentRequest[]>('/api/requests', toRequests);
  const [ordering, setOrdering] = useState<RequestType | null>(null);
  const [cert, setCert] = useState<StudentRequest | null>(null);

  const list = [...(data ?? [])].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  const openOf = (t: RequestType) => list.find((r) => r.type === t && (r.status === 'CREATED' || r.status === 'PENDING'));

  async function order(type: RequestType) {
    setOrdering(type);
    try {
      const raw = await post('/api/requests', { type });
      const created =
        toRequest(raw) ??
        ({ id: String(Date.now()), type, status: 'PENDING', createdAt: new Date().toISOString() } as StudentRequest);
      setData((xs) => [created, ...(xs ?? []).filter((x) => x.id !== created.id)]);
      toast.success('Заявка отправлена в деканат', `${REQUEST_TYPE_LABEL[type]} · статус «${REQUEST_STATUS_LABEL[created.status]}»`);
    } catch (e) {
      toast.error('Не удалось создать заявку', e instanceof ApiError ? e.message : undefined);
    } finally {
      setOrdering(null);
    }
  }

  return (
    <>
      <PageHeader title="Заявки и справки" description="Заказ в один клик, подпись ЭЦП деканата и печатный бланк с QR-кодом" />

      <section aria-labelledby="catalog">
        <h2 id="catalog" className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-500">
          Заказать документ
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:gap-4 xl:grid-cols-4">
          {CATALOG.map((c) => {
            const pending = openOf(c.type);
            return (
              <Card key={c.type} className="flex flex-col p-4 sm:p-5">
                <c.icon size={20} strokeWidth={ICON_STROKE} className="text-slate-700" />
                <h3 className="mt-3 text-[15px] font-semibold text-slate-900">{c.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-500">{c.text}</p>
                <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-slate-500">
                  <Clock size={12} strokeWidth={ICON_STROKE} />
                  {c.eta} · подпись ЭЦП
                </p>
                <div className="mt-auto pt-4">
                  {pending ? (
                    <Button variant="secondary" block disabled className="min-h-11 sm:min-h-10">
                      Уже на проверке
                    </Button>
                  ) : (
                    <Button
                      block
                      loading={ordering === c.type}
                      disabled={ordering !== null || loading}
                      onClick={() => void order(c.type)}
                      className="min-h-11 sm:min-h-10"
                    >
                      Заказать в 1 клик
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="mine" className="mt-8">
        <h2 id="mine" className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-500">
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
            description="Закажите справку выше — статус появится здесь и на «Фокусе дня»."
          />
        ) : (
          <ul className="space-y-3">
            {list.map((r) => (
              <li key={r.id}>
                <Card className="p-4 sm:p-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-8">
                    <div className="min-w-0 md:w-64 md:shrink-0">
                      <div className="flex items-start justify-between gap-2 md:block">
                        <p className="text-sm font-semibold text-slate-900">{REQUEST_TYPE_LABEL[r.type]}</p>
                        <Badge tone={REQUEST_STATUS_TONE[r.status]} className="md:mt-1.5">
                          {REQUEST_STATUS_LABEL[r.status]}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-slate-500 tabular-nums">
                        № заявки {r.id.slice(-6)} · {fmtDateTime(r.createdAt)}
                      </p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <RequestStepper request={r} />
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
                            <p className="mt-1.5 font-mono text-xs text-slate-500 tabular-nums">Рег. № {r.registryNumber}</p>
                          )}
                        </>
                      ) : r.status === 'REJECTED' ? (
                        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-left text-sm text-red-700">
                          {r.adminComment ?? 'Заявка отклонена деканатом.'}
                        </p>
                      ) : (
                        <p className="text-sm text-slate-500">Деканат проверяет данные. Уведомим, когда документ будет подписан.</p>
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

      <CertificateModal request={cert} user={user} onClose={() => setCert(null)} />
    </>
  );
}
