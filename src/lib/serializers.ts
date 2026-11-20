/**
 * Сериализация сущностей в ответы API по белому списку полей.
 * passwordHash и прочие внутренние поля никогда не попадают в ответ.
 *
 * Помимо полей контракта (specs/04_API_CONTRACT.md) отдаются совместимые алиасы,
 * которые ожидает фронтенд (src/lib/normalize.ts): group, points, rk, total и т.п.
 */
import type {
  Assignment,
  DirectMessage,
  DocumentRequest,
  Notification,
  RoomBooking,
  ScheduleItem,
  StudyMaterial,
  SubjectGrade,
  User,
} from '@prisma/client';
import {
  REQUEST_SLA_DAYS,
  REQUEST_STATUS_LABELS,
  REQUEST_TYPE_LABELS,
  effectiveAssignmentStatus,
  formatLocation,
  gradeLabel,
  hasDebt,
  pointsToAdmission,
  pointsToExcellent,
  type RequestStatus,
  type RequestType,
} from './domain';

export function serializeUser(u: User) {
  return {
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    role: u.role,
    faculty: u.faculty,
    program: u.program,
    course: u.course,
    groupName: u.groupName,
    group: u.groupName,
    studyForm: u.studyForm,
    funding: u.studyForm,
    studentCardNumber: u.studentCardNumber,
    curatorName: u.curatorName,
    scholarshipStatus: u.scholarshipStatus,
    position: u.position,
    // V2
    department: u.department,
    campusHoursWeek: u.campusHoursWeek,
    campusHoursSemester: u.campusHoursSemester,
  };
}

/** Публичная карточка пользователя для мессенджера и списков — без email и учебных данных. */
export function serializeContact(u: Pick<User, 'id' | 'fullName' | 'role' | 'groupName' | 'department' | 'position'>) {
  return {
    id: u.id,
    fullName: u.fullName,
    role: u.role,
    groupName: u.groupName,
    department: u.department,
    position: u.position,
  };
}

const LESSON_TYPE_CODE: Record<string, string> = {
  Лекция: 'LECTURE',
  Практика: 'PRACTICE',
  Лабораторная: 'LAB',
};

export function serializeLesson(s: ScheduleItem) {
  return {
    id: s.id,
    groupName: s.groupName,
    dayOfWeek: s.dayOfWeek,
    startTime: s.startTime,
    endTime: s.endTime,
    subject: s.subject,
    type: LESSON_TYPE_CODE[s.type] ?? 'OTHER',
    typeLabel: s.type,
    building: s.building,
    room: s.room,
    oldRoom: s.oldRoom,
    location: formatLocation(s.building, s.room),
    teacher: s.teacher,
    isRescheduled: s.isRescheduled,
  };
}

export function serializeGrade(g: SubjectGrade) {
  return {
    id: g.id,
    subject: g.subject,
    name: g.subject,
    teacher: g.teacher,
    controlType: g.controlType,
    labsScore: g.labsScore,
    labsMax: g.labsMax,
    midtermScore: g.midtermScore,
    midtermMax: g.midtermMax,
    attendanceScore: g.attendanceScore,
    attendanceMax: g.attendanceMax,
    examMax: g.examMax,
    currentTotal: g.currentTotal,
    // вычисляемые поля (PRD §3.4)
    grade: gradeLabel(g.currentTotal),
    hasDebt: hasDebt(g.currentTotal),
    pointsToAdmission: pointsToAdmission(g.currentTotal),
    pointsToExcellent: pointsToExcellent(g.currentTotal),
    // алиасы для фронтенда
    labs: g.labsScore,
    rk: g.midtermScore,
    rkMax: g.midtermMax,
    attendance: g.attendanceScore,
    total: g.currentTotal,
  };
}

type AssignmentRow = Assignment & {
  material?: Pick<StudyMaterial, 'id' | 'title' | 'category'> | null;
  user?: Pick<User, 'id' | 'fullName' | 'groupName'> | null;
};

export function serializeAssignment(a: AssignmentRow, now = Date.now()) {
  const status = effectiveAssignmentStatus(a.status, a.deadline, now);
  return {
    id: a.id,
    subject: a.subject,
    title: a.title,
    description: a.description,
    deadline: a.deadline,
    brsWeight: a.brsWeight,
    status,
    submissionUrl: a.submissionUrl,
    studentComment: a.studentComment,
    submittedAt: a.submittedAt?.toISOString() ?? null,
    score: a.score,
    hoursLeft: Math.round((new Date(a.deadline).getTime() - now) / 36e5),
    // V2: онлайн-ДЗ
    groupName: a.groupName,
    authorName: a.authorName,
    taskPrompt: a.taskPrompt,
    starterTemplate: a.starterTemplate,
    solutionText: a.solutionText,
    gradeAwarded: a.gradeAwarded,
    teacherFeedback: a.teacherFeedback,
    material: a.material
      ? { id: a.material.id, title: a.material.title, category: MATERIAL_CATEGORY_CODE[a.material.category] ?? 'NOTES' }
      : null,
    ...(a.user ? { student: { id: a.user.id, fullName: a.user.fullName, groupName: a.user.groupName } } : {}),
    // алиасы для фронтенда
    points: a.brsWeight,
    submissionLink: a.submissionUrl,
  };
}

