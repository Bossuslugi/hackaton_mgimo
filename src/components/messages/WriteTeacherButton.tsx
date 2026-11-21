'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquareText } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { get } from '@/lib/api';
import { cn } from '@/lib/cn';
import { toContacts } from '@/lib/normalize-v2';
import type { Contact } from '@/lib/types';
import { ICON_STROKE } from '@/lib/ui';

const TITLES = /^(доц\.?|проф\.?|ст\.?\s*преп\.?|асс\.?|преп\.?)\s+/i;

/**
 * Ищет преподавателя среди контактов по фамилии и первому инициалу:
 * «Доц. Волков И. С.» / «Волков И. С.» → «Волков Игорь Сергеевич», но не «Волкова Н. А.».
 */
export function findTeacher(contacts: Contact[], name: string): Contact | null {
  const parts = name.replace(TITLES, '').replace(/\./g, ' ').trim().split(/\s+/);
  const surname = parts[0]?.toLowerCase();
  const initial = parts[1]?.[0]?.toLowerCase();
  if (!surname) return null;
  const teachers = contacts.filter((c) => c.role === 'TEACHER');
  return (
    teachers.find((c) => {
      const [s, f] = c.fullName.toLowerCase().split(/\s+/);
      return s === surname && (!initial || f?.[0] === initial);
    }) ?? null
  );
}

export function messagesHref(peerId: string, draft?: string) {
  const q = new URLSearchParams({ peer: peerId });
  if (draft) q.set('draft', draft);
  return `/messages?${q.toString()}`;
}

/** Компактная кнопка «Написать преподавателю»: сразу открывает диалог с нужным человеком. */
export function WriteTeacherButton({
  teacherName,
  draft,
  className,
  label = 'Написать преподавателю',
  iconOnly,
}: {
  teacherName?: string | null;
  draft?: string;
  className?: string;
  label?: string;
  iconOnly?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  if (!teacherName) return null;

  async function go() {
    setBusy(true);
    try {
      const { contacts } = toContacts(await get('/api/messages'));
      const t = findTeacher(contacts, teacherName!);
      if (t) router.push(messagesHref(t.id, draft));
      else {
        toast.info('Преподаватель не найден в контактах', 'Открываем список преподавателей.');
        router.push('/messages?filter=teachers');
      }
    } catch {
      router.push('/messages?filter=teachers');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      loading={busy}
      onClick={() => void go()}
      icon={<MessageSquareText size={14} strokeWidth={ICON_STROKE} />}
      aria-label={iconOnly ? `${label}: ${teacherName}` : undefined}
      title={`${label}: ${teacherName}`}
      square={iconOnly}
      className={cn(iconOnly ? 'max-sm:size-11' : 'min-h-11 sm:min-h-9', className)}
    >
      {iconOnly ? null : label}
    </Button>
  );
}
