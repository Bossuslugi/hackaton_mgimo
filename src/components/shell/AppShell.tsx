'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { LogOut, Sparkles, UserRound } from 'lucide-react';
import { Logo, LogoMark } from '@/components/brand/Logo';
import { Disclaimer } from '@/components/brand/Disclaimer';
import { CopilotPanel } from '@/components/copilot/CopilotPanel';
import { CopilotProvider, useCopilot } from '@/components/copilot/CopilotProvider';
import { Skeleton } from '@/components/ui/Skeleton';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { cn } from '@/lib/cn';
import { initials } from '@/lib/format';
import { ICON_STROKE } from '@/lib/ui';
import { NotificationsBell } from './NotificationsBell';
import { MessagesHeaderLink, MessagesUnreadProvider, UnreadBadge, useMessagesUnread } from './MessagesUnread';
import { isActive, MESSAGES_NAV, navFor } from './nav';
import { SessionProvider, useSession } from './SessionProvider';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SessionProvider fallback={<ShellSkeleton />}>
      <MessagesUnreadProvider>
        <CopilotProvider>
          <Frame>{children}</Frame>
          <CopilotPanel />
        </CopilotProvider>
      </MessagesUnreadProvider>
    </SessionProvider>
  );
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh overflow-x-hidden bg-slate-50 dark:bg-zinc-950">
      <Sidebar />
      <div className="lg:pl-60">
        <Header />
        <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-10 lg:pt-8">
          {children}
          <Footer />
        </main>
      </div>
      <TabBar />
    </div>
  );
}

function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full border border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-800 font-medium text-slate-700 dark:text-zinc-300',
        size === 'sm' ? 'size-8 text-xs' : 'size-9 text-sm',
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

function Sidebar() {
  const pathname = usePathname();
  const { user, isAdmin, isTeacher, logout } = useSession();
  const copilot = useCopilot();
  const { unread } = useMessagesUnread();
  const nav = navFor(user.role);
  const msgActive = isActive(pathname, MESSAGES_NAV.href);

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#12141A] lg:flex">
      <div className="flex h-16 items-center border-b border-slate-200 dark:border-zinc-800 px-5">
        <Link href="/" aria-label="Орбита — на главную">
          <Logo />
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Основная навигация">
        <p className="px-2 pb-2 text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-400">
          {isAdmin ? 'Деканат' : isTeacher ? 'Преподавание' : 'Учёба'}
        </p>
        <ul className="space-y-0.5">
          {nav.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex h-10 items-center gap-3 rounded-lg px-2.5 text-sm transition-colors',
                    active
                      ? 'bg-blue-50 dark:bg-blue-500/10 font-medium text-blue-700 dark:text-blue-400'
                      : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-zinc-50',
                  )}
                >
                  <Icon size={18} strokeWidth={ICON_STROKE} />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <p className="px-2 pb-2 pt-6 text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-400">Связь</p>
        <Link
          href={MESSAGES_NAV.href}
          aria-current={msgActive ? 'page' : undefined}
          className={cn(
            'flex h-10 items-center gap-3 rounded-lg px-2.5 text-sm transition-colors',
            msgActive
              ? 'bg-blue-50 dark:bg-blue-500/10 font-medium text-blue-700 dark:text-blue-400'
              : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-zinc-50',
          )}
        >
          <MESSAGES_NAV.icon size={18} strokeWidth={ICON_STROKE} />
          <span className="flex-1">{MESSAGES_NAV.label}</span>
          <UnreadBadge count={unread} />
        </Link>

        {!isAdmin && !isTeacher && (
          <>
            <p className="px-2 pb-2 pt-6 text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-400">Аккаунт</p>
            <Link
              href="/profile"
              aria-current={isActive(pathname, '/profile') ? 'page' : undefined}
              className={cn(
                'flex h-10 items-center gap-3 rounded-lg px-2.5 text-sm transition-colors',
                isActive(pathname, '/profile')
                  ? 'bg-blue-50 dark:bg-blue-500/10 font-medium text-blue-700 dark:text-blue-400'
                  : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-zinc-50',
              )}
            >
              <UserRound size={18} strokeWidth={ICON_STROKE} />
              Профиль и студбилет
            </Link>
          </>
        )}

        <button
          type="button"
          onClick={() => copilot.open()}
          className="mt-6 w-full rounded-xl border border-slate-200 dark:border-zinc-800 p-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-zinc-900"
        >
          <span className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-zinc-50">
            <Sparkles size={16} strokeWidth={ICON_STROKE} className="text-blue-600 dark:text-blue-400" />
            Орбита Copilot
          </span>
          <span className="mt-1 block text-xs leading-relaxed text-slate-500 dark:text-zinc-400">
            Разбор заданий и ответы по регламентам деканата
          </span>
        </button>
      </nav>

      <div className="flex items-center gap-2.5 border-t border-slate-200 dark:border-zinc-800 p-3">
        <Avatar name={user.fullName} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-900 dark:text-zinc-50">{user.fullName}</p>
          <p className="truncate text-xs text-slate-500 dark:text-zinc-400 tabular-nums">
            {isAdmin ? (user.position ?? 'Сотрудник деканата') : isTeacher ? (user.department ?? user.position ?? 'Преподаватель') : (user.group ?? user.email)}
          </p>
        </div>
        <button
          type="button"
          onClick={logout}
          aria-label="Выйти"
          title="Выйти"
          className="inline-flex size-9 items-center justify-center rounded-lg text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-zinc-50"
        >
          <LogOut size={16} strokeWidth={ICON_STROKE} />
        </button>
      </div>
    </aside>
  );
}

