'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  CalendarDays,
  CalendarPlus,
  CornerDownLeft,
  Dumbbell,
  FileText,
  Gauge,
  KeyRound,
  LayoutGrid,
  MessagesSquare,
  Moon,
  PartyPopper,
  Search,
  Sparkles,
  UserRound,
  Wifi,
  type LucideIcon,
} from 'lucide-react';
import { useCopilot } from '@/components/copilot/CopilotProvider';
import { useToast } from '@/components/ui/Toast';
import { ApiError, post } from '@/lib/api';
import { cn } from '@/lib/cn';
import { applyTheme, readTheme } from '@/lib/theme';
import { ICON_STROKE } from '@/lib/ui';
import { useSession } from './SessionProvider';

interface PaletteApi {
  open: () => void;
  close: () => void;
  isOpen: boolean;
}

const Ctx = createContext<PaletteApi>({ open: () => {}, close: () => {}, isOpen: false });
export const usePalette = () => useContext(Ctx);

/** ⌘K / Ctrl+K открывает палитру из любого раздела. */
export function PaletteProvider({ children }: { children: ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const open = useCallback(() => setOpen(true), []);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const api = useMemo(() => ({ open, close, isOpen }), [open, close, isOpen]);
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

interface Command {
  id: string;
  group: 'Разделы' | 'Действия';
  label: string;
  hint?: string;
  keywords: string;
  icon: LucideIcon;
  run: () => void | Promise<void>;
}

/** Нестрогий поиск: все слова запроса должны встретиться в подписи или ключевых словах. */
function matches(c: Command, q: string): boolean {
  const hay = `${c.label} ${c.hint ?? ''} ${c.keywords}`.toLowerCase().replace(/ё/g, 'е');
  return q
    .toLowerCase()
    .replace(/ё/g, 'е')
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => hay.includes(w));
}

export function CommandPalette() {
  const { isOpen, close } = usePalette();
  if (!isOpen || typeof document === 'undefined') return null;
  return createPortal(<PaletteDialog onClose={close} />, document.body);
}

function PaletteDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const copilot = useCopilot();
  const { isAdmin, isTeacher } = useSession();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const student = !isAdmin && !isTeacher;

  const go = useCallback(
    (href: string) => () => {
      router.push(href);
      onClose();
    },
    [router, onClose],
  );

  const commands = useMemo<Command[]>(() => {
    const nav: (Command | false)[] = [
      { id: 'home', group: 'Разделы', label: 'Сводка', keywords: 'главная дашборд фокус дня', icon: LayoutGrid, run: go('/') },
      (student || isTeacher) && { id: 'schedule', group: 'Разделы', label: 'Расписание', keywords: 'пары аудитории бронирование', icon: CalendarDays, run: go('/schedule') },
      (student || isTeacher) && {
        id: 'study',
        group: 'Разделы',
        label: isTeacher ? 'Кабинет преподавателя' : 'Учёба и ДЗ',
        keywords: 'домашние задания методички материалы проверка',
        icon: BookOpen,
        run: go('/study'),
      },
      student && { id: 'grades', group: 'Разделы', label: 'Успеваемость (БРС)', keywords: 'баллы оценки стипендия симулятор', icon: Gauge, run: go('/grades') },
      (student || isAdmin) && { id: 'requests', group: 'Разделы', label: isAdmin ? 'Очередь заявок' : 'Заявки и справки', keywords: 'справка документы заявление', icon: FileText, run: go('/requests') },
      { id: 'wifi', group: 'Разделы', label: 'Кампус: Wi-Fi и IT-доступы', keywords: 'wifi вайфай пароль пропуск лицензии почта', icon: Wifi, run: go('/campus?tab=it') },
      { id: 'events', group: 'Разделы', label: 'Кампус: мероприятия', keywords: 'афиша хакатон митап события билет', icon: PartyPopper, run: go('/campus?tab=events') },
      { id: 'sports', group: 'Разделы', label: 'Кампус: физкультура и секции', keywords: 'спорт физра секция зачет', icon: Dumbbell, run: go('/campus?tab=sports') },
      { id: 'messages', group: 'Разделы', label: 'Сообщения', keywords: 'чат мессенджер преподаватель одногруппники', icon: MessagesSquare, run: go('/messages') },
      { id: 'profile', group: 'Разделы', label: 'Профиль', keywords: 'студбилет фото аватар', icon: UserRound, run: go('/profile') },
    ];
    const actions: (Command | false)[] = [
      {
        id: 'rotate',
        group: 'Действия',
        label: 'Сгенерировать новый пароль Wi-Fi',
        keywords: 'wifi вайфай сменить пароль',
        icon: KeyRound,
        run: async () => {
          setBusy('rotate');
          try {
            await post('/api/campus/wifi/rotate');
            toast.success('Пароль Wi-Fi обновлён', 'Новый пароль — в разделе «Кампус → IT-доступы».');
            router.push('/campus?tab=it');
            onClose();
          } catch (e) {
            toast.error('Не удалось сменить пароль', e instanceof ApiError ? e.message : undefined);
          } finally {
            setBusy(null);
          }
        },
      },
      student && { id: 'order', group: 'Действия', label: 'Заказать справку об обучении', keywords: 'справка заявка документ', icon: FileText, run: go('/requests?order=STUDY_CERTIFICATE') },
      (student || isTeacher) && { id: 'ics', group: 'Действия', label: 'Экспорт расписания в календарь (.ics)', keywords: 'календарь ics google apple яндекс', icon: CalendarPlus, run: go('/schedule?export=ics') },
      {
        id: 'theme',
        group: 'Действия',
        label: 'Переключить светлую / тёмную тему',
        hint: readTheme() === 'dark' ? 'Сейчас: Obsidian Dark' : 'Сейчас: светлая',
        keywords: 'тема dark light ночь',
        icon: Moon,
        run: () => {
          applyTheme(readTheme() === 'dark' ? 'light' : 'dark');
          onClose();
        },
      },
      {
        id: 'ai',
        group: 'Действия',
        label: 'Открыть ИИ-помощника',
        keywords: 'copilot ии ai помощник чат',
        icon: Sparkles,
        run: () => {
          onClose();
          copilot.open();
        },
      },
    ];
    return [...nav, ...actions].filter((c): c is Command => Boolean(c));
  }, [go, student, isTeacher, isAdmin, toast, router, onClose, copilot]);

  const results = useMemo(() => (query.trim() ? commands.filter((c) => matches(c, query)) : commands), [commands, query]);

  // фокус, блокировка скролла, возврат фокуса
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    input.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      prev?.focus?.();
    };
  }, []);

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (results.length ? (i + 1) % results.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (results.length ? (i - 1 + results.length) % results.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const c = results[active];
      if (c && !busy) void c.run();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Tab') {
      e.preventDefault();
    }
  };

  let lastGroup = '';
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center px-3 pt-[12dvh] sm:px-6" onKeyDown={onKeyDown}>
      <div className="absolute inset-0 animate-[overlay-in_150ms_ease-out] bg-slate-900/30 dark:bg-black/50" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Командная палитра"
        className="glass relative flex max-h-[70dvh] w-full max-w-xl animate-[palette-in_160ms_ease-out] flex-col overflow-hidden rounded-2xl border shadow-sm"
      >
        <div className="flex items-center gap-3 border-b border-slate-200/80 px-4 dark:border-zinc-800/80">
          <Search size={18} strokeWidth={ICON_STROKE} className="shrink-0 text-slate-400 dark:text-zinc-500" />
          <input
            ref={input}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Раздел или действие…"
            aria-label="Поиск команд"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={results[active] ? `cmd-${results[active].id}` : undefined}
            className="h-14 min-w-0 flex-1 bg-transparent text-[15px] text-slate-900 outline-none placeholder:text-slate-400 dark:text-zinc-50 dark:placeholder:text-zinc-500"
          />
          <kbd className="hidden rounded border border-slate-200 px-1.5 py-0.5 text-[11px] text-slate-500 dark:border-zinc-700 dark:text-zinc-400 sm:inline">Esc</kbd>
        </div>
        <ul ref={list} id="palette-list" role="listbox" className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
          {results.length === 0 ? (
            <li className="px-3 py-8 text-center text-sm text-slate-500 dark:text-zinc-400">Ничего не найдено</li>
          ) : (
            results.map((c, i) => {
              const header = c.group !== lastGroup;
              lastGroup = c.group;
              const on = i === active;
              return (
                <li key={c.id} role="presentation">
                  {header && (
                    <p className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-400">{c.group}</p>
                  )}
                  <button
                    type="button"
                    id={`cmd-${c.id}`}
                    role="option"
                    aria-selected={on}
                    data-index={i}
                    onMouseMove={() => setActive(i)}
                    onClick={() => !busy && void c.run()}
                    className={cn(
                      'flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm transition-colors',
                      on ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400' : 'text-slate-700 dark:text-zinc-300',
                    )}
                  >
                    <c.icon size={16} strokeWidth={ICON_STROKE} className="shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{c.label}</span>
                    {busy === c.id ? (
                      <span className="text-xs text-slate-500 dark:text-zinc-400">Выполняется…</span>
                    ) : c.hint ? (
                      <span className="hidden text-xs text-slate-400 dark:text-zinc-500 sm:inline">{c.hint}</span>
                    ) : null}
                    {on && <CornerDownLeft size={14} strokeWidth={ICON_STROKE} className="shrink-0 opacity-70" />}
                  </button>
                </li>
              );
            })
          )}
        </ul>
        <div className="hidden items-center gap-4 border-t border-slate-200/80 px-4 py-2 text-[11px] text-slate-500 dark:border-zinc-800/80 dark:text-zinc-400 sm:flex">
          <span>↑↓ — выбор</span>
          <span>Enter — выполнить</span>
          <span className="ml-auto tabular-nums">⌘K / Ctrl+K</span>
        </div>
      </div>
    </div>
  );
}
