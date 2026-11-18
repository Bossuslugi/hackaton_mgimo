'use client';

import { CircleCheck, CircleX, Clock, Inbox } from 'lucide-react';
import { useSession } from '@/components/shell/SessionProvider';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/cn';
import { fmtToday } from '@/lib/format';
import { toRequests } from '@/lib/normalize';
import type { StudentRequest } from '@/lib/types';
import { ICON_STROKE } from '@/lib/ui';
import { useApi } from '@/lib/use-api';
import { AnnouncementForm } from './AnnouncementForm';
import { RequestsQueue } from './RequestsQueue';

export function AdminPanel({ queueOnly = false }: { queueOnly?: boolean }) {
  const { user } = useSession();
  const state = useApi<StudentRequest[]>('/api/requests', toRequests);
  const list = state.data ?? [];
  const today = new Date().toDateString();

  const stats = [
    {
      label: 'Ждут решения',
      value: list.filter((r) => r.status === 'PENDING' || r.status === 'CREATED').length,
      icon: Clock,
      tone: 'text-amber-600',
    },
    {
      label: 'Подписано сегодня',
      value: list.filter(
        (r) => r.status === 'APPROVED' && new Date(r.signedAt ?? r.updatedAt ?? 0).toDateString() === today,
      ).length,
      icon: CircleCheck,
      tone: 'text-emerald-600',
    },
    { label: 'Отклонено', value: list.filter((r) => r.status === 'REJECTED').length, icon: CircleX, tone: 'text-red-600' },
    { label: 'Всего заявок', value: list.length, icon: Inbox, tone: 'text-slate-500' },
  ];

  return (
    <>
      <PageHeader
        eyebrow={fmtToday()}
        title={queueOnly ? 'Очередь заявок' : 'Панель сотрудника деканата'}
        description={queueOnly ? 'Все заявки студентов факультета' : `${user.fullName} · ${user.position ?? 'Деканат'}`}
      />

      {!queueOnly && (
        <div className="mb-3 grid grid-cols-2 gap-3 lg:mb-4 lg:grid-cols-4 lg:gap-4">
          {stats.map((s) => (
            <Card key={s.label} className="p-4">
              <div className="flex items-center gap-2 text-slate-500">
                <s.icon size={14} strokeWidth={ICON_STROKE} className={cn(s.tone)} />
                <span className="truncate text-xs">{s.label}</span>
              </div>
              {state.loading && !state.data ? (
                <Skeleton className="mt-2 h-8 w-12" />
              ) : (
                <p className="mt-1.5 text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">{s.value}</p>
              )}
            </Card>
          ))}
        </div>
      )}

      <div className="space-y-3 lg:space-y-4">
        <RequestsQueue state={state} />
        {!queueOnly && <AnnouncementForm />}
      </div>
    </>
  );
}
