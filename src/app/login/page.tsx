'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Building2, Presentation, CalendarClock, Eye, EyeOff, FileCheck2, GraduationCap, MessagesSquare, Sparkles, TriangleAlert } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { Disclaimer } from '@/components/brand/Disclaimer';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Field';
import { Spinner } from '@/components/ui/Spinner';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useToast } from '@/components/ui/Toast';
import { ApiError, post } from '@/lib/api';
import { cn } from '@/lib/cn';
import { toUser } from '@/lib/normalize';
import { ICON_STROKE } from '@/lib/ui';

interface DemoAccount {
  email: string;
  password: string;
  name: string;
  role: string;
  note: string;
  tone: BadgeTone;
  badge: string;
  icon: typeof GraduationCap;
}

const DEMO: DemoAccount[] = [
  {
    email: 'alexey.sokolov@edu.orbita.ru',
    password: 'Student2026!',
    name: 'Алексей Соколов',
    role: 'Студент-отличник',
    note: 'Стипендия, справки, симулятор БРС',
    tone: 'success',
    badge: 'Без долгов',
    icon: GraduationCap,
  },
  {
    email: 'maria.kuznetsova@edu.orbita.ru',
    password: 'Student2026!',
    name: 'Мария Кузнецова',
    role: 'Студент с задолженностью',
    note: 'Горящие дедлайны, пересдача',
    tone: 'danger',
    badge: 'Есть долги',
    icon: TriangleAlert,
  },
  {
    email: 'dekanat@edu.orbita.ru',
    password: 'Admin2026!',
    name: 'Деканат',
    role: 'Сотрудник деканата',
    note: 'Подпись заявок ЭЦП, объявления',
    tone: 'brand',
    badge: 'ADMIN',
    icon: Building2,
  },
  {
    email: 'volkov.igor@edu.orbita.ru',
    password: 'Teacher2026!',
    name: 'Волков Игорь Сергеевич',
    role: 'Преподаватель (доцент)',
    note: 'Создание онлайн-ДЗ и проверка решений студентов',
    tone: 'warning',
    badge: 'TEACHER',
    icon: Presentation,
  },
];

const FEATURES = [
  { icon: CalendarClock, title: 'Расписание с переносами', text: 'Замены аудиторий приходят сразу, без чатов старост.' },
  { icon: FileCheck2, title: 'Справки с ЭЦП за минуты', text: 'Заказ в один клик, подпись деканата и QR-проверка.' },
  { icon: Sparkles, title: 'Copilot для учёбы', text: 'Разбор ДЗ и ответы по регламентам — в любом разделе.' },
  { icon: MessagesSquare, title: 'Онлайн-задачи и мессенджер', text: 'Решение прямо в редакторе, проверка и связь с преподавателем.' },
];

