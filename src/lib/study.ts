import { prisma } from './prisma';

/** Переводит просроченные TODO-задания пользователя в OVERDUE (дедлайны хранятся в ISO-8601 UTC). */
export async function syncOverdue(userId: string, now = new Date()) {
  await prisma.assignment.updateMany({
    where: { userId, status: 'TODO', deadline: { lt: now.toISOString() } },
    data: { status: 'OVERDUE' },
  });
}
