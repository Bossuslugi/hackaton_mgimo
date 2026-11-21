import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { HttpError, json, route } from '@/lib/http';
import { requireSession } from '@/lib/session';
import { moscowDate } from '@/lib/domain';
import { generateTicketCode } from '@/lib/campus';
import { serializeEvent } from '@/lib/events';

type Ctx = { params: Promise<{ id: string }> };

const isUnique = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';

/**
 * POST /api/campus/events/[id]/toggle — запись/отмена записи session.userId в одной транзакции.
 * Счётчик меняется условным updateMany (registeredCount < capacity), дубль — защищён @@unique([eventId, userId]).
 */
export const POST = route<Ctx>(async (_req, { params }) => {
  const session = await requireSession();
  const { id } = await params;
  const today = moscowDate(0);

  const event = await prisma.campusEvent.findUnique({ where: { id } });
  if (!event) throw new HttpError(404, 'Мероприятие не найдено');
  if (event.date < today) throw new HttpError(409, 'Мероприятие уже прошло — запись закрыта');

  const existing = await prisma.eventRegistration.findUnique({
    where: { eventId_userId: { eventId: id, userId: session.userId } },
  });

  try {
    const result = await prisma.$transaction(async (tx) => {
      if (existing) {
        const { count } = await tx.eventRegistration.deleteMany({ where: { id: existing.id, userId: session.userId } });
        if (count) {
          await tx.campusEvent.updateMany({ where: { id, registeredCount: { gt: 0 } }, data: { registeredCount: { decrement: 1 } } });
        }
        return { action: 'unregistered' as const, registration: null };
      }

      const { count } = await tx.campusEvent.updateMany({
        where: { id, registeredCount: { lt: event.capacity } },
        data: { registeredCount: { increment: 1 } },
      });
      if (!count) throw new HttpError(409, `Все места на «${event.title}» заняты`);

      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const registration = await tx.eventRegistration.create({
            data: { eventId: id, userId: session.userId, ticketCode: generateTicketCode(event.date.slice(0, 4)) },
          });
          return { action: 'registered' as const, registration };
        } catch (e) {
          // Коллизия кода билета — генерируем новый; дубль регистрации пробрасываем наружу.
          if (isUnique(e) && String((e as Prisma.PrismaClientKnownRequestError).meta?.target ?? '').includes('ticketCode')) continue;
          throw e;
        }
      }
      throw new Error('Не удалось сгенерировать уникальный код билета');
    });

    const fresh = await prisma.campusEvent.findUniqueOrThrow({ where: { id } });
    return json({ action: result.action, event: serializeEvent(fresh, result.registration, today) });
  } catch (e) {
    // Параллельный запрос того же пользователя уже создал регистрацию — транзакция откатила инкремент.
    if (isUnique(e)) {
      const [fresh, reg] = await Promise.all([
        prisma.campusEvent.findUniqueOrThrow({ where: { id } }),
        prisma.eventRegistration.findUnique({ where: { eventId_userId: { eventId: id, userId: session.userId } } }),
      ]);
      return json({ action: 'registered', event: serializeEvent(fresh, reg, today) });
    }
    throw e;
  }
});
