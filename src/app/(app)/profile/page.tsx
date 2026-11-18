'use client';

import { useState } from 'react';
import { LogOut, Play, ShieldAlert, ShieldCheck, ShieldX } from 'lucide-react';
import { LogoMark } from '@/components/brand/Logo';
import { useSession } from '@/components/shell/SessionProvider';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { QRCode } from '@/components/ui/QRCode';
import { apiRaw, type RawResponse } from '@/lib/api';
import { cn } from '@/lib/cn';
import { fmtDate, fmtDateShort, initials } from '@/lib/format';
import { toUser } from '@/lib/normalize';
import type { User } from '@/lib/types';
import { ICON_STROKE } from '@/lib/ui';
import { useApi } from '@/lib/use-api';

export default function ProfilePage() {
  const session = useSession();
  const { data } = useApi<User | null>('/api/auth/me', toUser);
  const user = data ?? session.user;
  const [leaving, setLeaving] = useState(false);

  return (
    <>
      <PageHeader
        title="Профиль"
        description={session.isAdmin ? 'Учётная запись сотрудника деканата' : 'Электронный студенческий билет и данные об обучении'}
        actions={
          <Button
            variant="secondary"
            loading={leaving}
            onClick={() => {
              setLeaving(true);
              void session.logout();
            }}
            icon={<LogOut size={16} strokeWidth={ICON_STROKE} />}
            className="min-h-11 sm:min-h-10"
          >
            Выйти
          </Button>
        }
      />

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-4">
        <div className="space-y-3 lg:space-y-4">
          {session.isAdmin ? <StaffCard user={user} /> : <StudentCard user={user} />}
          <StudyData user={user} isAdmin={session.isAdmin} />
        </div>
        <IdorTest />
      </div>
    </>
  );
}

function StudentCard({ user }: { user: User }) {
  const number = user.studentCardNumber ?? `ОРБ-${user.id.slice(-6).toUpperCase()}`;
  const valid = user.validUntil ?? '2027-08-31';
  const qr = ['Орбита · студенческий билет (демо)', `№ ${number}`, user.fullName, `Группа ${user.group ?? '—'}`, `Действителен до ${fmtDateShort(valid)}`].join('\n');

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2">
          <LogoMark size={22} />
          <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Студенческий билет</span>
        </div>
        <Badge tone="success">Действителен</Badge>
      </div>
      <div className="flex flex-col gap-5 p-4 sm:flex-row sm:p-5">
        <div className="flex min-w-0 flex-1 gap-4">
          <div
            className="flex h-24 w-[72px] shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-xl font-semibold text-slate-500"
            aria-hidden
          >
            {initials(user.fullName)}
          </div>
          <div className="min-w-0">
            <p className="text-base font-semibold leading-snug text-slate-900 break-words">{user.fullName}</p>
            <dl className="mt-2 space-y-1 text-sm">
              <Row k="Группа" v={user.group ?? '—'} mono />
              <Row k="№ билета" v={number} mono />
              <Row k="Действует до" v={fmtDateShort(valid)} mono />
            </dl>
          </div>
        </div>
        <div className="flex items-center gap-3 border-t border-slate-200 pt-4 sm:flex-col sm:items-end sm:border-0 sm:pt-0">
          <QRCode value={qr} size={104} title="QR-код студенческого билета" className="rounded-md border border-slate-200" />
          <p className="text-xs leading-snug text-slate-500 sm:text-right">
            Покажите на входе
            <br className="hidden sm:block" /> или в библиотеке
          </p>
        </div>
      </div>
    </Card>
  );
}

function StaffCard({ user }: { user: User }) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center gap-4">
        <span className="inline-flex size-14 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-lg font-semibold text-slate-600">
          {initials(user.fullName)}
        </span>
        <div className="min-w-0">
          <p className="text-base font-semibold text-slate-900 break-words">{user.fullName}</p>
          <p className="text-sm text-slate-500">{user.position ?? 'Сотрудник деканата'}</p>
          <Badge tone="brand" className="mt-1.5">
            Роль: ADMIN
          </Badge>
        </div>
      </div>
    </Card>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex gap-2">
      <dt className="w-24 shrink-0 text-slate-500">{k}</dt>
      <dd className={cn('min-w-0 break-words text-slate-900', mono && 'tabular-nums')}>{v}</dd>
    </div>
  );
}

