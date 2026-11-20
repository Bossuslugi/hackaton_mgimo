import { prisma } from '@/lib/prisma';
import { HttpError, json, parseBody, route } from '@/lib/http';
import { requireRole, requireSession } from '@/lib/session';
import { updateRequestSchema } from '@/lib/validation';
import { requestOwnerSelect, serializeRequest } from '@/lib/serializers';
import { REQUEST_STATUS_LABELS, REQUEST_TYPE_LABELS, shortName, type RequestType } from '@/lib/domain';

type Ctx = { params: Promise<{ id: string }> };

const IDOR_MESSAGE = 'Доступ запрещён: попытка обращения к чужой заявке (IDOR protection)';

function parseId(raw: string): number | null {
  return /^\d{1,9}$/.test(raw) ? Number(raw) : null;
}

/**
 * КРИТИЧНЫЙ IDOR-ЭНДПОИНТ (specs/03_DATA_AND_SECURITY.md §4.3).
 * Любая роль, кроме ADMIN (студент, преподаватель), получает только свою заявку. Чужая, несуществующая и некорректная — одинаковый 403,
 * чтобы по разнице ответов нельзя было перечислить чужие заявки.
 */
export const GET = route<Ctx>(async (_req, { params }) => {
  const session = await requireSession();
  const { id: rawId } = await params;
  const id = parseId(rawId);

  const request =
    id === null
      ? null
      : await prisma.documentRequest.findUnique({ where: { id }, include: { user: { select: requestOwnerSelect } } });

  if (session.role !== 'ADMIN') {
    if (!request || request.userId !== session.userId) {
      console.warn(`[security] IDOR blocked: user=${session.userId} tried request=${rawId}`);
      throw new HttpError(403, IDOR_MESSAGE);
    }
    const { user: _owner, ...own } = request;
    return json({ request: serializeRequest(own) });
  }

  if (!request) throw new HttpError(404, 'Заявка не найдена');
  return json({ request: serializeRequest(request) });
});

/** Решение по заявке — только сотрудник деканата. Владелец получает уведомление. */
export const PATCH = route<Ctx>(async (req, { params }) => {
  const session = await requireRole('ADMIN');
  const { id: rawId } = await params;
  const id = parseId(rawId);
  if (id === null) throw new HttpError(404, 'Заявка не найдена');
  const { status, adminComment } = await parseBody(req, updateRequestSchema);

  const existing = await prisma.documentRequest.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, 'Заявка не найдена');
  if (existing.status === 'APPROVED' || existing.status === 'REJECTED') {
    throw new HttpError(409, `Заявка уже закрыта (статус «${REQUEST_STATUS_LABELS[existing.status as 'APPROVED' | 'REJECTED']}»)`);
  }

  const reviewer = shortName(session.user.fullName);
  const label = REQUEST_TYPE_LABELS[existing.type as RequestType] ?? existing.type;
  const verb = { IN_REVIEW: 'взята в работу', APPROVED: 'одобрена', REJECTED: 'отклонена' }[status];

  const updated = await prisma.$transaction(async (tx) => {
    const r = await tx.documentRequest.update({
      where: { id },
      data: { status, adminComment: adminComment ?? existing.adminComment, reviewedBy: reviewer },
      include: { user: { select: requestOwnerSelect } },
    });
    await tx.notification.create({
      data: {
        userId: existing.userId,
        category: 'REQUEST',
        title: `Заявка ${verb}`,
        message: `${r.registryNumber} «${label}» ${verb}.${adminComment ? ` Комментарий деканата: ${adminComment}` : ''}`,
        isCritical: status === 'REJECTED',
      },
    });
    return r;
  });

  return json({ request: serializeRequest(updated) });
});