function Header() {
  const { user, isAdmin, isTeacher } = useSession();
  const copilot = useCopilot();

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/85 backdrop-blur supports-[backdrop-filter]:bg-white/85 dark:supports-[backdrop-filter]:bg-zinc-950/85">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-2 sm:px-4 lg:h-16 lg:gap-4 lg:px-8">
        <Link href="/" className="flex min-h-11 items-center px-2 lg:hidden" aria-label="Орбита — на главную">
          <LogoMark size={26} />
          <span className="ml-2 text-[15px] font-semibold tracking-tight text-slate-900 dark:text-zinc-50">Орбита</span>
        </Link>

        <button
          type="button"
          onClick={() => copilot.open()}
          className="hidden h-10 w-full max-w-md items-center gap-2.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 px-3 text-left text-sm text-slate-500 dark:text-zinc-400 transition-colors hover:border-slate-300 dark:hover:border-zinc-700 hover:bg-white dark:hover:bg-[#12141A] lg:flex"
        >
          <Sparkles size={16} strokeWidth={ICON_STROKE} className="text-blue-600 dark:text-blue-400" />
          <span className="flex-1 truncate">Спросить Орбита Copilot…</span>
          <kbd className="rounded border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#12141A] px-1.5 py-0.5 font-sans text-[11px] text-slate-500 dark:text-zinc-400">
            ⌘K
          </kbd>
        </button>

        <div className="ml-auto flex items-center gap-0.5 lg:gap-2">
          <button
            type="button"
            onClick={() => copilot.open()}
            aria-label="Открыть Орбита Copilot"
            className="inline-flex size-11 items-center justify-center rounded-lg text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-zinc-50 lg:hidden"
          >
            <Sparkles size={20} strokeWidth={ICON_STROKE} />
          </button>
          <MessagesHeaderLink />
          <NotificationsBell />
          <ThemeToggle />
          <span className="mx-1 hidden h-6 w-px bg-slate-200 dark:bg-zinc-700 lg:block" aria-hidden />
          <Link
            href="/profile"
            className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2.5 rounded-lg lg:px-2 lg:hover:bg-slate-100 dark:lg:hover:bg-zinc-800"
            aria-label="Профиль"
          >
            <Avatar name={user.fullName} size="sm" />
            <span className="hidden min-w-0 text-left lg:block">
              <span className="block max-w-40 truncate text-sm font-medium text-slate-900 dark:text-zinc-50">{user.fullName}</span>
              <span className="block text-xs text-slate-500 dark:text-zinc-400 tabular-nums">
                {isAdmin ? 'Деканат' : isTeacher ? 'Преподаватель' : user.group}
              </span>
            </span>
          </Link>
        </div>
      </div>
    </header>
  );
}

function TabBar() {
  const pathname = usePathname();
  const { user } = useSession();
  const nav = navFor(user.role);
  return (
    <nav
      aria-label="Разделы"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#12141A] pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="mx-auto flex h-16 max-w-xl">
        {nav.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href} className="min-w-0 flex-1">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-full min-h-11 flex-col items-center justify-center gap-1 px-0.5 transition-colors',
                  active ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-zinc-400 active:text-slate-900 dark:active:text-zinc-50',
                )}
              >
                <Icon size={20} strokeWidth={ICON_STROKE} />
                <span className={cn('max-w-full truncate text-[10.5px] leading-none', active && 'font-medium')}>
                  {item.short}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Footer() {
  return (
    <footer className="mt-12 border-t border-slate-200 dark:border-zinc-800 pt-5">
      <Disclaimer />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 dark:text-zinc-500">
        <span className="tabular-nums">© 2026 Орбита · концепт-прототип</span>
        <span>Цифровой деканат будущего</span>
      </div>
    </footer>
  );
}

function ShellSkeleton() {
  return (
    <div className="min-h-dvh bg-slate-50 dark:bg-zinc-950" aria-busy="true" aria-label="Загрузка">
      <div className="fixed inset-y-0 left-0 hidden w-60 border-r border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#12141A] p-5 lg:block">
        <Skeleton className="h-7 w-32" />
        <div className="mt-10 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </div>
      <div className="lg:pl-60">
        <div className="h-14 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#12141A] lg:h-16" />
        <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6 lg:px-8 lg:pt-8">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-3 h-7 w-64" />
          <div className="mt-6 grid gap-3 lg:grid-cols-3 lg:gap-4">
            <Skeleton className="h-44 rounded-xl lg:col-span-2" />
            <Skeleton className="h-44 rounded-xl" />
            <Skeleton className="h-40 rounded-xl" />
            <Skeleton className="h-40 rounded-xl lg:col-span-2" />
          </div>
        </div>
      </div>
    </div>
  );
}
