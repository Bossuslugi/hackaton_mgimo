import { prisma } from '@/lib/prisma';
import { json, route } from '@/lib/http';
import { requireSession } from '@/lib/session';
import { moscowDate } from '@/lib/domain';
import { EVENT_CATEGORIES, serializeEvent } from '@/lib/events';

/** GET /api/campus/events — афиша с флагом isRegistered и билетом текущего пользователя. */
export const GET = route(async () => {
  const session = await requireSession();
  const today = moscowDate(0);
  const [events, mine] = await Promise.all([
    prisma.campusEvent.findMany({ orderBy: [{ date: 'asc' }, { timeRange: 'asc' }] }),
    prisma.eventRegistration.findMany({ where: { userId: session.userId } }),
  ]);
  const byEvent = new Map(mine.map((r) => [r.eventId, r]));
  const items = events.map((e) => serializeEvent(e, byEvent.get(e.id), today));
  return json({
    events: items,
    categories: EVENT_CATEGORIES,
    myRegistrations: items.filter((e) => e.isRegistered).length,
  });
});
