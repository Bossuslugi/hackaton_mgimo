import { prisma } from '@/lib/prisma';
import { json, route } from '@/lib/http';
import { requireRole } from '@/lib/session';
import { serializeGrade } from '@/lib/serializers';
import { BRS, averageTotal } from '@/lib/domain';

export const GET = route(async () => {
  const { user } = await requireRole('STUDENT');
  const rows = await prisma.subjectGrade.findMany({ where: { userId: user.id }, orderBy: { subject: 'asc' } });
  const subjects = rows.map(serializeGrade);
  return json({
    subjects,
    scholarshipStatus: user.scholarshipStatus,
    averageScore: averageTotal(rows.map((r) => r.currentTotal)),
    thresholds: { admission: BRS.ADMISSION, satisfactory: BRS.SATISFACTORY, good: BRS.GOOD, excellent: BRS.EXCELLENT },
  });
});
