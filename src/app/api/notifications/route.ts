import { prisma } from '@/lib/prisma';
import { json, route } from '@/lib/http';
import { requireSession } from '@/lib/session';
import { serializeNotification } from '@/lib/serializers';

export const GET = route(async () => {
  const { userId } = await requireSession();
  const rows = await prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 100 });
  return json({
    notifications: rows.map(serializeNotification),
    unreadCount: rows.filter((n) => !n.isRead).length,
  });
});
