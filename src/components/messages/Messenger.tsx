'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, CircleAlert, MessagesSquare, RotateCcw, Search, SendHorizontal } from 'lucide-react';
import { useSession } from '@/components/shell/SessionProvider';
import { useMessagesUnread } from '@/components/shell/MessagesUnread';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/PageHeader';
import { Segmented } from '@/components/ui/Segmented';
import { Skeleton } from '@/components/ui/Skeleton';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { ApiError, get, post } from '@/lib/api';
import { cn } from '@/lib/cn';
import { fmtChatStamp, fmtDate, fmtTime, initials } from '@/lib/format';
import { toContacts, toMessage, toThread, type ContactsData } from '@/lib/normalize-v2';
import type { Contact, Message, Role } from '@/lib/types';
import { ICON_STROKE } from '@/lib/ui';
import { useApi } from '@/lib/use-api';

type Filter = 'all' | 'teachers' | 'peers';

const ROLE_BADGE: Record<Role, { label: string; tone: BadgeTone }> = {
  TEACHER: { label: 'Преподаватель', tone: 'brand' },
  STUDENT: { label: 'Студент', tone: 'neutral' },
  ADMIN: { label: 'Деканат', tone: 'warning' },
};

const TEMPLATES_STUDENT = [
  'Добрый день! Подскажите по поводу лабораторной работы…',
  'Здравствуйте! Можно ли сдать работу после дедлайна?',
  'Добрый день! Когда будет консультация перед РК?',
  'Спасибо за разбор!',
];
const TEMPLATES_PEER = ['Привет! Скинь, пожалуйста, конспект последней лекции', 'Идём в коворкинг готовиться?', 'Во сколько завтра пара?'];
const TEMPLATES_TEACHER = [
  'Добрый день! Решение проверено, оценка выставлена.',
  'Пожалуйста, доработайте решение и отправьте повторно.',
  'Консультация — в четверг в 15:20, ауд. 301.',
];

const POLL_MS = 10_000;

