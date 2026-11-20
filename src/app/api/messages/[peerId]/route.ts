import { prisma } from '@/lib/prisma';
import { HttpError, json, parseBody, route } from '@/lib/http';
import { requireSession, type Session } from '@/lib/session';
import { sendMessageSchema } from '@/lib/validation';
import { serializeContact, serializeMessage } from '@/lib/serializers';
import { canMessage } from '@/lib/people';
import { hit } from '@/lib/rate-limit';

type Ctx = { params: Promise<{ peerId: string }> };

const DENIED = 'Доступ запрещён: этот пользователь не входит в ваши контакты';

/** Собеседник должен существовать и проходить ACL контактов; иначе одинаковый 403 (без оракула). */
async function resolvePeer(session: Session, peerId: string) {
  if (peerId === session.userId) throw new HttpError(400, 'Нельзя переписываться с самим собой');
  const peer = await prisma.user.findUnique({
    where: { id: peerId },
    select: { id: true, fullName: true, role: true, groupName: true, department: true, position: true },
  });
  if (!peer || !(await canMessage(session.user, peer))) {
    console.warn(`[security] messenger blocked: user=${session.userId} peer=${peerId}`);
    throw new HttpError(403, DENIED);
  }
  return peer;
}

/** Условие «переписка двух людей», где один из них — всегда текущий пользователь. */
const dialogWhere = (me: string, peer: string) => ({
  OR: [
    { senderId: me, receiverId: peer },
    { senderId: peer, receiverId: me },
  ],
});

/** GET — история переписки session.userId ↔ peerId; входящие помечаются прочитанными. */
export const GET = route<Ctx>(async (_req, { params }) => {
  const session = await requireSession();
  const { peerId } = await params;
  const peer = await resolvePeer(session, peerId);

  const [rows] = await prisma.$transaction([
    prisma.directMessage.findMany({ where: dialogWhere(session.userId, peer.id), orderBy: { createdAt: 'desc' }, take: 200 }),
    prisma.directMessage.updateMany({
      where: { senderId: peer.id, receiverId: session.userId, isRead: false },
      data: { isRead: true },
    }),
  ]);

  return json({
    peer: serializeContact(peer),
    messages: rows.reverse().map((m) => serializeMessage(m, session.userId)),
  });
});

/** POST — новое сообщение от session.userId к peerId. */
export const POST = route<Ctx>(async (req, { params }) => {
  const session = await requireSession();
  const { peerId } = await params;
  const limit = hit(`msg:${session.userId}`, 30, 60_000);
  if (!limit.ok) throw new HttpError(429, 'Слишком много сообщений. Подождите немного.', { retryAfterSec: limit.retryAfterSec });

  const { content } = await parseBody(req, sendMessageSchema);
  const peer = await resolvePeer(session, peerId);

  const message = await prisma.directMessage.create({
    data: { senderId: session.userId, receiverId: peer.id, content },
  });
  return json({ message: serializeMessage(message, session.userId) }, 201);
});
