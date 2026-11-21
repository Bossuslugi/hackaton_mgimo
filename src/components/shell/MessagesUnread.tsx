'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { MessagesSquare } from 'lucide-react';
import { get } from '@/lib/api';
import { cn } from '@/lib/cn';
import { toContacts } from '@/lib/normalize-v2';
import { ICON_STROKE } from '@/lib/ui';

interface UnreadApi {
  unread: number;
  refresh: () => void;
}

const Ctx = createContext<UnreadApi>({ unread: 0, refresh: () => {} });

const POLL_MS = 30_000;

/** Счётчик непрочитанных сообщений: GET /api/messages раз в 30 с и по запросу (после открытия диалога). */
export function MessagesUnreadProvider({ children }: { children: ReactNode }) {
  const [unread, setUnread] = useState(0);
  const refresh = useCallback(() => {
    get('/api/messages')
      .then((raw) => setUnread(toContacts(raw).unreadTotal))
      .catch(() => {
        /* счётчик некритичен — молча оставляем прежнее значение */
      });
  }, []);

  useEffect(() => {
    refresh();
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [refresh]);

  return <Ctx.Provider value={{ unread, refresh }}>{children}</Ctx.Provider>;
}

export const useMessagesUnread = () => useContext(Ctx);

export function UnreadBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-blue-600 px-1 text-[11px] font-semibold leading-none text-white tabular-nums dark:bg-blue-500',
        className,
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

/** Иконка чата в шапке со счётчиком — на мобильном tab bar остаётся на 5 разделах. */
export function MessagesHeaderLink() {
  const { unread } = useMessagesUnread();
  const pathname = usePathname();
  const active = pathname.startsWith('/messages');
  return (
    <Link
      href="/messages"
      aria-label={unread ? `Сообщения, непрочитанных: ${unread}` : 'Сообщения'}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative inline-flex size-11 items-center justify-center rounded-lg transition-colors lg:size-10',
        active
          ? 'text-blue-600 dark:text-blue-400'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50',
      )}
    >
      <MessagesSquare size={20} strokeWidth={ICON_STROKE} className="lg:size-[18px]" />
      <UnreadBadge
        count={unread}
        className="absolute right-1 top-1 ring-2 ring-white dark:ring-zinc-950 lg:right-0.5 lg:top-0.5"
      />
    </Link>
  );
}