export default function LoginPage() {
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // 'form' | email демо-аккаунта

  async function login(e: string, p: string, key: string) {
    setBusy(key);
    setError(null);
    try {
      const raw = await post('/api/auth/login', { email: e.trim(), password: p });
      const user = toUser(raw);
      toast.success('Вход выполнен', user ? user.fullName : undefined);
      router.replace('/');
    } catch (err) {
      const msg =
        err instanceof ApiError && (err.status === 401 || err.status === 400)
          ? 'Неверный email или пароль.'
          : err instanceof ApiError
            ? err.message
            : 'Не удалось войти.';
      setError(msg);
      setBusy(null);
    }
  }

  const onSubmit = (ev: FormEvent) => {
    ev.preventDefault();
    if (!email || !password) {
      setError('Введите email и пароль.');
      return;
    }
    void login(email, password, 'form');
  };

  return (
    <div className="min-h-dvh overflow-x-hidden bg-slate-50 dark:bg-zinc-950 lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* бренд-панель (desktop) */}
      <aside className="hidden flex-col justify-between border-r border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#12141A] p-10 lg:flex xl:p-14">
        <Logo />
        <div className="max-w-md">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-400">Цифровой деканат будущего</p>
          <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-slate-900 dark:text-zinc-50 xl:text-4xl">
            Вся учёба и деканат — в одном спокойном окне.
          </h1>
          <ul className="mt-10 space-y-6">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-3.5">
                <Icon size={20} strokeWidth={ICON_STROKE} className="mt-0.5 shrink-0 text-blue-600 dark:text-blue-400" />
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-zinc-50">{title}</p>
                  <p className="mt-0.5 text-sm text-slate-500 dark:text-zinc-400">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <Disclaimer className="max-w-md" />
      </aside>

      {/* форма */}
      <main className="mx-auto flex w-full max-w-md flex-col px-4 py-8 sm:py-12 lg:max-w-lg lg:justify-center lg:px-10">
        <div className="flex items-center justify-between gap-2 lg:justify-end">
          <span className="lg:hidden">
            <Logo />
          </span>
          <div className="flex items-center gap-1">
            <Link
              href="/pitch"
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:border-zinc-800 dark:bg-[#12141A] dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
            >
              <Presentation size={14} strokeWidth={ICON_STROKE} />
              Презентация
            </Link>
            <ThemeToggle className="-mr-2" />
          </div>
        </div>

        <div className="mt-6 lg:mt-4">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-zinc-50">Вход в Орбиту</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">Используйте корпоративную почту вуза.</p>
        </div>

        <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="username"
              placeholder="name@edu.orbita.ru"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={Boolean(error)}
            />
          </div>
          <div>
            <Label htmlFor="password">Пароль</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPwd ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-12"
                aria-invalid={Boolean(error)}
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                aria-label={showPwd ? 'Скрыть пароль' : 'Показать пароль'}
                className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center text-slate-400 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300"
              >
                {showPwd ? <EyeOff size={16} strokeWidth={ICON_STROKE} /> : <Eye size={16} strokeWidth={ICON_STROKE} />}
              </button>
            </div>
          </div>
          {error && (
            <p role="alert" className="rounded-lg border border-red-200 dark:border-red-800/60 bg-red-50 dark:bg-red-950/60 px-3 py-2 text-sm text-red-700 dark:text-red-300">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" block loading={busy === 'form'} disabled={busy !== null && busy !== 'form'}>
            Войти
          </Button>
        </form>

        <section className="mt-10" aria-labelledby="quick-login">
          <div className="flex items-center gap-3">
            <h3 id="quick-login" className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Быстрый вход для жюри в 1 клик
            </h3>
            <span className="h-px flex-1 bg-slate-200 dark:bg-zinc-700" />
          </div>
          <ul className="mt-3 space-y-2">
            {DEMO.map((a) => {
              const Icon = a.icon;
              const loading = busy === a.email;
              return (
                <li key={a.email}>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void login(a.email, a.password, a.email)}
                    className={cn(
                      'group flex w-full items-center gap-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#12141A] p-3 text-left transition-colors sm:p-3.5',
                      'hover:border-slate-300 dark:hover:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-900 disabled:cursor-wait',
                      busy !== null && !loading && 'opacity-50',
                    )}
                  >
                    <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300">
                      <Icon size={18} strokeWidth={ICON_STROKE} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-sm font-medium text-slate-900 dark:text-zinc-50">{a.role}</span>
                        <Badge tone={a.tone}>{a.badge}</Badge>
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-zinc-400">
                        {a.name} · {a.note}
                      </span>
                    </span>
                    <span className="inline-flex size-8 shrink-0 items-center justify-center text-slate-400 dark:text-zinc-500 group-hover:text-slate-900 dark:group-hover:text-zinc-50">
                      {loading ? <Spinner /> : <ArrowRight size={16} strokeWidth={ICON_STROKE} />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <Disclaimer className="mt-8 lg:hidden" />
      </main>
    </div>
  );
}