export const assignmentInclude = { material: { select: { id: true, title: true, category: true } } } as const;

const MATERIAL_CATEGORY_CODE: Record<string, string> = {
  Конспект: 'NOTES',
  'Шпаргалка к РК': 'CHEATSHEET',
  Билеты: 'TICKETS',
  'Шаблон лабы': 'LAB_TEMPLATE',
};

export function serializeMaterial(m: StudyMaterial) {
  return {
    id: m.id,
    faculty: m.faculty,
    subject: m.subject,
    title: m.title,
    category: MATERIAL_CATEGORY_CODE[m.category] ?? 'NOTES',
    categoryLabel: m.category,
    readTimeMinutes: m.readTimeMinutes,
    readingMinutes: m.readTimeMinutes,
    contentMarkdown: m.contentMarkdown,
    updatedAt: m.updatedAt.toISOString(),
  };
}

type RequestWithUser = DocumentRequest & { user?: Pick<User, 'id' | 'email' | 'fullName' | 'groupName' | 'faculty'> | null };

export function serializeRequest(r: RequestWithUser) {
  const approved = r.status === 'APPROVED';
  const owner = r.user
    ? { id: r.user.id, email: r.user.email, fullName: r.user.fullName, groupName: r.user.groupName, group: r.user.groupName, faculty: r.user.faculty }
    : undefined;
  return {
    id: r.id,
    type: r.type,
    typeLabel: REQUEST_TYPE_LABELS[r.type as RequestType] ?? r.type,
    status: r.status,
    statusLabel: REQUEST_STATUS_LABELS[r.status as RequestStatus] ?? r.status,
    comment: r.comment,
    adminComment: r.adminComment,
    registryNumber: r.registryNumber,
    reviewedBy: r.reviewedBy,
    signedBy: approved ? r.reviewedBy : null,
    signedAt: approved ? r.updatedAt.toISOString() : null,
    slaDays: REQUEST_SLA_DAYS[r.type as RequestType] ?? null,
    payloadJson: r.payloadJson,
    payload: parsePayload(r.payloadJson),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    ...(owner ? { user: owner, student: owner } : {}),
  };
}

const ANNOUNCEMENT_TYPE: Record<string, string> = {
  DEAN: 'URGENT',
  SCHEDULE: 'ROOM_CHANGE',
  DEADLINE: 'INFO',
  REQUEST: 'INFO',
};

export function serializeNotification(n: Notification) {
  return {
    id: n.id,
    category: n.category,
    title: n.title,
    message: n.message,
    isRead: n.isRead,
    isCritical: n.isCritical,
    createdAt: n.createdAt.toISOString(),
    // алиасы для ленты объявлений фронтенда
    type: n.isCritical ? 'URGENT' : (ANNOUNCEMENT_TYPE[n.category] ?? 'INFO'),
    body: n.message,
  };
}

function parsePayload(json: string | null): Record<string, unknown> | null {
  if (!json) return null;
  try {
    const v = JSON.parse(json);
    return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

// ───────────────────────── V2

/** Своя бронь — полностью; чужая — обезличенно (без userId и цели). */
export function serializeBooking(b: RoomBooking, viewerId: string) {
  const mine = b.userId === viewerId;
  return {
    id: mine ? b.id : undefined,
    roomName: b.roomName,
    building: b.building,
    date: b.date,
    timeSlot: b.timeSlot,
    participantsCount: b.participantsCount,
    status: b.status,
    isMine: mine,
    ...(mine ? { purpose: b.purpose, createdAt: b.createdAt.toISOString() } : {}),
  };
}

export function serializeMessage(m: DirectMessage, viewerId: string) {
  return {
    id: m.id,
    senderId: m.senderId,
    receiverId: m.receiverId,
    content: m.content,
    isRead: m.isRead,
    mine: m.senderId === viewerId,
    createdAt: m.createdAt.toISOString(),
  };
}

/** Безопасная выборка владельца заявки для ADMIN-представлений. */
export const requestOwnerSelect = { id: true, email: true, fullName: true, groupName: true, faculty: true } as const;
