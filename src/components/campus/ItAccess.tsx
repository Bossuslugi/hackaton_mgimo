'use client';

import { useEffect, useMemo, useState } from 'react';
import { BadgeCheck, Copy, Eye, EyeOff, KeyRound, Mail, RefreshCw, ShieldCheck, Wifi } from 'lucide-react';
import { LogoMark } from '@/components/brand/Logo';
import { useSession } from '@/components/shell/SessionProvider';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { useNow } from '@/components/ui/Countdown';
import { ErrorState } from '@/components/ui/ErrorState';
import { QRCode } from '@/components/ui/QRCode';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { ApiError, post } from '@/lib/api';
import { copyText } from '@/lib/clipboard';
import { cn } from '@/lib/cn';
import { fmtDateTime } from '@/lib/format';
import { toCampusServices, toWifi, type CampusServices, type License } from '@/lib/normalize-v3';
import { ICON_STROKE } from '@/lib/ui';
import { useApi } from '@/lib/use-api';

const TOKEN_PERIOD_S = 30;

/** Вкладка «IT-доступы и Wi-Fi»: GET /api/campus/services, POST /api/campus/wifi/rotate. */
export function ItAccess() {
  const state = useApi<CampusServices>('/api/campus/services', toCampusServices);
  const s = state.data;

  if (state.loading && !s) {
    return (
      <div className="grid gap-3 lg:gap-4 xl:grid-cols-2">
        <SkeletonCard lines={4} />
        <SkeletonCard lines={4} />
        <SkeletonCard lines={3} className="xl:col-span-2" />
      </div>
    );
  }
  if (state.error) return <ErrorState error={state.error} onRetry={state.reload} />;
  if (!s) return null;

  return (
    <div className="grid gap-3 lg:gap-4 xl:grid-cols-2">
      <WifiCard s={s} onRotated={(w) => state.setData((d) => (d ? { ...d, ...w } : d))} />
      <SmartPass cardNumber={s.studentCardNumber} />
      <Licenses email={s.corporateEmail} licenses={s.licenses} />
    </div>
  );
}

// ───────────────────────── Wi-Fi

const MASK = '•••• •••• ••••';