/** Мессенджер: GET /api/messages, GET/POST /api/messages/[peerId]. */
export function Messenger() {
  const { user, isTeacher, isAdmin } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const peerId = params.get('peer');
  const draft = params.get('draft') ?? '';
  const unread = useMessagesUnread();
  const state = useApi<ContactsData>('/api/messages', toContacts);
  const [filter, setFilter] = useState<Filter>(params.get('filter') === 'teachers' ? 'teachers' : 'all');
  const [query, setQuery] = useState('');

  const staff = isTeacher || isAdmin;
  const isPeer = useCallback(
    (c: Contact) => c.role === 'STUDENT' && (staff || (!!user.group && c.group === user.group)),
    [staff, user.group],
  );

  const contacts = state.data?.contacts ?? [];
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contacts
      .filter((c) => (filter === 'teachers' ? c.role === 'TEACHER' : filter === 'peers' ? isPeer(c) : true))
      .filter((c) => !q || `${c.fullName} ${c.group ?? ''} ${c.department ?? ''}`.toLowerCase().includes(q));
  }, [contacts, filter, query, isPeer]);

  const peer = contacts.find((c) => c.id === peerId) ?? null;

  const select = (id: string | null) => router.replace(id ? `${pathname}?peer=${encodeURIComponent(id)}` : pathname, { scroll: false });

  // отметили диалог прочитанным — обнуляем счётчик у контакта
  const markRead = useCallback(
    (id: string) => {
      state.setData((d) => (d ? { ...d, contacts: d.contacts.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c)) } : d));
      unread.refresh();
    },
    [state, unread],
  );

  const onSent = useCallback(
    (m: Message) =>
      state.setData((d) => {
        if (!d) return d;
        const id = m.receiverId;
        const c = d.contacts.find((x) => x.id === id);
        if (!c) return d;
        return { ...d, contacts: [{ ...c, lastMessage: m }, ...d.contacts.filter((x) => x.id !== id)] };
      }),
    [state],
  );

  return (
    <>
      <PageHeader
        title="Сообщения"
        description={staff ? 'Переписка со студентами и коллегами' : 'Одногруппники, преподаватели и деканат'}
        className={cn(peerId && 'hidden lg:flex')}
      />

      {state.error ? (
        <ErrorState error={state.error} onRetry={state.reload} />
      ) : (
        <Card className="grid h-[calc(100dvh-9.5rem)] min-h-[440px] overflow-hidden lg:h-[calc(100dvh-13rem)] lg:grid-cols-[320px_minmax(0,1fr)]">
          {/* СПИСОК КОНТАКТОВ */}
          <aside
            aria-label="Контакты"
            className={cn('min-h-0 flex-col border-slate-200 dark:border-zinc-800 lg:flex lg:border-r', peerId ? 'hidden' : 'flex')}
          >
            <div className="space-y-2.5 border-b border-slate-200 p-3 dark:border-zinc-800">
              <div className="relative">
                <Search size={16} strokeWidth={ICON_STROKE} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по людям" aria-label="Поиск по людям" className="pl-9" />
              </div>
              <Segmented<Filter>
                size="sm"
                ariaLabel="Фильтр контактов"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: 'all', label: 'Все' },
                  { value: 'teachers', label: 'Преподаватели' },
                  { value: 'peers', label: staff ? 'Студенты' : 'Группа' },
                ]}
              />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {state.loading && !state.data ? (
                <ul className="divide-y divide-slate-200 dark:divide-zinc-800">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <li key={i} className="flex gap-3 p-3">
                      <Skeleton className="size-10 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-3.5 w-2/3" />
                        <Skeleton className="h-3 w-5/6" />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : list.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-slate-500 dark:text-zinc-400">Никого не нашли</p>
              ) : (
                <ul className="divide-y divide-slate-200 dark:divide-zinc-800">
                  {list.map((c) => (
                    <li key={c.id}>
                      <ContactRow c={c} active={c.id === peerId} myId={user.id} onClick={() => select(c.id)} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>

          {/* ДИАЛОГ */}
          <section aria-label="Диалог" className={cn('min-h-0 flex-col lg:flex', peerId ? 'flex' : 'hidden')}>
            {peerId ? (
              <Thread
                key={peerId}
                peerId={peerId}
                fallbackPeer={peer}
                initialDraft={draft}
                templates={isTeacher ? TEMPLATES_TEACHER : peer && peer.role === 'STUDENT' ? TEMPLATES_PEER : TEMPLATES_STUDENT}
                onBack={() => select(null)}
                onRead={markRead}
                onSent={onSent}
              />
            ) : (
              <div className="flex flex-1 items-center justify-center p-6">
                <EmptyState
                  className="border-0"
                  icon={<MessagesSquare size={20} strokeWidth={ICON_STROKE} />}
                  title="Выберите диалог"
                  description="Напишите преподавателю по лабораторной или одногруппнику — история сохранится здесь."
                />
              </div>
            )}
          </section>
        </Card>
      )}
    </>
  );
}

function Avatar({ name, role }: { name: string; role: Role }) {
  return (
    <span
      className={cn(
        'inline-flex size-10 shrink-0 items-center justify-center rounded-full border text-sm font-medium',
        role === 'TEACHER'
          ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-400'
          : 'border-slate-200 bg-slate-100 text-slate-700 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300',
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

function subtitle(c: Contact): string {
  if (c.role === 'TEACHER') return c.department ?? c.position ?? 'Преподаватель';
  if (c.role === 'ADMIN') return c.position ?? 'Деканат';
  return c.group ? `Группа ${c.group}` : 'Студент';
}

function ContactRow({ c, active, myId, onClick }: { c: Contact; active: boolean; myId: string; onClick: () => void }) {
  const last = c.lastMessage;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'flex w-full min-w-0 items-start gap-3 px-3 py-3 text-left transition-colors',
        active ? 'bg-blue-50 dark:bg-blue-500/10' : 'hover:bg-slate-50 dark:hover:bg-zinc-900',
      )}
    >
      <Avatar name={c.fullName} role={c.role} />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className={cn('min-w-0 flex-1 truncate text-sm text-slate-900 dark:text-zinc-50', c.unreadCount > 0 ? 'font-semibold' : 'font-medium')}>
            {c.fullName}
          </span>
          {last && <span className="shrink-0 text-[11px] text-slate-400 tabular-nums dark:text-zinc-500">{fmtChatStamp(last.createdAt)}</span>}
        </span>
        <span className="mt-0.5 flex items-center gap-1.5">
          <Badge tone={ROLE_BADGE[c.role].tone} className="px-1.5 py-0 text-[11px]">
            {c.role === 'STUDENT' && c.group ? c.group : ROLE_BADGE[c.role].label}
          </Badge>
          <span className="truncate text-xs text-slate-500 dark:text-zinc-400">{c.role === 'STUDENT' ? 'Студент' : subtitle(c)}</span>
        </span>
        <span className="mt-1 flex items-center gap-2">
          <span className={cn('min-w-0 flex-1 truncate text-sm', c.unreadCount > 0 ? 'text-slate-900 dark:text-zinc-50' : 'text-slate-500 dark:text-zinc-400')}>
            {last ? `${last.senderId === myId ? 'Вы: ' : ''}${last.content}` : 'Нет сообщений'}
          </span>
          {c.unreadCount > 0 && (
            <span className="inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-blue-600 px-1 text-[11px] font-semibold text-white tabular-nums dark:bg-blue-500">
              {c.unreadCount}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}

function Thread({
  peerId,
  fallbackPeer,
  initialDraft,
  templates,
  onBack,
  onRead,
  onSent,
}: {
  peerId: string;
  fallbackPeer: Contact | null;
  initialDraft: string;
  templates: string[];
  onBack: () => void;
  onRead: (id: string) => void;
  onSent: (m: Message) => void;
}) {
  const toast = useToast();
  const [peer, setPeer] = useState<Contact | null>(fallbackPeer);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [text, setText] = useState(initialDraft);
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const onReadRef = useRef(onRead);
  onReadRef.current = onRead;

  const load = useCallback(
    async (silent = false) => {
      try {
        const t = toThread(await get(`/api/messages/${encodeURIComponent(peerId)}`));
        if (t.peer) setPeer(t.peer);
        setMessages((prev) => {
          const pending = (prev ?? []).filter((m) => m.pending || m.failed);
          return [...t.messages, ...pending];
        });
        setError(null);
        onReadRef.current(peerId);
      } catch (e) {
        if (!silent) setError(e instanceof ApiError ? e : new ApiError(0, 'Не удалось загрузить переписку', null));
      }
    },
    [peerId],
  );

  useEffect(() => {
    void load();
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load(true);
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  // автопрокрутка к последнему сообщению
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages?.length]);

  useEffect(() => {
    if (initialDraft && input.current) {
      input.current.focus();
      input.current.setSelectionRange(initialDraft.length, initialDraft.length);
    }
  }, [initialDraft]);

  async function send(content: string, retryId?: string) {
    const body = content.trim();
    if (!body) return;
    if (body.length > 2000) {
      toast.error('Сообщение слишком длинное', 'Не больше 2000 символов.');
      return;
    }
    const tempId = retryId ?? `tmp-${Date.now()}`;
    const temp: Message = { id: tempId, senderId: 'me', receiverId: peerId, content: body, isRead: false, mine: true, createdAt: new Date().toISOString(), pending: true };
    setMessages((xs) => [...(xs ?? []).filter((m) => m.id !== tempId), temp]);
    if (!retryId) setText('');
    try {
      const m = toMessage(await post(`/api/messages/${encodeURIComponent(peerId)}`, { content: body }));
      if (m) {
        setMessages((xs) => (xs ?? []).map((x) => (x.id === tempId ? m : x)));
        onSent(m);
      }
    } catch (e) {
      setMessages((xs) => (xs ?? []).map((x) => (x.id === tempId ? { ...x, pending: false, failed: true } : x)));
      toast.error('Сообщение не отправлено', e instanceof ApiError ? e.message : undefined);
    }
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send(text);
    }
  };

  const groups = useMemo(() => {
    const out: { day: string; items: Message[] }[] = [];
    for (const m of messages ?? []) {
      const day = new Date(m.createdAt).toDateString();
      const g = out[out.length - 1];
      if (g && g.day === day) g.items.push(m);
      else out.push({ day, items: [m] });
    }
    return out;
  }, [messages]);

  return (
    <>
      <header className="flex shrink-0 items-center gap-2 border-b border-slate-200 px-2 py-2 dark:border-zinc-800 sm:px-4">
        <button
          type="button"
          onClick={onBack}
          aria-label="Назад к списку диалогов"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800 lg:hidden"
        >
          <ArrowLeft size={18} strokeWidth={ICON_STROKE} />
        </button>
        {peer ? (
          <>
            <Avatar name={peer.fullName} role={peer.role} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-zinc-50">{peer.fullName}</p>
              <p className="truncate text-xs text-slate-500 tabular-nums dark:text-zinc-400">
                {ROLE_BADGE[peer.role].label} · {subtitle(peer)}
              </p>
            </div>
          </>
        ) : (
          <Skeleton className="h-8 w-48" />
        )}
      </header>

      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-slate-50 px-3 py-4 dark:bg-zinc-950 sm:px-5" aria-live="polite">
        {error ? (
          <ErrorState error={error} onRetry={() => void load()} />
        ) : messages === null ? (
          <div className="flex h-full items-center justify-center">
            <Spinner className="text-slate-400 dark:text-zinc-500" />
          </div>
        ) : messages.length === 0 ? (
          <p className="mx-auto mt-10 max-w-xs text-center text-sm text-slate-500 dark:text-zinc-400">
            Здесь начнётся переписка. Выберите шаблон ниже или напишите своё сообщение.
          </p>
        ) : (
          groups.map((g) => (
            <div key={g.day} className="space-y-1.5">
              <p className="sticky top-0 z-10 mx-auto my-3 w-fit rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] text-slate-500 tabular-nums dark:border-zinc-800 dark:bg-[#12141A] dark:text-zinc-400">
                {fmtDate(g.items[0].createdAt)}
              </p>
              {g.items.map((m) => (
                <Bubble key={m.id} m={m} onRetry={() => void send(m.content, m.id)} />
              ))}
            </div>
          ))
        )}
      </div>

      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          void send(text);
        }}
        className="shrink-0 border-t border-slate-200 bg-white p-2.5 dark:border-zinc-800 dark:bg-[#12141A] sm:p-3"
      >
        <div className="-mx-1 mb-2 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]" aria-label="Быстрые шаблоны">
          {templates.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setText(t.replace(/…$/, ' '));
                input.current?.focus();
              }}
              className="min-h-9 shrink-0 rounded-full border border-slate-200 px-3 text-xs text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
            >
              {t.length > 42 ? `${t.slice(0, 40)}…` : t}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <textarea
            ref={input}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            maxLength={2000}
            placeholder="Сообщение…"
            aria-label="Текст сообщения"
            className="max-h-36 min-h-11 flex-1 resize-none rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 [field-sizing:content] placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/15 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-blue-500 dark:focus:ring-blue-500/20"
          />
          <button
            type="submit"
            disabled={!text.trim()}
            aria-label="Отправить"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white transition-colors hover:bg-blue-700 disabled:opacity-40 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            <SendHorizontal size={18} strokeWidth={ICON_STROKE} />
          </button>
        </div>
        <p className="mt-1.5 hidden text-[11px] text-slate-400 dark:text-zinc-500 sm:block">Enter — отправить · Shift+Enter — новая строка</p>
      </form>
    </>
  );
}

function Bubble({ m, onRetry }: { m: Message; onRetry: () => void }) {
  return (
    <div className={cn('flex', m.mine ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-3 py-2 text-sm sm:max-w-[70%]',
          m.mine
            ? 'rounded-br-md bg-blue-600 text-white dark:bg-blue-500'
            : 'rounded-bl-md border border-slate-200 bg-white text-slate-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100',
          m.pending && 'opacity-70',
          m.failed && 'bg-red-50 text-red-800 dark:bg-red-950/60 dark:text-red-200',
        )}
      >
        <p className="whitespace-pre-wrap break-words">{m.content}</p>
        <p
          className={cn(
            'mt-0.5 flex items-center justify-end gap-1 text-[11px] tabular-nums',
            m.mine && !m.failed ? 'text-blue-100' : 'text-slate-400 dark:text-zinc-500',
          )}
        >
          {m.failed ? (
            <button type="button" onClick={onRetry} className="inline-flex items-center gap-1 font-medium text-red-700 dark:text-red-300">
              <CircleAlert size={12} strokeWidth={ICON_STROKE} />
              Не отправлено · повторить
              <RotateCcw size={12} strokeWidth={ICON_STROKE} />
            </button>
          ) : m.pending ? (
            'Отправка…'
          ) : (
            <>
              {fmtTime(m.createdAt)}
              {m.mine && <span aria-label={m.isRead ? 'Прочитано' : 'Доставлено'}>{m.isRead ? '· прочитано' : ''}</span>}
            </>
          )}
        </p>
      </div>
    </div>
  );
}
