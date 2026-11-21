import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { HttpError, json, route } from '@/lib/http';
import { requireRole } from '@/lib/session';
import { serializeSection } from '@/lib/events';

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/campus/sports/[id]/enroll — запись session.userId в секцию.
 * Одна транзакция: освободить место в прежней секции, занять в новой (enrolledCount < capacity), upsert записи, уведомление.
 */
export const POST = route<Ctx>(async (_req, { params }) => {
  const session = await requireRole('STUDENT');
  const { id } = await params;

  const section = await prisma.sportSection.findUnique({ where: { id } });
  if (!section) throw new HttpError(404, 'Секция не найдена');

  try {
    const { previous } = await prisma.$transaction(async (tx) => {
      const current = await tx.sportEnrollment.findUnique({ where: { userId: session.userId } });
      if (current?.sectionId === id) throw new HttpError(409, `Вы уже записаны в секцию «${section.title}»`);

      const { count } = await tx.sportSection.updateMany({
        where: { id, enrolledCount: { lt: section.capacity } },
        data: { enrolledCount: { increment: 1 } },
      });
      if (!count) throw new HttpError(409, `В секции «${section.title}» нет свободных мест`);

      let previous: string | null = null;
      if (current) {
        await tx.sportSection.updateMany({
          where: { id: current.sectionId, enrolledCount: { gt: 0 } },
          data: { enrolledCount: { decrement: 1 } },
        });
        const old = await tx.sportSection.findUnique({ where: { id: current.sectionId }, select: { title: true } });
        previous = old?.title ?? null;
        await tx.sportEnrollment.update({ where: { userId: session.userId }, data: { sectionId: id, updatedAt: new Date() } });
      } else {
        await tx.sportEnrollment.create({ data: { userId: session.userId, sectionId: id } });
      }

      await tx.notification.create({
        data: {
          userId: session.userId,
          category: 'SCHEDULE',
          title: 'Запись на физкультуру подтверждена',
          message: `Секция «${section.title}»: ${section.scheduleText}, ${section.campusLocation}. Тренер — ${section.coachName}.${previous ? ` Место в секции «${previous}» освобождено.` : ''}`,
        },
      });
      return { previous };
    });

    const fresh = await prisma.sportSection.findUniqueOrThrow({ where: { id } });
    return json({ ok: true, currentSectionId: id, previousSection: previous, section: serializeSection(fresh, id) });
  } catch (e) {
    // Параллельная первая запись того же студента: уникальный userId в SportEnrollment, инкремент откатился.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new HttpError(409, 'Запись уже обрабатывается — обновите страницу');
    }
    throw e;
  }
});
