import { prisma } from '@/lib/prisma';
import { json, route } from '@/lib/http';
import { requireSession } from '@/lib/session';
import { serializeLesson } from '@/lib/serializers';

export const GET = route(async () => {
  const session = await requireSession();
  // Группа берётся из записи пользователя в БД, а не из параметров запроса.
  const where = session.role === 'ADMIN' ? {} : { groupName: session.user.groupName ?? '__none__' };
  const rows = await prisma.scheduleItem.findMany({
    where,
    orderBy: [{ groupName: 'asc' }, { dayOfWeek: 'asc' }, { startTime: 'asc' }],
  });
  const items = rows.map(serializeLesson);
  return json({ items, lessons: items });
});
