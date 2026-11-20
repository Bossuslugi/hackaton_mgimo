import { prisma } from '@/lib/prisma';
import { json, route } from '@/lib/http';
import { requireSession } from '@/lib/session';
import { syncOverdue } from '@/lib/study';
import { ACTIVE_REQUEST_STATUSES, BRS, REQUEST_STATUSES, averageTotal, findNextClass } from '@/lib/domain';
import {
  requestOwnerSelect,
  serializeAssignment,
  serializeGrade,
  serializeLesson,
  serializeNotification,
  serializeRequest,
  serializeUser,
} from '@/lib/serializers';
import { scheduleTeacherName } from '@/lib/people';

export const GET = route(async () => {
  const session = await requireSession();
  const { user } = session;

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 10 }),
    prisma.notification.count({ where: { userId: user.id, isRead: false } }),
  ]);
  const announcements = notifications.map(serializeNotification);

  if (session.role === 'TEACHER') {
    const [schedule, authored, unreadMessages] = await Promise.all([
      prisma.scheduleItem.findMany({ where: { teacher: scheduleTeacherName(user) } }),
      prisma.assignment.findMany({
        where: { authorId: user.id },
        include: { user: { select: { id: true, fullName: true, groupName: true } } },
        orderBy: { submittedAt: 'desc' },
      }),
      prisma.directMessage.count({ where: { receiverId: user.id, isRead: false } }),
    ]);
    const next = findNextClass(schedule);
    const nextClass = next ? serializeLesson(next) : null;
    const submitted = authored.filter((a) => a.status === 'SUBMITTED');
    return json({
      role: 'TEACHER',
      user: serializeUser(user),
      nextClass,
      nextLesson: nextClass,
      stats: {
        toReview: submitted.length,
        graded: authored.filter((a) => a.status === 'GRADED').length,
        assignmentsIssued: authored.length,
        groups: [...new Set(schedule.map((s) => s.groupName))].sort(),
        unreadMessages,
      },
      recentSubmissions: submitted.slice(0, 5).map((a) => serializeAssignment(a)),
      unreadCount,
      announcements,
    });
  }

  if (session.role === 'ADMIN') {
    const dayAgo = new Date(Date.now() - 24 * 3600 * 1000);
    const [byStatusRaw, total, newLast24h, students, atRisk, recent] = await Promise.all([
      prisma.documentRequest.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.documentRequest.count(),
      prisma.documentRequest.count({ where: { createdAt: { gte: dayAgo } } }),
      prisma.user.count({ where: { role: 'STUDENT' } }),
      prisma.subjectGrade.findMany({ where: { currentTotal: { lt: BRS.ADMISSION } }, distinct: ['userId'], select: { userId: true } }),
      prisma.documentRequest.findMany({ orderBy: { createdAt: 'desc' }, take: 5, include: { user: { select: requestOwnerSelect } } }),
    ]);
    const byStatus = Object.fromEntries(REQUEST_STATUSES.map((s) => [s, 0])) as Record<string, number>;
    for (const row of byStatusRaw) byStatus[row.status] = row._count._all;
    return json({
      role: 'ADMIN',
      user: serializeUser(user),
      stats: {
        totalRequests: total,
        byStatus,
        activeRequests: byStatus.NEW + byStatus.IN_REVIEW,
        newLast24h,
        students,
        studentsAtRisk: atRisk.length,
      },
      recentRequests: recent.map(serializeRequest),
      unreadCount,
      announcements,
    });
  }

  await syncOverdue(user.id);
  const [schedule, assignments, requests, grades] = await Promise.all([
    prisma.scheduleItem.findMany({ where: { groupName: user.groupName ?? '__none__' } }),
    prisma.assignment.findMany({ where: { userId: user.id, status: { in: ['TODO', 'OVERDUE'] } }, orderBy: { deadline: 'asc' } }),
    prisma.documentRequest.findMany({
      where: { userId: user.id, status: { in: ACTIVE_REQUEST_STATUSES } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.subjectGrade.findMany({ where: { userId: user.id } }),
  ]);

  const next = findNextClass(schedule);
  const nextClass = next ? serializeLesson(next) : null;
  const urgentAssignments = assignments.slice(0, 5).map((a) => serializeAssignment(a));
  const activeRequests = requests.map(serializeRequest);
  const avgGrade = averageTotal(grades.map((g) => g.currentTotal));
  const atRisk = grades.filter((g) => g.currentTotal < BRS.ADMISSION).map(serializeGrade);

  return json({
    role: 'STUDENT',
    user: serializeUser(user),
    nextClass,
    urgentAssignments,
    activeRequests,
    avgGrade,
    unreadCount,
    scholarshipStatus: user.scholarshipStatus,
    subjectsAtRisk: atRisk,
    // алиасы для фронтенда (src/lib/normalize.ts → toDashboard)
    nextLesson: nextClass,
    deadlines: urgentAssignments,
    activeRequest: activeRequests[0] ?? null,
    averageScore: avgGrade,
    announcements,
  });
});
