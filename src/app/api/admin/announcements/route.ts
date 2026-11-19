import { prisma } from '@/lib/prisma';
import { HttpError, json, parseBody, route } from '@/lib/http';
import { requireRole } from '@/lib/session';
import { announcementSchema } from '@/lib/validation';
import { serializeLesson } from '@/lib/serializers';

/**
 * Рассылка объявления студентам (всем или одной группе).
 * При rescheduleSubject + newRoom переносит занятия дисциплины: oldRoom ← room, room ← newRoom, isRescheduled = true.
 */
export const POST = route(async (req) => {
  await requireRole('ADMIN');
  const { title, message, targetGroup, rescheduleSubject, newRoom, urgent } = await parseBody(req, announcementSchema);

  const students = await prisma.user.findMany({
    where: { role: 'STUDENT', ...(targetGroup ? { groupName: targetGroup } : {}) },
    select: { id: true },
  });
  if (targetGroup && students.length === 0) {
    throw new HttpError(404, `Группа ${targetGroup} не найдена`);
  }

  const result = await prisma.$transaction(async (tx) => {
    let rescheduled: Awaited<ReturnType<typeof tx.scheduleItem.update>>[] = [];
    if (rescheduleSubject && newRoom) {
      const lessons = await tx.scheduleItem.findMany({
        where: { subject: rescheduleSubject, ...(targetGroup ? { groupName: targetGroup } : {}) },
      });
      if (!lessons.length) {
        throw new HttpError(404, `Занятия по дисциплине «${rescheduleSubject}»${targetGroup ? ` у группы ${targetGroup}` : ''} не найдены`);
      }
      rescheduled = await Promise.all(
        lessons.map((l) =>
          tx.scheduleItem.update({
            where: { id: l.id },
            data: { oldRoom: l.room === newRoom ? l.oldRoom : l.room, room: newRoom, isRescheduled: true },
          }),
        ),
      );
    }

    const isSchedule = rescheduled.length > 0;
    const now = new Date();
    if (students.length) {
      await tx.notification.createMany({
        data: students.map((s) => ({
          userId: s.id,
          category: isSchedule ? 'SCHEDULE' : 'DEAN',
          title,
          message: message!,
          isCritical: urgent,
          createdAt: now,
        })),
      });
    }
    return { rescheduled, isSchedule, now };
  });

  return json(
    {
      ok: true,
      recipients: students.length,
      announcement: {
        id: `ann-${result.now.getTime()}`,
        type: result.isSchedule ? 'ROOM_CHANGE' : urgent ? 'URGENT' : 'INFO',
        title,
        message,
        body: message,
        targetGroup: targetGroup ?? null,
        group: targetGroup ?? null,
        createdAt: result.now.toISOString(),
      },
      rescheduled: result.rescheduled.map(serializeLesson),
    },
    201,
  );
});
