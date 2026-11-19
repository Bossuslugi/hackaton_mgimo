import { prisma } from '@/lib/prisma';
import { json, route } from '@/lib/http';
import { requireSession } from '@/lib/session';

export const POST = route(async () => {
  const { userId } = await requireSession();
  const { count } = await prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });
  return json({ ok: true, updated: count });
});
