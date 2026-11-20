/**
 * Персональный контекст ИИ-ассистента. Собирается ТОЛЬКО из данных текущего пользователя сессии.
 */
import type { User } from '@prisma/client';
import { prisma } from '../prisma';
import { syncOverdue } from '../study';
import { averageTotal, findNextClass } from '../domain';
import { serializeAssignment, serializeGrade, serializeLesson, serializeMaterial, serializeRequest } from '../serializers';

export type GradeView = ReturnType<typeof serializeGrade>;
export type AssignmentView = ReturnType<typeof serializeAssignment>;
export type RequestView = ReturnType<typeof serializeRequest>;
export type MaterialView = ReturnType<typeof serializeMaterial>;
export type LessonView = ReturnType<typeof serializeLesson>;

export interface StudentContext {
  user: Pick<User, 'fullName' | 'faculty' | 'program' | 'course' | 'groupName' | 'studyForm' | 'scholarshipStatus' | 'curatorName'>;
  grades: GradeView[];
  average: number | null;
  assignments: AssignmentView[];
  requests: RequestView[];
  nextClass: LessonView | null;
  rescheduled: LessonView[];
  materials: MaterialView[];
  /** Материал или задание, из которого открыт ассистент (по contextTitle). */
  focusMaterial: MaterialView | null;
  focusAssignment: AssignmentView | null;
}

const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();

export async function buildStudentContext(user: User, contextTitle?: string): Promise<StudentContext> {
  await syncOverdue(user.id);
  const [grades, assignments, requests, schedule, materials] = await Promise.all([
    prisma.subjectGrade.findMany({ where: { userId: user.id }, orderBy: { currentTotal: 'asc' } }),
    prisma.assignment.findMany({ where: { userId: user.id }, orderBy: { deadline: 'asc' } }),
    prisma.documentRequest.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } }),
    prisma.scheduleItem.findMany({ where: { groupName: user.groupName ?? '__none__' } }),
    prisma.studyMaterial.findMany({ where: { faculty: user.faculty ?? '__none__' } }),
  ]);

  const mats = materials.map(serializeMaterial);
  const asg = assignments.map((a) => serializeAssignment(a));
  const t = contextTitle ? norm(contextTitle) : '';
  const match = <T extends { title: string }>(xs: T[]) =>
    t ? (xs.find((x) => norm(x.title) === t) ?? xs.find((x) => norm(x.title).includes(t) || t.includes(norm(x.title))) ?? null) : null;

  const next = findNextClass(schedule);
  return {
    user: {
      fullName: user.fullName,
      faculty: user.faculty,
      program: user.program,
      course: user.course,
      groupName: user.groupName,
      studyForm: user.studyForm,
      scholarshipStatus: user.scholarshipStatus,
      curatorName: user.curatorName,
    },
    grades: grades.map(serializeGrade),
    average: averageTotal(grades.map((g) => g.currentTotal)),
    assignments: asg,
    requests: requests.map(serializeRequest),
    nextClass: next ? serializeLesson(next) : null,
    rescheduled: schedule.filter((s) => s.isRescheduled).map(serializeLesson),
    materials: mats,
    focusMaterial: match(mats),
    focusAssignment: match(asg),
  };
}

/** Компактное представление контекста для системного промпта LLM (без лишних полей и полного текста материалов). */
export function contextForLlm(ctx: StudentContext) {
  return {
    student: ctx.user,
    averageScore: ctx.average,
    grades: ctx.grades.map((g) => ({
      subject: g.subject,
      controlType: g.controlType,
      labs: `${g.labsScore}/${g.labsMax}`,
      midterm: `${g.midtermScore}/${g.midtermMax}`,
      attendance: `${g.attendanceScore}/${g.attendanceMax}`,
      total: g.currentTotal,
      pointsToAdmission: g.pointsToAdmission,
      pointsToExcellent: g.pointsToExcellent,
    })),
    assignments: ctx.assignments.map((a) => ({
      subject: a.subject,
      title: a.title,
      deadline: a.deadline,
      hoursLeft: a.hoursLeft,
      brsWeight: a.brsWeight,
      status: a.status,
      author: a.authorName,
      taskPrompt: a.taskPrompt ? a.taskPrompt.slice(0, 1500) : undefined,
      gradeAwarded: a.gradeAwarded,
      teacherFeedback: a.teacherFeedback,
    })),
    requests: ctx.requests.map((r) => ({ type: r.typeLabel, status: r.statusLabel, registryNumber: r.registryNumber, adminComment: r.adminComment })),
    nextClass: ctx.nextClass,
    rescheduled: ctx.rescheduled.map((l) => `${l.subject}: ${l.oldRoom} → ${l.room}`),
    materials: ctx.materials.map((m) => `${m.subject} — ${m.title} (${m.categoryLabel})`),
    focus: ctx.focusMaterial
      ? { material: ctx.focusMaterial.title, content: ctx.focusMaterial.contentMarkdown.slice(0, 4000) }
      : ctx.focusAssignment
        ? { assignment: ctx.focusAssignment }
        : null,
  };
}
