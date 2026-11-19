import { prisma } from '@/lib/prisma';
import { json, route } from '@/lib/http';
import { requireSession } from '@/lib/session';
import { syncOverdue } from '@/lib/study';
import { serializeAssignment, serializeMaterial } from '@/lib/serializers';

export const GET = route(async () => {
  const session = await requireSession();
  const { user } = session;

  if (session.role === 'ADMIN') {
    const materials = await prisma.studyMaterial.findMany({ orderBy: [{ faculty: 'asc' }, { subject: 'asc' }] });
    return json({ assignments: [], materials: materials.map(serializeMaterial) });
  }

  await syncOverdue(user.id);
  const [assignments, materials] = await Promise.all([
    prisma.assignment.findMany({ where: { userId: user.id }, orderBy: { deadline: 'asc' } }),
    prisma.studyMaterial.findMany({ where: { faculty: user.faculty ?? '__none__' }, orderBy: { subject: 'asc' } }),
  ]);
  return json({
    assignments: assignments.map((a) => serializeAssignment(a)),
    materials: materials.map(serializeMaterial),
  });
});
