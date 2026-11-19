import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { HttpError, json, parseBody, route } from '@/lib/http';
import { requireRole, requireSession } from '@/lib/session';
import { createRequestSchema } from '@/lib/validation';
import { requestOwnerSelect, serializeRequest } from '@/lib/serializers';
import { ACTIVE_REQUEST_STATUSES, REQUEST_SLA_DAYS, REQUEST_TYPE_LABELS, registryNumber } from '@/lib/domain';

export const GET = route(async () => {
  const session = await requireSession();
  if (session.role === 'ADMIN') {
    const rows = await prisma.documentRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: { user: { select: requestOwnerSelect } },
    });
    return json({ requests: rows.map(serializeRequest) });
  }
  const rows = await prisma.documentRequest.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: 'desc' },
  });
  return json({ requests: rows.map(serializeRequest) });
});

export const POST = route(async (req) => {
  const session = await requireRole('STUDENT');
  const { type, comment } = await parseBody(req, createRequestSchema);

  const duplicate = await prisma.documentRequest.findFirst({
    where: { userId: session.userId, type, status: { in: ACTIVE_REQUEST_STATUSES } },
  });
  if (duplicate) {
    throw new HttpError(409, `У вас уже есть активная заявка этого типа (${duplicate.registryNumber})`, {
      request: serializeRequest(duplicate),
    });
  }

  const label = REQUEST_TYPE_LABELS[type];
  const created = await prisma.$transaction(async (tx) => {
    const draft = await tx.documentRequest.create({
      data: {
        userId: session.userId, // владелец — только из сессии
        type,
        status: 'NEW',
        comment: comment ?? null,
        registryNumber: `TMP-${randomUUID()}`,
      },
    });
    const request = await tx.documentRequest.update({
      where: { id: draft.id },
      data: { registryNumber: registryNumber(draft.id, draft.createdAt) },
    });

    await tx.notification.create({
      data: {
        userId: session.userId,
        category: 'REQUEST',
        title: 'Заявка зарегистрирована',
        message: `Заявка ${request.registryNumber} «${label}» принята. Нормативный срок рассмотрения — ${REQUEST_SLA_DAYS[type]} раб. дн.`,
      },
    });
    const admins = await tx.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } });
    if (admins.length) {
      await tx.notification.createMany({
        data: admins.map((a) => ({
          userId: a.id,
          category: 'REQUEST',
          title: 'Новая заявка в очереди',
          message: `${session.user.fullName} (${session.user.groupName ?? '—'}): ${label}, ${request.registryNumber}.`,
        })),
      });
    }
    return request;
  });

  return json({ request: serializeRequest(created) }, 201);
});
