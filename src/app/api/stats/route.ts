import type { ScheduleItem } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { json, route } from '@/lib/http';
import { requireSession } from '@/lib/session';
import { LESSON_HOURS, WEEKDAY_SHORT, averageTotal, moscowDate } from '@/lib/domain';
import { scheduleTeacherName } from '@/lib/people';

const round1 = (x: number) => Math.round(x * 10) / 10;

/**
 * GET /api/stats — время в вузе и учебная аналитика текущего пользователя.
 * Считается только по данным session.userId (и его группе для рейтинга).
 */
export const GET = route(async () => {
  const session = await requireSession();
  const { user } = session;
  const isStudent = session.role === 'STUDENT';

  const schedule: ScheduleItem[] = isStudent
    ? await prisma.scheduleItem.findMany({ where: { groupName: user.groupName ?? '__none__' } })
    : session.role === 'TEACHER'
      ? await prisma.scheduleItem.findMany({ where: { teacher: scheduleTeacherName(user) } })
      : [];

  // Брони за текущую неделю (±3 дня от сегодня) — время в коворкингах и переговорных.
  const bookings = await prisma.roomBooking.findMany({
    where: { userId: user.id, status: 'CONFIRMED', date: { gte: moscowDate(-3), lte: moscowDate(3) } },
  });

  const week = user.campusHoursWeek;
  const classHoursByDay = Array.from({ length: 7 }, (_, i) =>
    schedule.filter((s) => s.dayOfWeek === i + 1).length * LESSON_HOURS,
  );
  const classTotal = classHoursByDay.reduce((a, b) => a + b, 0);

  // Время в кампусе по дням: занятия + остаток недели пропорционально учебной нагрузке дня.
  const extra = Math.max(0, week - classTotal);
  const activeDays = classHoursByDay.filter((h) => h > 0).length || 5;
  let campusByDay = classHoursByDay.map((h, i) =>
    classTotal > 0 ? h + (h > 0 ? (extra * h) / classTotal : 0) : i < activeDays ? week / activeDays : 0,
  );
  campusByDay = campusByDay.map((h) => Math.round(h * 2) / 2);
  const drift = round1(week - campusByDay.reduce((a, b) => a + b, 0));
  const busiest = campusByDay.indexOf(Math.max(...campusByDay));
  if (busiest >= 0) campusByDay[busiest] = round1(campusByDay[busiest] + drift);

  const weeklyActivity = WEEKDAY_SHORT.map((day, i) => ({
    day,
    dayOfWeek: i + 1,
    campusHours: campusByDay[i],
    studyHours: classHoursByDay[i],
  }));

  // Структура недели.
  const byType = (t: string) => schedule.filter((s) => s.type === t).length * LESSON_HOURS;
  const bookingHours = Math.min(extra, bookings.length * LESSON_HOURS);
  const rest = Math.max(0, extra - bookingHours);
  const parts: [string, number][] = [
    ['Лекции', byType('Лекция')],
    ['Практики', byType('Практика')],
    ['Лабораторные', byType('Лабораторная')],
    ['Бронирования помещений', bookingHours],
    [isStudent ? 'Самостоятельная работа в кампусе' : 'Методическая работа и консультации', round1(rest * 0.65)],
    ['Перерывы и питание', round1(rest * 0.35)],
  ];
  const sum = parts.reduce((a, [, h]) => a + h, 0) || 1;
  const timeBreakdown = parts
    .filter(([, h]) => h > 0)
    .map(([category, hours]) => ({ category, hours: round1(hours), percent: Math.round((hours / sum) * 100) }));
  const pctDrift = 100 - timeBreakdown.reduce((a, p) => a + p.percent, 0);
  if (timeBreakdown.length && pctDrift !== 0) {
    const top = timeBreakdown.reduce((m, p) => (p.hours > m.hours ? p : m), timeBreakdown[0]);
    top.percent += pctDrift;
  }

  let attendancePercent: number | null = null;
  let avgBrs: number | null = null;
  let rankInGroup: number | null = null;
  let groupSize: number | null = null;

  if (isStudent) {
    const grades = await prisma.subjectGrade.findMany({ where: { userId: user.id } });
    const attMax = grades.reduce((a, g) => a + g.attendanceMax, 0);
    attendancePercent = attMax ? Math.round((grades.reduce((a, g) => a + g.attendanceScore, 0) / attMax) * 100) : null;
    avgBrs = averageTotal(grades.map((g) => g.currentTotal));

    if (user.groupName) {
      const groupGrades = await prisma.subjectGrade.findMany({
        where: { user: { groupName: user.groupName, role: 'STUDENT' } },
        select: { userId: true, currentTotal: true },
      });
      const byUser = new Map<string, number[]>();
      for (const g of groupGrades) byUser.set(g.userId, [...(byUser.get(g.userId) ?? []), g.currentTotal]);
      const averages = [...byUser.entries()].map(([id, xs]) => ({ id, avg: averageTotal(xs) ?? 0 }));
      groupSize = await prisma.user.count({ where: { role: 'STUDENT', groupName: user.groupName } });
      const mine = averages.find((a) => a.id === user.id)?.avg ?? 0;
      rankInGroup = averages.filter((a) => a.avg > mine).length + 1;
    }
  }

  return json({
    role: session.role,
    campusHoursWeek: week,
    campusHoursSemester: user.campusHoursSemester,
    classHoursWeek: classTotal,
    attendancePercent,
    avgBrs,
    rankInGroup,
    groupSize,
    weeklyActivity,
    timeBreakdown,
  });
});
