import type { ScheduleItem } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { HttpError, json, route } from '@/lib/http';
import { requireSession } from '@/lib/session';
import { serializeLesson } from '@/lib/serializers';
import { scheduleQuerySchema } from '@/lib/validation';
import { searchKey } from '@/lib/domain';
import { scheduleTeacherName } from '@/lib/people';

const byTime = (a: ScheduleItem, b: ScheduleItem) =>
  a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime) || a.groupName.localeCompare(b.groupName);

/**
 * GET /api/schedule?mode=my|group|room&query=…
 * my — своё расписание (V1-поведение); group/room — поиск по всему вузу.
 * Регистронезависимый поиск выполняется в коде: LIKE в SQLite не понимает регистр кириллицы.
 */
export const GET = route(async (req) => {
  const session = await requireSession();
  const params = new URL(req.url).searchParams;
  const parsed = scheduleQuerySchema.safeParse({
    mode: params.get('mode') || undefined,
    query: params.get('query') ?? undefined,
  });
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Некорректные параметры поиска');
  const { mode, query } = parsed.data;

  const all = await prisma.scheduleItem.findMany();
  const availableGroups = [...new Set(all.map((i) => i.groupName))].sort();
  const availableRooms = [...new Set(all.map((i) => i.room))].sort((a, b) => a.localeCompare(b, 'ru'));

  let rows: ScheduleItem[];
  if (mode === 'group') {
    const q = searchKey(query!);
    const exact = all.filter((i) => searchKey(i.groupName) === q);
    rows = exact.length ? exact : all.filter((i) => searchKey(i.groupName).includes(q));
  } else if (mode === 'room') {
    const q = searchKey(query!);
    rows = all.filter((i) => searchKey(i.room).includes(q) || searchKey(i.building).includes(q));
  } else if (session.role === 'STUDENT') {
    // Группа берётся из записи пользователя в БД, а не из параметров запроса.
    rows = all.filter((i) => i.groupName === session.user.groupName);
  } else if (session.role === 'TEACHER') {
    const me = scheduleTeacherName(session.user);
    rows = all.filter((i) => i.teacher === me);
  } else {
    rows = all;
  }

  const items = rows.sort(byTime).map(serializeLesson);
  return json({ items, lessons: items, mode, query: query ?? null, availableGroups, availableRooms });
});