function StudyData({ user, isAdmin }: { user: User; isAdmin: boolean }) {
  const rows: [string, string | undefined, boolean?][] = isAdmin
    ? [
        ['Email', user.email],
        ['Подразделение', user.faculty ?? 'Деканат'],
        ['Должность', user.position],
      ]
    : [
        ['Email', user.email],
        ['Факультет', user.faculty],
        ['Направление', user.program],
        ['Курс', user.course ? String(user.course) : undefined, true],
        ['Группа', user.group, true],
        ['Форма обучения', user.studyForm],
        ['Основа', user.funding],
        ['Зачислен', user.enrolledAt ? fmtDate(user.enrolledAt) : undefined, true],
      ];
  return (
    <Card className="p-4 sm:p-5">
      <CardHeader title={isAdmin ? 'Учётная запись' : 'Данные об обучении'} />
      <dl className="mt-3 divide-y divide-slate-200">
        {rows.map(([k, v, num]) => (
          <div key={k} className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:gap-4">
            <dt className="text-sm text-slate-500 sm:w-40 sm:shrink-0">{k}</dt>
            <dd className={cn('min-w-0 break-words text-sm text-slate-900', num && 'tabular-nums')}>{v ?? '—'}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

const IDOR_PATH = '/api/requests/99999';

function verdict(r: RawResponse) {
  if (r.status === 403)
    return { tone: 'success' as const, icon: ShieldCheck, title: '403 Forbidden — Доступ запрещён', text: 'Защита работает: сервер проверил владельца заявки и отказал.' };
  if (r.status === 404)
    return { tone: 'success' as const, icon: ShieldCheck, title: '404 Not Found — Ресурс скрыт', text: 'Защита работает: чужая заявка не раскрывается даже фактом существования.' };
  if (r.status === 401)
    return { tone: 'warning' as const, icon: ShieldAlert, title: '401 Unauthorized', text: 'Сессия не передана. Войдите снова и повторите тест.' };
  if (r.ok)
    return { tone: 'danger' as const, icon: ShieldX, title: `${r.status} — данные отданы`, text: 'Уязвимость IDOR: сервер вернул чужую заявку без проверки владельца.' };
  if (r.status === 0)
    return { tone: 'warning' as const, icon: ShieldAlert, title: 'Нет ответа', text: 'Сервер недоступен. Проверьте, что бэкенд запущен.' };
  return { tone: 'warning' as const, icon: ShieldAlert, title: `${r.status} ${r.statusText}`, text: 'Неожиданный ответ сервера.' };
}

function IdorTest() {
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<RawResponse | null>(null);

  async function run() {
    setBusy(true);
    setRes(null);
    const r = await apiRaw(IDOR_PATH);
    setRes(r);
    setBusy(false);
  }

  const v = res ? verdict(res) : null;
  const body = res ? (typeof res.body === 'string' ? res.body : JSON.stringify(res.body, null, 2) ?? '') : '';

  return (
    <Card className="flex flex-col p-4 sm:p-5">
      <CardHeader title="Для жюри" icon={<ShieldCheck size={14} strokeWidth={ICON_STROKE} />} />
      <h2 className="mt-3 text-base font-semibold text-slate-900">Проверка безопасности (IDOR-тест)</h2>
      <p className="mt-1 text-sm leading-relaxed text-slate-600">
        Попробуем открыть чужую заявку, подставив её ID в адрес. Сервер обязан сверить владельца по сессии, а не доверять
        ID из запроса.
      </p>

      <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
        <div className="flex flex-wrap items-center gap-2 bg-slate-50 px-3 py-2 font-mono text-xs">
          <span className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-medium text-slate-900">GET</span>
          <span className="min-w-0 break-all text-slate-700">{IDOR_PATH}</span>
        </div>
        <p className="border-t border-slate-200 px-3 py-2 text-xs text-slate-500">
          credentials: <span className="font-mono">include</span> · ваша сессия · ID чужой заявки
        </p>
      </div>

      <Button
        onClick={() => void run()}
        loading={busy}
        icon={<Play size={16} strokeWidth={ICON_STROKE} />}
        className="mt-4 min-h-11 sm:self-start"
      >
        Попытаться открыть чужую заявку по ID
      </Button>

      {res && v && (
        <div className="mt-4 space-y-3" aria-live="polite">
          <div
            className={cn(
              'flex gap-3 rounded-lg border p-3.5',
              v.tone === 'success' && 'border-emerald-200 bg-emerald-50',
              v.tone === 'warning' && 'border-amber-200 bg-amber-50',
              v.tone === 'danger' && 'border-red-200 bg-red-50',
            )}
          >
            <v.icon
              size={20}
              strokeWidth={ICON_STROKE}
              className={cn(
                'mt-0.5 shrink-0',
                v.tone === 'success' && 'text-emerald-700',
                v.tone === 'warning' && 'text-amber-700',
                v.tone === 'danger' && 'text-red-700',
              )}
            />
            <div className="min-w-0">
              <p
                className={cn(
                  'text-base font-semibold tabular-nums',
                  v.tone === 'success' && 'text-emerald-800',
                  v.tone === 'warning' && 'text-amber-800',
                  v.tone === 'danger' && 'text-red-800',
                )}
              >
                {v.title}
              </p>
              <p
                className={cn(
                  'mt-0.5 text-sm',
                  v.tone === 'success' && 'text-emerald-700',
                  v.tone === 'warning' && 'text-amber-700',
                  v.tone === 'danger' && 'text-red-700',
                )}
              >
                {v.text}
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs">
              <span className="text-slate-900">
                HTTP <span className="font-semibold tabular-nums">{res.status || '—'}</span> {res.statusText}
              </span>
              <span className="text-slate-500 tabular-nums">{res.durationMs} ms</span>
            </div>
            <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-all bg-white p-3 font-mono text-xs leading-relaxed text-slate-700">
              {body || '(пустое тело ответа)'}
            </pre>
          </div>
        </div>
      )}
    </Card>
  );
}
