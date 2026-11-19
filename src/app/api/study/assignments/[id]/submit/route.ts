import { prisma } from '@/lib/prisma';
import { HttpError, json, parseBody, route } from '@/lib/http';
import { requireRole } from '@/lib/session';
import { submitAssignmentSchema } from '@/lib/validation';
import { serializeAssignment } from '@/lib/serializers';
import { effectiveAssignmentStatus } from '@/lib/domain';

type Ctx = { params: Promise<{ id: string }> };

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

  const updated = await prisma.assignment.update({
    where: { id: assignment.id },
    data: {
      status: 'SUBMITTED',
      submissionUrl: body.submissionUrl,
      studentComment: body.studentComment ?? null,
      submittedAt: new Date(),
    },
  });

  return json({
    assignment: serializeAssignment(updated),
    late: current === 'OVERDUE',
  });
});
