import { prisma } from '@/lib/prisma';
import { HttpError, json, route } from '@/lib/http';
import { requireSession } from '@/lib/session';
import { serializeBooking } from '@/lib/serializers';
import { isSlotUpcoming } from '@/lib/domain';

type Ctx = { params: Promise<{ id: string }> };

const IDOR_MESSAGE = 'Доступ запрещён: бронь принадлежит другому пользователю (IDOR protection)';

/**
 * DELETE /api/bookings/[id] — отмена своей брони (status → CANCELLED, слот освобождается).
 * Чужая или несуществующая бронь → одинаковый 403.
 */
export const DELETE = route<Ctx>(async (_req, { params }) => {
  const session = await requireSession();
  const { id } = await params;

  const booking = await prisma.roomBooking.findUnique({ where: { id } });
  if (!booking || booking.userId !== session.userId) {
    console.warn(`[security] IDOR blocked: user=${session.userId} tried booking=${id}`);
    throw new HttpError(403, IDOR_MESSAGE);
  }
  if (booking.status === 'CANCELLED') throw new HttpError(409, 'Бронь уже отменена');
  if (!isSlotUpcoming(booking.date, booking.timeSlot)) {
    throw new HttpError(409, 'Слот уже начался или прошёл — отменить бронь нельзя');
  }

  const updated = await prisma.roomBooking.update({
    where: { id: booking.id },
    data: { status: 'CANCELLED', activeSlotKey: null },
  });
  return json({ ok: true, booking: serializeBooking(updated, session.userId) });
});
