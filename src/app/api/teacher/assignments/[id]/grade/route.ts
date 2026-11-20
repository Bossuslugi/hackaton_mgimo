import { prisma } from '@/lib/prisma';
import { HttpError, json, parseBody, route } from '@/lib/http';
import { requireRole } from '@/lib/session';
import { gradeSchema } from '@/lib/validation';
import { serializeAssignment } from '@/lib/serializers';
import { authorLabel, computeTotal } from '@/lib/domain';

type Ctx = { params: Promise<{ id: string }> };

const include = {
  material: { select: { id: true, title: true, category: true } },
  user: { select: { id: true, fullName: true, groupName: true } },
} as const;

/**
 * PATCH /api/teacher/assignments/[id]/grade — оценка решения.
 * TEACHER оценивает только свои задания (authorId), иначе 403 (несуществующее — тоже 403).
 * Балл учитывается в БРС (labsScore дисциплины, по разнице при переоценке) в одной транзакции.
 */
export const PATCH = route<Ctx>(async (req, { params }) => {
  const session = await requireRole('TEACHER', 'ADMIN');
  const { id } = await params;
  const { gradeAwarded, teacherFeedback } = await parseBody(req, gradeSchema);

  const assignment = await prisma.assignment.findUnique({ where: { id } });
  if (session.role === 'TEACHER' && (!assignment || assignment.authorId !== session.userId)) {
    console.warn(`[security] IDOR blocked: teacher=${session.userId} tried grade assignment=${id}`);
    throw new HttpError(403, 'Доступ запрещён: задание выдано другим преподавателем (IDOR protection)');
  }
  if (!assignment) throw new HttpError(404, 'Задание не найдено');
  if (assignment.status !== 'SUBMITTED' && assignment.status !== 'GRADED') {
    throw new HttpError(409, 'Оценить можно только сданное решение');
  }
  if (gradeAwarded > assignment.brsWeight) {
    throw new HttpError(400, `Балл не может превышать вес задания (${assignment.brsWeight})`);
  }

  const delta = gradeAwarded - (assignment.gradeAwarded ?? 0);
  const grader = authorLabel(session.user.fullName, session.user.position);

  const { updated, brs } = await prisma.$transaction(async (tx) => {
    const updated = await tx.assignment.update({
      where: { id: assignment.id },
      data: { status: 'GRADED', gradeAwarded, score: gradeAwarded, teacherFeedback: teacherFeedback ?? null },
      include,
    });

    let brs: { subject: string; labsScore: number; currentTotal: number } | null = null;
    const grade = await tx.subjectGrade.findUnique({
      where: { userId_subject: { userId: assignment.userId, subject: assignment.subject } },
    });
    if (grade && delta !== 0) {
      const labsScore = Math.max(0, Math.min(grade.labsMax, grade.labsScore + delta));
      const currentTotal = computeTotal({ labsScore, midtermScore: grade.midtermScore, attendanceScore: grade.attendanceScore });
      await tx.subjectGrade.update({ where: { id: grade.id }, data: { labsScore, currentTotal } });
      brs = { subject: grade.subject, labsScore, currentTotal };
    } else if (grade) {
      brs = { subject: grade.subject, labsScore: grade.labsScore, currentTotal: grade.currentTotal };
    }

    await tx.notification.create({
      data: {
        userId: assignment.userId,
        category: 'GRADE',
        title: `Оценка: ${assignment.title}`,
        message: `${grader} поставил ${gradeAwarded} из ${assignment.brsWeight}.${teacherFeedback ? ` Комментарий: ${teacherFeedback}` : ''}${brs ? ` Балл БРС по дисциплине: ${brs.currentTotal}.` : ''}`,
      },
    });
    return { updated, brs };
  });

  return json({ assignment: serializeAssignment(updated), brs });
});
