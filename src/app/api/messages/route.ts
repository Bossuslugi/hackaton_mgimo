import { prisma } from '@/lib/prisma';
import { json, route } from '@/lib/http';
import { requireSession } from '@/lib/session';
import { serializeContact, serializeMessage } from '@/lib/serializers';
import { isContact } from '@/lib/people';

const ROLE_ORDER: Record<string, number> = { TEACHER: 0, STUDENT: 1, ADMIN: 2 };

/**
 * GET /api/messages — контакты (одногруппники, преподаватели, деканат) с последним сообщением
 * и счётчиком непрочитанных. Выборка сообщений — только где session.userId участник.
 */
export const GET = route(async () => {
  const session = await requireSession();
  const me = session.userId;

  const [users, messages] = await Promise.all([
    prisma.user.findMany({
      where: { id: { not: me } },
      select: { id: true, fullName: true, role: true, groupName: true, department: true, position: true },
    }),
    prisma.directMessage.findMany({
      where: { OR: [{ senderId: me }, { receiverId: me }] },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const last = new Map<string, (typeof messages)[number]>();
  const unread = new Map<string, number>();
  for (const m of messages) {
    const peer = m.senderId === me ? m.receiverId : m.senderId;
    if (!last.has(peer)) last.set(peer, m);
    if (m.receiverId === me && !m.isRead) unread.set(peer, (unread.get(peer) ?? 0) + 1);
  }

  const contacts = users
    // Контакт по правилам ACL или собеседник, который уже написал первым.
    .filter((u) => isContact(session.user, u) || messages.some((m) => m.senderId === u.id))
    .map((u) => {
      const lm = last.get(u.id);
      return {
        ...serializeContact(u),
        lastMessage: lm ? serializeMessage(lm, me) : null,
        unreadCount: unread.get(u.id) ?? 0,
      };
    })
    .sort((a, b) => {
      const ta = a.lastMessage?.createdAt ?? '';
      const tb = b.lastMessage?.createdAt ?? '';
      if (ta !== tb) return tb.localeCompare(ta);
      return (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9) || a.fullName.localeCompare(b.fullName, 'ru');
    });

  return json({ contacts, unreadTotal: [...unread.values()].reduce((s, n) => s + n, 0) });
});
