'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell, BellOff, DoorOpen, Megaphone, Info } from 'lucide-react';
import { get, post } from '@/lib/api';
import { cn } from '@/lib/cn';
import { fmtDateTime } from '@/lib/format';
import { toDashboard } from '@/lib/normalize';
import type { Announcement } from '@/lib/types';
import { ICON_STROKE } from '@/lib/ui';
import { Skeleton } from '@/components/ui/Skeleton';

const ICON = {
  URGENT: Megaphone,
  ROOM_CHANGE: DoorOpen,
  INFO: Info,
} as const;

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Announcement[] | null>(null);
  const [seen, setSeen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    get('/api/dashboard')
      .then((raw) => alive && setItems(toDashboard(raw).announcements))
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    setSeen(true);
    post('/api/notifications/read-all').catch(() => {});
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const unread = !seen && (items?.length ?? 0) > 0;

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={unread ? `Уведомления: ${items?.length} новых` : 'Уведомления'}
        aria-expanded={open}
        className="relative inline-flex size-11 items-center justify-center rounded-lg text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-zinc-50 lg:size-10"
      >
        <Bell size={20} strokeWidth={ICON_STROKE} />
        {unread && (
          <span className="absolute right-2.5 top-2.5 size-2 rounded-full border-2 border-white dark:border-zinc-900 bg-red-600" aria-hidden />
        )}
      </button>

      {open && (
        <div
          className={cn(
            'fixed inset-x-2 top-[3.75rem] z-50 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#12141A] shadow-sm',
            'lg:absolute lg:inset-x-auto lg:right-0 lg:top-12 lg:w-96',
          )}
        >
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 px-4 py-3">
            <p className="text-sm font-medium text-slate-900 dark:text-zinc-50">Уведомления деканата</p>
            {items && items.length > 0 && <span className="text-xs text-slate-500 dark:text-zinc-400 tabular-nums">{items.length}</span>}
          </div>
          <div className="max-h-[60dvh] overflow-y-auto">
            {items === null ? (
              <div className="space-y-3 p-4">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-8 text-center">
                <BellOff size={20} strokeWidth={ICON_STROKE} className="text-slate-400 dark:text-zinc-500" />
                <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">Новых объявлений нет</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-200 dark:divide-zinc-800">
                {items.map((a) => {
                  const Icon = ICON[a.type];
                  return (
                    <li key={a.id} className="flex gap-3 px-4 py-3">
                      <Icon
                        size={16}
                        strokeWidth={ICON_STROKE}
                        className={cn(
                          'mt-0.5 shrink-0',
                          a.type === 'URGENT' ? 'text-red-600 dark:text-red-400' : a.type === 'ROOM_CHANGE' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-zinc-400',
                        )}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-zinc-50">{a.title}</p>
                        <p className="mt-0.5 text-sm text-slate-600 dark:text-zinc-400 break-words">{a.body}</p>
                        <p className="mt-1 text-xs text-slate-400 dark:text-zinc-500 tabular-nums">{fmtDateTime(a.createdAt)}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
