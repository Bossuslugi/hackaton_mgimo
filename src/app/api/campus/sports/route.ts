import { prisma } from '@/lib/prisma';
import { json, route } from '@/lib/http';
import { requireSession } from '@/lib/session';
import { SPORT_TYPES, serializeSection } from '@/lib/events';

/** GET /api/campus/sports — каталог секций, текущая секция и прогресс по физкультуре session.userId. */
export const GET = route(async () => {
  const { user } = await requireSession();
  const [sections, enrollment] = await Promise.all([
    prisma.sportSection.findMany(),
    prisma.sportEnrollment.findUnique({ where: { userId: user.id } }),
  ]);
  const currentSectionId = enrollment?.sectionId ?? null;
  const order = (t: string) => (SPORT_TYPES as readonly string[]).indexOf(t);
  return json({
    sections: sections.sort((a, b) => order(a.sportType) - order(b.sportType)).map((s) => serializeSection(s, currentSectionId)),
    currentSectionId,
    enrolledAt: enrollment?.updatedAt.toISOString() ?? null,
    peCurrentPoints: user.peCurrentPoints,
    peTargetPoints: user.peTargetPoints,
    peProgressPercent: user.peTargetPoints ? Math.min(100, Math.round((user.peCurrentPoints / user.peTargetPoints) * 100)) : 0,
    canEnroll: user.role === 'STUDENT',
  });
});
