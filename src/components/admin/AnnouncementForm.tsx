'use client';

import { useState, type FormEvent } from 'react';
import { DoorOpen, Megaphone, Send } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input, Label, Textarea } from '@/components/ui/Field';
import { Segmented } from '@/components/ui/Segmented';
import { useToast } from '@/components/ui/Toast';
import { ApiError, post } from '@/lib/api';
import { cn } from '@/lib/cn';
import { fmtDateTime } from '@/lib/format';
import { toAnnouncement } from '@/lib/normalize';
import type { Announcement } from '@/lib/types';
import { ICON_STROKE } from '@/lib/ui';

type Kind = 'URGENT' | 'ROOM_CHANGE';

export function AnnouncementForm() {
  const toast = useToast();
  const [kind, setKind] = useState<Kind>('URGENT');
  const [group, setGroup] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [subject, setSubject] = useState('');
  const [oldRoom, setOldRoom] = useState('');
  const [newRoom, setNewRoom] = useState('');
  const [busy, setBusy] = useState(false);
  const [published, setPublished] = useState<Announcement[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const e: Record<string, string> = {};
    if (kind === 'URGENT') {
      if (!title.trim()) e.title = 'Укажите заголовок';
      if (!body.trim()) e.body = 'Добавьте текст объявления';
    } else {
      if (!subject.trim()) e.subject = 'Укажите дисциплину';
      if (!newRoom.trim()) e.newRoom = 'Укажите новую аудиторию';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    setBusy(true);
    const payload =
      kind === 'URGENT'
        ? { type: kind, title: title.trim(), body: body.trim(), group: group.trim() || undefined }
        : {
            type: kind,
            title: `Перенос аудитории: ${subject.trim()}`,
            body:
              body.trim() ||
              `Занятие по дисциплине «${subject.trim()}» переносится${oldRoom.trim() ? ` из ауд. ${oldRoom.trim()}` : ''} в ауд. ${newRoom.trim()}.`,
            group: group.trim() || undefined,
            subject: subject.trim(),
            oldRoom: oldRoom.trim() || undefined,
            newRoom: newRoom.trim(),
          };
    try {
      const raw = await post('/api/admin/announcements', payload);
      const a = toAnnouncement(raw) ?? {
        id: String(Date.now()),
        type: kind,
        title: payload.title,
        body: payload.body,
        createdAt: new Date().toISOString(),
        group: payload.group,
      };
      setPublished((xs) => [{ ...a, title: a.title || payload.title, body: a.body || payload.body }, ...xs].slice(0, 5));
      toast.success('Опубликовано', group.trim() ? `Получатели: группа ${group.trim()}` : 'Получатели: все студенты');
      setTitle('');
      setBody('');
      setSubject('');
      setOldRoom('');
      setNewRoom('');
    } catch (e) {
      toast.error('Не удалось опубликовать', e instanceof ApiError ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  }

  const err = (k: string) => errors[k] && <p className="mt-1 text-xs text-red-700">{errors[k]}</p>;

  return (
    <Card className="p-4 sm:p-5 lg:grid lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)] lg:gap-10 lg:p-6">
      <div className="min-w-0">
        <h2 className="text-sm font-medium text-slate-900">Срочное объявление</h2>
        <p className="mt-0.5 text-sm text-slate-500">Придёт в колокольчик и на «Фокус дня» студентов</p>
        <p className="mt-3 hidden text-sm leading-relaxed text-slate-500 lg:block">
          Перенос аудитории сразу отмечается в расписании группы янтарным бейджем «Перенос» со старой и новой аудиторией.
        </p>
        {published.length > 0 && <Published items={published} />}
      </div>

      <form onSubmit={onSubmit} className="mt-4 max-w-2xl space-y-4 lg:mt-0" noValidate>
        <Segmented<Kind>
          block
          ariaLabel="Тип объявления"
          value={kind}
          onChange={(k) => {
            setKind(k);
            setErrors({});
          }}
          options={[
            { value: 'URGENT', label: 'Объявление' },
            { value: 'ROOM_CHANGE', label: 'Перенос аудитории' },
          ]}
        />

        <div>
          <Label htmlFor="ann-group" hint="Пусто — всем">
            Группа
          </Label>
          <Input
            id="ann-group"
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            placeholder="ИУ7-31Б"
            className="tabular-nums"
          />
        </div>

        {kind === 'URGENT' ? (
          <>
            <div>
              <Label htmlFor="ann-title">Заголовок</Label>
              <Input
                id="ann-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Отмена пар 20 ноября после 14:00"
                aria-invalid={Boolean(errors.title)}
              />
              {err('title')}
            </div>
            <div>
              <Label htmlFor="ann-body">Текст</Label>
              <Textarea
                id="ann-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Коротко и по делу: что случилось, что делать студентам"
                aria-invalid={Boolean(errors.body)}
              />
              {err('body')}
            </div>
          </>
        ) : (
          <>
            <div>
              <Label htmlFor="ann-subject">Дисциплина</Label>
              <Input
                id="ann-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Математический анализ"
                aria-invalid={Boolean(errors.subject)}
              />
              {err('subject')}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="ann-old">Было</Label>
                <Input
                  id="ann-old"
                  value={oldRoom}
                  onChange={(e) => setOldRoom(e.target.value)}
                  placeholder="345"
                  className="tabular-nums"
                />
              </div>
              <div>
                <Label htmlFor="ann-new">Стало</Label>
                <Input
                  id="ann-new"
                  value={newRoom}
                  onChange={(e) => setNewRoom(e.target.value)}
                  placeholder="218-Л"
                  className="tabular-nums"
                  aria-invalid={Boolean(errors.newRoom)}
                />
              </div>
            </div>
            {err('newRoom')}
            <div>
              <Label htmlFor="ann-note" hint="Необязательно">
                Комментарий
              </Label>
              <Textarea
                id="ann-note"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Причина переноса"
                className="min-h-20"
              />
            </div>
          </>
        )}

        <Button type="submit" block size="lg" loading={busy} icon={<Send size={16} strokeWidth={ICON_STROKE} />}>
          Опубликовать
        </Button>
      </form>

    </Card>
  );
}

function Published({ items }: { items: Announcement[] }) {
  return (
    <div className="mt-5 border-t border-slate-200 pt-4">
      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Опубликовано в этой сессии</p>
      <ul className="mt-2 space-y-2">
            {items.map((a) => (
              <li key={a.id} className="flex gap-2.5 text-sm">
                {a.type === 'ROOM_CHANGE' ? (
                  <DoorOpen size={16} strokeWidth={ICON_STROKE} className="mt-0.5 shrink-0 text-amber-600" />
                ) : (
                  <Megaphone size={16} strokeWidth={ICON_STROKE} className="mt-0.5 shrink-0 text-red-600" />
                )}
                <div className="min-w-0">
                  <p className={cn('font-medium text-slate-900 break-words')}>{a.title}</p>
                  <p className="text-xs text-slate-500 tabular-nums">
                    {fmtDateTime(a.createdAt)}
                    {a.group ? ` · ${a.group}` : ' · все группы'}
                  </p>
                </div>
              </li>
            ))}
          </ul>
    </div>
  );
}
