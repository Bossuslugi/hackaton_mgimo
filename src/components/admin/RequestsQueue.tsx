'use client';

import { useMemo, useState } from 'react';
import { Inbox, Stamp, X } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Label, Textarea } from '@/components/ui/Field';
import { Segmented } from '@/components/ui/Segmented';
import { Sheet } from '@/components/ui/Sheet';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { ApiError, patch } from '@/lib/api';
import { fmtDateTime, REQUEST_STATUS_LABEL, REQUEST_STATUS_TONE, REQUEST_TYPE_LABEL } from '@/lib/format';
import { toRequest } from '@/lib/normalize';
import type { RequestStatus, StudentRequest } from '@/lib/types';
import { ICON_STROKE } from '@/lib/ui';
import type { ApiState } from '@/lib/use-api';

type Filter = 'PENDING' | 'ALL' | 'APPROVED' | 'REJECTED';

const isOpen = (s: RequestStatus) => s === 'PENDING' || s === 'CREATED';

/** Таблица заявок для сотрудника деканата. Desktop (xl) — таблица, ниже — карточки без горизонтального скролла. */
export function RequestsQueue({ state }: { state: ApiState<StudentRequest[]> }) {
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>('PENDING');
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<StudentRequest | null>(null);
  const [reason, setReason] = useState('');
  const { data, loading, error, reload, setData } = state;

  const list = useMemo(() => {
    const all = [...(data ?? [])].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    if (filter === 'ALL') return all;
    if (filter === 'PENDING') return all.filter((r) => isOpen(r.status));
    return all.filter((r) => r.status === filter);
  }, [data, filter]);

  const count = (f: Filter) =>
    (data ?? []).filter((r) => (f === 'ALL' ? true : f === 'PENDING' ? isOpen(r.status) : r.status === f)).length;

  async function decide(r: StudentRequest, status: 'APPROVED' | 'REJECTED', comment?: string) {
    setBusy(`${r.id}:${status}`);
    try {
      const raw = await patch(`/api/requests/${r.id}`, { status, comment: comment || undefined });
      const updated = toRequest(raw);
      const merged: StudentRequest = {
        ...r,
        ...(updated ?? {}),
        status,
        student: updated?.student ?? r.student,
        updatedAt: updated?.updatedAt ?? new Date().toISOString(),
      };
      setData((xs) => (xs ?? []).map((x) => (x.id === r.id ? merged : x)));
      if (status === 'APPROVED') {
        toast.success(
          'Подписано ЭЦП',
          merged.registryNumber ? `Рег. № ${merged.registryNumber} — студент уже видит справку` : 'Студент уже видит справку',
        );
      } else {
        toast.info('Заявка отклонена', r.student?.fullName);
      }
      setRejecting(null);
      setReason('');
    } catch (e) {
      toast.error('Не удалось обновить заявку', e instanceof ApiError ? e.message : undefined);
    } finally {
      setBusy(null);
    }
  }

  const actions = (r: StudentRequest) =>
    isOpen(r.status) ? (
      <div className="flex flex-col gap-2 sm:flex-row xl:justify-end">
        <Button
          size="sm"
          onClick={() => void decide(r, 'APPROVED')}
          loading={busy === `${r.id}:APPROVED`}
          disabled={busy !== null}
          icon={<Stamp size={14} strokeWidth={ICON_STROKE} />}
          className="min-h-11 sm:min-h-9"
        >
          Одобрить и подписать ЭЦП
        </Button>
        <Button
          size="sm"
          variant="danger"
          onClick={() => setRejecting(r)}
          disabled={busy !== null}
          icon={<X size={14} strokeWidth={ICON_STROKE} />}
          className="min-h-11 sm:min-h-9"
        >
          Отклонить
        </Button>
      </div>
    ) : (
      <span className="text-xs text-slate-500 tabular-nums xl:block xl:text-right">
        {r.registryNumber ? <span className="font-mono">№ {r.registryNumber}</span> : fmtDateTime(r.updatedAt)}
      </span>
    );

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <h2 className="text-sm font-medium text-slate-900">Заявки студентов</h2>
          <p className="mt-0.5 text-sm text-slate-500">Проверка, подпись ЭЦП и отказ с комментарием</p>
        </div>
        <div className="max-w-full overflow-x-auto">
          <Segmented<Filter>
            size="sm"
            ariaLabel="Фильтр заявок"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'PENDING', label: 'Ждут', count: count('PENDING') },
              { value: 'APPROVED', label: 'Готово', count: count('APPROVED') },
              { value: 'REJECTED', label: 'Отказ', count: count('REJECTED') },
              { value: 'ALL', label: 'Все', count: count('ALL') },
            ]}
          />
        </div>
      </div>

      {loading && !data ? (
        <div className="divide-y divide-slate-200">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4 sm:px-5">
              <div className="flex-1">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="mt-2 h-3 w-32" />
              </div>
              <Skeleton className="hidden h-9 w-56 sm:block" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="p-4">
          <ErrorState error={error} onRetry={reload} />
        </div>
      ) : list.length === 0 ? (
        <div className="p-4">
          <EmptyState
            icon={<Inbox size={20} strokeWidth={ICON_STROKE} />}
            title={filter === 'PENDING' ? 'Очередь пуста' : 'Заявок нет'}
            description={filter === 'PENDING' ? 'Все заявки обработаны. Новые появятся здесь автоматически.' : undefined}
            className="border-0"
          />
        </div>
      ) : (
        <>
          {/* xl+: таблица */}
          <table className="hidden w-full text-left text-sm xl:table">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-5 py-2.5 font-medium">Студент</th>
                <th className="px-3 py-2.5 font-medium">Документ</th>
                <th className="px-3 py-2.5 font-medium">Создана</th>
                <th className="px-3 py-2.5 font-medium">Статус</th>
                <th className="px-5 py-2.5 text-right font-medium">Действие</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {list.map((r) => (
                <tr key={r.id} className="align-middle hover:bg-slate-50/60">
                  <td className="px-5 py-3">
                    <p className="font-medium text-slate-900">{r.student?.fullName ?? '—'}</p>
                    <p className="text-xs text-slate-500 tabular-nums">{r.student?.group ?? r.student?.email}</p>
                  </td>
                  <td className="px-3 py-3">
                    <p className="text-slate-900">{REQUEST_TYPE_LABEL[r.type]}</p>
                    {r.comment && <p className="max-w-56 truncate text-xs text-slate-500">{r.comment}</p>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-600 tabular-nums">{fmtDateTime(r.createdAt)}</td>
                  <td className="px-3 py-3">
                    <Badge tone={REQUEST_STATUS_TONE[r.status]}>{REQUEST_STATUS_LABEL[r.status]}</Badge>
                  </td>
                  <td className="px-5 py-3">{actions(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* < xl: карточки */}
          <ul className="divide-y divide-slate-200 xl:hidden">
            {list.map((r) => (
              <li key={r.id} className="p-4 sm:px-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 break-words">{r.student?.fullName ?? '—'}</p>
                    <p className="text-xs text-slate-500 tabular-nums">
                      {r.student?.group ?? r.student?.email} · {fmtDateTime(r.createdAt)}
                    </p>
                  </div>
                  <Badge tone={REQUEST_STATUS_TONE[r.status]}>{REQUEST_STATUS_LABEL[r.status]}</Badge>
                </div>
                <p className="mt-2 text-sm text-slate-700">{REQUEST_TYPE_LABEL[r.type]}</p>
                {r.comment && <p className="mt-0.5 text-sm text-slate-500 break-words">{r.comment}</p>}
                <div className="mt-3">{actions(r)}</div>
              </li>
            ))}
          </ul>
        </>
      )}

      <Sheet
        open={rejecting !== null}
        onClose={() => setRejecting(null)}
        title="Отклонить заявку"
        description={rejecting ? `${rejecting.student?.fullName ?? ''} · ${REQUEST_TYPE_LABEL[rejecting.type]}` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejecting(null)} className="min-h-11 sm:min-h-0">
              Отмена
            </Button>
            <Button
              variant="danger"
              loading={rejecting !== null && busy === `${rejecting.id}:REJECTED`}
              onClick={() => rejecting && void decide(rejecting, 'REJECTED', reason)}
              className="min-h-11 sm:min-h-0"
            >
              Отклонить заявку
            </Button>
          </>
        }
      >
        <Label htmlFor="reject-reason" hint="Увидит студент">
          Причина отказа
        </Label>
        <Textarea
          id="reject-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Например: приложите копию паспорта и реквизиты счёта"
          data-autofocus
        />
      </Sheet>
    </Card>
  );
}
