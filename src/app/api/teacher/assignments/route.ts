import { prisma } from '@/lib/prisma';
import { HttpError, json, parseBody, route } from '@/lib/http';
import { requireRole } from '@/lib/session';
import { createTeacherAssignmentSchema } from '@/lib/validation';
import { serializeAssignment } from '@/lib/serializers';
import { authorLabel, effectiveAssignmentStatus } from '@/lib/domain';
import { teachingLoad } from '@/lib/people';

const include = {
  material: { select: { id: true, title: true, category: true } },
  user: { select: { id: true, fullName: true, groupName: true } },
} as const;

/**
 * GET /api/teacher/assignments — выданные задания со сданными решениями.
 * TEACHER видит только строки, где authorId = session.userId; ADMIN — все задания с автором.
 */
export const GET = route(async () => {
  const session = await requireRole('TEACHER', 'ADMIN');
  const where = session.role === 'TEACHER' ? { authorId: session.userId } : { authorId: { not: null } };
  const [rows, load] = await Promise.all([
    prisma.assignment.findMany({ where, include, orderBy: [{ deadline: 'desc' }, { title: 'asc' }] }),
    session.role === 'TEACHER' ? teachingLoad(session.user) : Promise.resolve({ groups: [], subjects: [] }),
  ]);

  const assignments = rows.map((a) => serializeAssignment(a));
  const summary = { total: assignments.length, TODO: 0, SUBMITTED: 0, GRADED: 0, OVERDUE: 0 };
  for (const a of assignments) summary[a.status] += 1;

  return json({
    assignments,
    summary,
    toReview: assignments.filter((a) => a.status === 'SUBMITTED').length,
    groups: load.groups,
    subjects: load.subjects,
  });
});

/**
 * POST /api/teacher/assignments — новое онлайн-ДЗ для всех студентов группы + уведомления DEADLINE.
 * TEACHER может выдать задание только группе, которую ведёт по расписанию.
 */
export const POST = route(async (req) => {
  const session = await requireRole('TEACHER', 'ADMIN');
  const body = await parseBody(req, createTeacherAssignmentSchema);

  if (session.role === 'TEACHER') {
    const load = await teachingLoad(session.user);
    if (!load.groups.includes(body.groupName)) {
      throw new HttpError(403, `Доступ запрещён: вы не ведёте занятия у группы ${body.groupName}`);
    }
  }

  const students = await prisma.user.findMany({ where: { role: 'STUDENT', groupName: body.groupName }, select: { id: true } });
  if (!students.length) throw new HttpError(404, `В группе ${body.groupName} нет студентов`);

  if (body.materialId) {
    const material = await prisma.studyMaterial.findUnique({ where: { id: body.materialId }, select: { id: true } });
    if (!material) throw new HttpError(400, 'Методичка не найдена');
  }

  const authorName = authorLabel(session.user.fullName, session.user.position);
  const created = await prisma.$transaction(async (tx) => {
    const rows = [];
    for (const s of students) {
      rows.push(
        await tx.assignment.create({
          data: {
            userId: s.id,
            authorId: session.userId, // автор — только из сессии
            authorName,
            groupName: body.groupName,
            subject: body.subject,
            title: body.title,
            description: body.description || body.title,
            taskPrompt: body.taskPrompt,
            starterTemplate: body.starterTemplate ?? null,
            materialId: body.materialId ?? null,
            deadline: body.deadline,
            brsWeight: body.brsWeight,
            status: 'TODO',
          },
          include,
        }),
      );
    }
    await tx.notification.createMany({
      data: students.map((s) => ({
        userId: s.id,
        category: 'DEADLINE',
        title: 'Новое онлайн-задание',
        message: `${authorName}: «${body.title}» по дисциплине «${body.subject}» — ${body.brsWeight} б. БРС, срок до ${formatDeadline(body.deadline)}.`,
      })),
    });
    return rows;
  });

  return json(
    {
      ok: true,
      groupName: body.groupName,
      recipients: created.length,
      assignments: created.map((a) => ({ ...serializeAssignment(a), status: effectiveAssignmentStatus(a.status, a.deadline) })),
    },
    201,
  );
});

function formatDeadline(iso: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}
