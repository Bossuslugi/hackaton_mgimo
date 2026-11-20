import { prisma } from '@/lib/prisma';
import { HttpError, json, parseBody, route } from '@/lib/http';
import { requireRole } from '@/lib/session';
import { submitAssignmentSchema } from '@/lib/validation';
import { assignmentInclude, serializeAssignment } from '@/lib/serializers';
import { effectiveAssignmentStatus, shortName } from '@/lib/domain';

type Ctx = { params: Promise<{ id: string }> };

/**
 * Сдача задания: ссылка (V1) и/или решение, написанное на сайте (V2).
 * Проверка владельца: assignment.userId === session.userId, иначе 403.
 */
export const POST = route<Ctx>(async (req, { params }) => {
  const session = await requireRole('STUDENT');
  const { id } = await params;
  const body = await parseBody(req, submitAssignmentSchema);

  const assignment = await prisma.assignment.findUnique({ where: { id } });
  // Чужое и несуществующее задание неразличимы для студента — без оракула перечисления.
  if (!assignment || assignment.userId !== session.userId) {
    console.warn(`[security] IDOR blocked: user=${session.userId} tried assignment=${id}`);
    throw new HttpError(403, 'Доступ запрещён: задание принадлежит другому студенту (IDOR protection)');
  }

  const current = effectiveAssignmentStatus(assignment.status, assignment.deadline);
  if (current === 'GRADED') {
    throw new HttpError(409, 'Задание уже оценено — повторная сдача невозможна');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const a = await tx.assignment.update({
      where: { id: assignment.id },
      data: {
        status: 'SUBMITTED',
        // Повторная сдача заменяет переданные поля и сохраняет непереданные.
        submissionUrl: body.submissionUrl ?? assignment.submissionUrl,
        solutionText: body.solutionText ?? assignment.solutionText,
        studentComment: body.studentComment ?? null,
        submittedAt: new Date(),
      },
      include: assignmentInclude,
    });
    if (assignment.authorId) {
      await tx.notification.create({
        data: {
          userId: assignment.authorId,
          category: 'DEADLINE',
          title: 'Новое решение на проверке',
          message: `${shortName(session.user.fullName)} (${session.user.groupName ?? '—'}) сдал «${assignment.title}»${current === 'OVERDUE' ? ' после дедлайна' : ''}.`,
        },
      });
    }
    return a;
  });

  return json({
    assignment: serializeAssignment(updated),
    late: current === 'OVERDUE',
  });
});