function WifiCard({ s, onRotated }: { s: CampusServices; onRotated: (w: ReturnType<typeof toWifi>) => void }) {
  const toast = useToast();
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(false);

  async function copy(v: string, what: string) {
    if (await copyText(v)) toast.success(`${what} скопирован`, what === 'Пароль' ? 'Вставьте его в настройках Wi-Fi.' : undefined);
    else toast.error('Не удалось скопировать', 'Скопируйте вручную.');
  }

  async function rotate() {
    setBusy(true);
    try {
      const w = toWifi(await post('/api/campus/wifi/rotate'));
      onRotated(w);
      setShown(true);
      setFlash(true);
      window.setTimeout(() => setFlash(false), 600);
      toast.success('Новый пароль Wi-Fi сгенерирован', 'Старый пароль больше не действует на ваших устройствах.');
    } catch (e) {
      toast.error('Не удалось сменить пароль', e instanceof ApiError ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col p-4 sm:p-5">
      <CardHeader title="Кампусный Wi-Fi" icon={<Wifi size={14} strokeWidth={ICON_STROKE} />} action={<Badge tone="success">WPA2-Enterprise</Badge>} />
      <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 dark:text-zinc-50">{s.wifiSsid}</p>
      <dl className="mt-4 space-y-3">
        <Field label="Логин" value={s.wifiLogin} mono onCopy={() => void copy(s.wifiLogin, 'Логин')} />
        <div>
          <dt className="text-xs text-slate-500 dark:text-zinc-400">Пароль</dt>
          <dd className="mt-1 flex items-center gap-1.5">
            <span
              className={cn(
                'min-w-0 flex-1 truncate rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm tracking-wide text-slate-900 tabular-nums transition-opacity duration-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100',
                flash && 'animate-[pop_300ms_ease-out]',
              )}
              aria-label={shown ? `Пароль ${s.wifiPassword}` : 'Пароль скрыт'}
            >
              {shown ? s.wifiPassword : MASK}
            </span>
            <Button
              variant="secondary"
              square
              onClick={() => setShown((v) => !v)}
              aria-label={shown ? 'Скрыть пароль' : 'Показать пароль'}
              title={shown ? 'Скрыть' : 'Показать'}
              className="max-sm:size-11"
            >
              {shown ? <EyeOff size={16} strokeWidth={ICON_STROKE} /> : <Eye size={16} strokeWidth={ICON_STROKE} />}
            </Button>
            <Button variant="secondary" square onClick={() => void copy(s.wifiPassword, 'Пароль')} aria-label="Скопировать пароль" title="Скопировать" className="max-sm:size-11">
              <Copy size={16} strokeWidth={ICON_STROKE} />
            </Button>
          </dd>
        </div>
      </dl>
      <div className="mt-auto flex flex-col gap-2 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500 tabular-nums dark:text-zinc-400">
          {s.wifiUpdatedAt ? `Обновлён ${fmtDateTime(s.wifiUpdatedAt)}` : 'Пароль выдан при зачислении'}
        </p>
        <Button
          variant="secondary"
          onClick={() => void rotate()}
          loading={busy}
          icon={<RefreshCw size={16} strokeWidth={ICON_STROKE} />}
          className="min-h-11 sm:min-h-10"
        >
          Сгенерировать новый пароль
        </Button>
      </div>
    </Card>
  );
}

function Field({ label, value, mono, onCopy }: { label: string; value: string; mono?: boolean; onCopy: () => void }) {
  return (
    <div>
      <dt className="text-xs text-slate-500 dark:text-zinc-400">{label}</dt>
      <dd className="mt-1 flex items-center gap-1.5">
        <span
          className={cn(
            'min-w-0 flex-1 truncate rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100',
            mono && 'font-mono tabular-nums',
          )}
        >
          {value}
        </span>
        <Button variant="secondary" square onClick={onCopy} aria-label={`Скопировать: ${label}`} title="Скопировать" className="max-sm:size-11">
          <Copy size={16} strokeWidth={ICON_STROKE} />
        </Button>
      </dd>
    </div>
  );
}

// ───────────────────────── Smart Pass

/** Детерминированный хэш FNV-1a → 8 hex-символов. Демо-токен, генерируется на устройстве. */
function fnv(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).toUpperCase().padStart(8, '0');
}

const clock = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

function SmartPass({ cardNumber }: { cardNumber: string | null }) {
  const { user } = useSession();
  const now = useNow(1000);
  const [hidden, setHidden] = useState(false);
  const windowIdx = Math.floor(now / 1000 / TOKEN_PERIOD_S);
  const left = TOKEN_PERIOD_S - (Math.floor(now / 1000) % TOKEN_PERIOD_S);
  const number = cardNumber ?? user.studentCardNumber ?? user.id.slice(-6).toUpperCase();
  const token = useMemo(() => `${fnv(`${user.id}:${number}:${windowIdx}`)}${fnv(`${windowIdx}:${number}`).slice(0, 4)}`, [user.id, number, windowIdx]);
  const qr = `ORBITA-PASS|${number}|${token}|${windowIdx}`;

  // «защита от скриншотов» в духе банковских приложений: QR скрывается, когда вкладка не активна
  useEffect(() => {
    const on = () => setHidden(document.visibilityState !== 'visible');
    document.addEventListener('visibilitychange', on);
    window.addEventListener('blur', on);
    return () => {
      document.removeEventListener('visibilitychange', on);
      window.removeEventListener('blur', on);
    };
  }, []);

  const role = user.role === 'TEACHER' ? 'Преподаватель' : user.role === 'ADMIN' ? 'Сотрудник' : 'Студент';

  return (
    <Card className="relative overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-zinc-800 sm:px-5">
        <div className="flex items-center gap-2">
          <LogoMark size={22} />
          <span className="text-sm font-semibold text-slate-900 dark:text-zinc-50">Smart Pass</span>
        </div>
        <Badge tone="success" icon={<ShieldCheck size={12} strokeWidth={ICON_STROKE} />}>
          Действует
        </Badge>
      </div>
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
        <div className="relative mx-auto shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white dark:bg-white p-2 dark:border-zinc-700 sm:mx-0">
          <div className={cn('transition-opacity duration-200', hidden && 'opacity-0')}>
            <QRCode value={qr} size={148} title="Динамический QR-код пропуска" />
          </div>
          {hidden && (
            <div className="absolute inset-0 flex items-center justify-center p-3 text-center text-xs font-medium text-slate-600 dark:text-zinc-400">
              QR скрыт вне активной вкладки
            </div>
          )}
          {/* «живая» полоса — анимация только transform, неподвижный скриншот сразу заметен */}
          <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px animate-[pass-scan_3s_linear_infinite] bg-blue-600/70 dark:bg-blue-500/70" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <UserAvatar name={user.fullName} src={user.avatarUrl} size="md" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-zinc-50">{user.fullName}</p>
              <p className="text-xs text-slate-500 tabular-nums dark:text-zinc-400">
                {role}
                {user.group ? ` · ${user.group}` : ''} · № {number}
              </p>
            </div>
          </div>
          <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 tabular-nums dark:text-zinc-50" suppressHydrationWarning>
            {clock.format(now)}
          </p>
          <div className="mt-2">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
              <span className="inline-flex items-center gap-1">
                <KeyRound size={12} strokeWidth={ICON_STROKE} />
                Токен <span className="font-mono tabular-nums">{token.slice(0, 4)}••••</span>
              </span>
              <span className="tabular-nums" aria-live="off">
                Обновится через {left} сек
              </span>
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800">
              <div
                className="h-full origin-left rounded-full bg-blue-600 transition-transform duration-1000 ease-linear dark:bg-blue-500"
                style={{ transform: `scaleX(${left / TOKEN_PERIOD_S})` }}
              />
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500 dark:text-zinc-400">Приложите QR к считывателю турникета. Код меняется каждые {TOKEN_PERIOD_S} секунд.</p>
        </div>
      </div>
    </Card>
  );
}

// ───────────────────────── лицензии

function licenseTone(status: string): BadgeTone {
  const s = status.toLowerCase();
  if (s.startsWith('активна')) return 'success';
  if (s.startsWith('доступ')) return 'warning';
  return 'neutral';
}

function Licenses({ email, licenses }: { email: string; licenses: License[] }) {
  const toast = useToast();
  const copyEmail = async () => {
    if (await copyText(email)) toast.success('Корпоративный email скопирован', 'Используйте его для активации студенческих подписок.');
    else toast.error('Не удалось скопировать');
  };
  return (
    <Card className="p-4 sm:p-5 xl:col-span-2">
      <CardHeader title="Почта и студенческие лицензии" icon={<BadgeCheck size={14} strokeWidth={ICON_STROKE} />} />
      <div className="mt-3 flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-zinc-800 dark:bg-zinc-900 sm:flex-row sm:items-center">
        <Mail size={18} strokeWidth={ICON_STROKE} className="hidden shrink-0 text-slate-500 dark:text-zinc-400 sm:block" />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-slate-500 dark:text-zinc-400">Корпоративная почта</p>
          <p className="truncate font-mono text-sm text-slate-900 dark:text-zinc-100">{email}</p>
        </div>
        <Button variant="secondary" onClick={() => void copyEmail()} icon={<Copy size={16} strokeWidth={ICON_STROKE} />} className="min-h-11 sm:min-h-10">
          Скопировать email
        </Button>
      </div>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {licenses.map((l) => (
          <li key={l.name} className="flex flex-col rounded-lg border border-slate-200 p-3 dark:border-zinc-800">
            <p className="text-sm font-medium text-slate-900 dark:text-zinc-50">{l.name}</p>
            <Badge tone={licenseTone(l.status)} className="mt-2 self-start whitespace-normal">
              {l.status}
            </Badge>
            {l.description && <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-zinc-400">{l.description}</p>}
            <p className="mt-auto pt-3 font-mono text-xs text-slate-500 tabular-nums dark:text-zinc-400">{l.keyHint}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
