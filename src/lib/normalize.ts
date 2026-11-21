/**
 * Единственное место, где фронтенд знает о форме ответов бэкенда.
 * Каждая функция принимает «как пришло» и возвращает доменный тип из types.ts.
 * Если бэкенд переименует поле — правим только здесь.
 */
import type {
  Announcement,
  AnnouncementType,
  Assignment,
  AssignmentStatus,
  DashboardData,
  Lesson,
  LessonType,
  Material,
  MaterialCategory,
  RequestStatus,
  RequestType,
  Role,
  StudentRequest,
  SubjectGrade,
  User,
  ChatReply,
} from './types';

type Raw = Record<string, unknown>;

const isObj = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);

function pick(obj: Raw, ...keys: string[]): unknown {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null) return obj[k];
  }
  return undefined;
}

const str = (v: unknown, fallback = ''): string =>
  v === undefined || v === null ? fallback : String(v);

const optStr = (v: unknown): string | undefined =>
  v === undefined || v === null || v === '' ? undefined : String(v);

const num = (v: unknown, fallback = 0): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const dateStr = (v: unknown): string | undefined => {
  if (v === undefined || v === null || v === '') return undefined;
  if (v instanceof Date) return v.toISOString();
  return String(v);
};

/** Достаёт массив из `[...]`, `{ key: [...] }`, `{ data: [...] }`, `{ items: [...] }`. */
export function unwrapList(data: unknown, ...keys: string[]): unknown[] {
  if (Array.isArray(data)) return data;
  if (!isObj(data)) return [];
  for (const k of [...keys, 'data', 'items', 'results']) {
    const v = data[k];
    if (Array.isArray(v)) return v;
    if (isObj(v)) {
      const nested = unwrapList(v, ...keys);
      if (nested.length) return nested;
    }
  }
  return [];
}

/** Достаёт объект из `{ key: {...} }` / `{ data: {...} }` или возвращает сам объект. */
export function unwrapOne(data: unknown, ...keys: string[]): Raw | null {
  if (!isObj(data)) return null;
  for (const k of [...keys, 'data']) {
    if (isObj(data[k])) return data[k] as Raw;
  }
  return data;
}

// ───────────────────────── user

export function toUser(raw: unknown): User | null {
  const u = unwrapOne(raw, 'user');
  if (!u || !pick(u, 'id', 'email')) return null;
  const student = isObj(u.student) ? (u.student as Raw) : isObj(u.studentProfile) ? (u.studentProfile as Raw) : {};
  const role = str(pick(u, 'role'), 'STUDENT').toUpperCase();
  const first = optStr(pick(u, 'firstName'));
  const last = optStr(pick(u, 'lastName'));
  const middle = optStr(pick(u, 'middleName', 'patronymic'));
  const composed = [last, first, middle].filter(Boolean).join(' ');
  const groupRaw = pick(u, 'group', 'groupName') ?? pick(student, 'group', 'groupName');
  const group = isObj(groupRaw) ? optStr(pick(groupRaw, 'name', 'code')) : optStr(groupRaw);
  return {
    id: str(pick(u, 'id')),
    email: str(pick(u, 'email')),
    fullName: str(pick(u, 'fullName', 'name'), composed || str(pick(u, 'email'))),
    role: toRole(role),
    group,
    faculty: optStr(pick(u, 'faculty') ?? pick(student, 'faculty')),
    program: optStr(pick(u, 'program', 'specialty', 'direction') ?? pick(student, 'program', 'specialty')),
    course: num(pick(u, 'course', 'year') ?? pick(student, 'course', 'year'), 0) || undefined,
    studyForm: optStr(pick(u, 'studyForm', 'educationForm') ?? pick(student, 'studyForm', 'educationForm')),
    funding: optStr(pick(u, 'funding', 'fundingType', 'basis') ?? pick(student, 'funding', 'fundingType')),
    studentCardNumber: optStr(
      pick(u, 'studentCardNumber', 'studentId', 'recordBook', 'cardNumber') ??
        pick(student, 'studentCardNumber', 'studentId', 'recordBook'),
    ),
    enrolledAt: dateStr(pick(u, 'enrolledAt') ?? pick(student, 'enrolledAt')),
    validUntil: dateStr(pick(u, 'validUntil') ?? pick(student, 'validUntil')),
    position: optStr(pick(u, 'position', 'title')),
    department: optStr(pick(u, 'department')),
    avatarUrl: optStr(pick(u, 'avatarUrl')) ?? null,
  };
}

export function toRole(v: unknown): Role {
  const r = str(v).toUpperCase();
  if (r === 'ADMIN' || r === 'DEAN' || r === 'STAFF') return 'ADMIN';
  if (r === 'TEACHER' || r === 'LECTURER' || r === 'PROFESSOR') return 'TEACHER';
  return 'STUDENT';
}

// ───────────────────────── schedule

const LESSON_TYPES: Record<string, LessonType> = {
  LECTURE: 'LECTURE',
  ЛЕКЦИЯ: 'LECTURE',
  SEMINAR: 'SEMINAR',
  PRACTICE: 'SEMINAR',
  СЕМИНАР: 'SEMINAR',
  LAB: 'LAB',
  LABORATORY: 'LAB',
  ЛАБОРАТОРНАЯ: 'LAB',
  EXAM: 'EXAM',
  ЭКЗАМЕН: 'EXAM',
};

function hhmm(v: unknown): string {
  const s = str(v);
  if (/^\d{1,2}:\d{2}/.test(s)) return s.slice(0, 5).padStart(5, '0');
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  return s;
}

export function toLesson(raw: unknown): Lesson | null {
  if (!isObj(raw)) return null;
  const date = dateStr(pick(raw, 'date', 'startsAt', 'startAt'));
  let dayOfWeek = num(pick(raw, 'dayOfWeek', 'weekday', 'day'), 0);
  if (!dayOfWeek && date) {
    const d = new Date(date);
    if (!Number.isNaN(d.getTime())) dayOfWeek = d.getDay() === 0 ? 7 : d.getDay();
  }
  const subjRaw = pick(raw, 'subject', 'subjectName', 'title');
  const teacherRaw = pick(raw, 'teacher', 'teacherName', 'lecturer');
  const oldRoom = optStr(pick(raw, 'oldRoom', 'previousRoom'));
  return {
    id: str(pick(raw, 'id'), Math.random().toString(36).slice(2)),
    subject: isObj(subjRaw) ? str(pick(subjRaw, 'name', 'title')) : str(subjRaw, 'Занятие'),
    type: LESSON_TYPES[str(pick(raw, 'type', 'kind', 'lessonType')).toUpperCase()] ?? 'OTHER',
    teacher: isObj(teacherRaw) ? optStr(pick(teacherRaw, 'fullName', 'name')) : optStr(teacherRaw),
    room: str(pick(raw, 'room', 'auditorium', 'location'), '—'),
    oldRoom: oldRoom ?? null,
    isRescheduled: Boolean(pick(raw, 'isRescheduled', 'rescheduled')),
    dayOfWeek: dayOfWeek || 1,
    date,
    startTime: hhmm(pick(raw, 'startTime', 'start', 'startsAt', 'startAt')),
    endTime: hhmm(pick(raw, 'endTime', 'end', 'endsAt', 'endAt')),
    note: optStr(pick(raw, 'note', 'rescheduleReason', 'comment')),
    group: optStr(pick(raw, 'groupName', 'group')),
    building: optStr(pick(raw, 'building')),
  };
}

export const toLessons = (data: unknown): Lesson[] =>
  unwrapList(data, 'lessons', 'schedule')
    .map(toLesson)
    .filter((l): l is Lesson => l !== null);

// ───────────────────────── study

const ASSIGNMENT_STATUS: Record<string, AssignmentStatus> = {
  ACTIVE: 'ACTIVE',
  PENDING: 'ACTIVE',
  OPEN: 'ACTIVE',
  ASSIGNED: 'ACTIVE',
  TODO: 'ACTIVE',
  SUBMITTED: 'SUBMITTED',
  ON_REVIEW: 'SUBMITTED',
  GRADED: 'GRADED',
  DONE: 'GRADED',
  ACCEPTED: 'GRADED',
  OVERDUE: 'OVERDUE',
  EXPIRED: 'OVERDUE',
};

export function toAssignment(raw: unknown): Assignment | null {
  if (!isObj(raw)) return null;
  const subjRaw = pick(raw, 'subject', 'subjectName', 'course');
  const submission = isObj(raw.submission) ? (raw.submission as Raw) : null;
  let status = ASSIGNMENT_STATUS[str(pick(raw, 'status')).toUpperCase()];
  if (!status) status = submission ? 'SUBMITTED' : 'ACTIVE';
  const deadline = dateStr(pick(raw, 'deadline', 'dueDate', 'dueAt')) ?? new Date().toISOString();
  if (status === 'ACTIVE' && new Date(deadline).getTime() < Date.now()) status = 'OVERDUE';
  return {
    id: str(pick(raw, 'id')),
    title: str(pick(raw, 'title', 'name'), 'Задание'),
    subject: isObj(subjRaw) ? str(pick(subjRaw, 'name', 'title')) : str(subjRaw, '—'),
    description: optStr(pick(raw, 'description', 'text')),
    deadline,
    points: num(pick(raw, 'points', 'weight', 'brsPoints', 'maxPoints', 'maxScore'), 0),
    status,
    submittedAt: dateStr(pick(raw, 'submittedAt') ?? (submission ? pick(submission, 'createdAt', 'submittedAt') : undefined)),
    submissionLink: optStr(pick(raw, 'submissionLink') ?? (submission ? pick(submission, 'link', 'url') : undefined)),
    score: (() => {
      const s = pick(raw, 'score', 'grade') ?? (submission ? pick(submission, 'score', 'grade') : undefined);
      return s === undefined ? null : num(s);
    })(),
    group: optStr(pick(raw, 'groupName', 'group')),
    authorName: optStr(pick(raw, 'authorName')),
    taskPrompt: str(pick(raw, 'taskPrompt')),
    starterTemplate: optStr(pick(raw, 'starterTemplate')) ?? null,
    solutionText: optStr(pick(raw, 'solutionText')) ?? null,
    studentComment: optStr(pick(raw, 'studentComment')) ?? null,
    gradeAwarded: pick(raw, 'gradeAwarded') === undefined ? null : num(pick(raw, 'gradeAwarded')),
    teacherFeedback: optStr(pick(raw, 'teacherFeedback')) ?? null,
    material: isObj(raw.material)
      ? {
          id: str(pick(raw.material as Raw, 'id')),
          title: str(pick(raw.material as Raw, 'title'), 'Методичка'),
          category: MATERIAL_CATEGORY[str(pick(raw.material as Raw, 'category')).toUpperCase()] ?? 'NOTES',
        }
      : null,
    student: isObj(raw.student)
      ? {
          id: str(pick(raw.student as Raw, 'id')),
          fullName: str(pick(raw.student as Raw, 'fullName'), 'Студент'),
          group: optStr(pick(raw.student as Raw, 'groupName', 'group')),
        }
      : undefined,
  };
}

export const toAssignments = (data: unknown): Assignment[] =>
  unwrapList(data, 'assignments', 'homeworks', 'deadlines')
    .map(toAssignment)
    .filter((a): a is Assignment => a !== null);

const MATERIAL_CATEGORY: Record<string, MaterialCategory> = {
  NOTES: 'NOTES',
  LECTURE_NOTES: 'NOTES',
  SUMMARY: 'NOTES',
  КОНСПЕКТ: 'NOTES',
  CHEATSHEET: 'CHEATSHEET',
  CHEAT_SHEET: 'CHEATSHEET',
  ШПАРГАЛКА: 'CHEATSHEET',
  TICKETS: 'TICKETS',
  EXAM_TICKETS: 'TICKETS',
  БИЛЕТЫ: 'TICKETS',
  LAB_TEMPLATE: 'LAB_TEMPLATE',
  TEMPLATE: 'LAB_TEMPLATE',
  ШАБЛОН: 'LAB_TEMPLATE',
};

export function toMaterial(raw: unknown): Material | null {
  if (!isObj(raw)) return null;
  const subjRaw = pick(raw, 'subject', 'subjectName');
  const content = str(pick(raw, 'contentMarkdown', 'content', 'markdown', 'body'));
  return {
    id: str(pick(raw, 'id')),
    title: str(pick(raw, 'title', 'name'), 'Материал'),
    subject: isObj(subjRaw) ? str(pick(subjRaw, 'name', 'title')) : str(subjRaw, '—'),
    category: MATERIAL_CATEGORY[str(pick(raw, 'category', 'type')).toUpperCase()] ?? 'NOTES',
    description: optStr(pick(raw, 'description', 'summary')),
    contentMarkdown: content,
    updatedAt: dateStr(pick(raw, 'updatedAt', 'createdAt')),
    readingMinutes: Math.max(1, Math.round(content.split(/\s+/).length / 180)),
  };
}

export function toStudy(data: unknown): { assignments: Assignment[]; materials: Material[] } {
  const root = unwrapOne(data) ?? {};
  return {
    assignments: toAssignments(pick(root, 'assignments', 'homeworks') ?? []),
    materials: unwrapList(pick(root, 'materials') ?? [], 'materials')
      .map(toMaterial)
      .filter((m): m is Material => m !== null),
  };
}

// ───────────────────────── grades

export function toSubjectGrade(raw: unknown): SubjectGrade | null {
  if (!isObj(raw)) return null;
  const subjRaw = pick(raw, 'subject', 'name', 'title');
  const b = isObj(raw.breakdown) ? (raw.breakdown as Raw) : raw;
  const labs = num(pick(b, 'labs', 'labsScore', 'labScore'));
  const rk = num(pick(b, 'rk', 'rkScore', 'midterms', 'control', 'controlScore'));
  const attendance = num(pick(b, 'attendance', 'attendanceScore'));
  const total = num(pick(raw, 'total', 'totalScore', 'score'), labs + rk + attendance);
  return {
    id: str(pick(raw, 'id', 'subjectId'), str(subjRaw)),
    name: isObj(subjRaw) ? str(pick(subjRaw, 'name', 'title')) : str(subjRaw, 'Дисциплина'),
    teacher: optStr(pick(raw, 'teacher', 'teacherName')),
    labs,
    labsMax: num(pick(b, 'labsMax', 'labMax', 'maxLabs'), 40),
    rk,
    rkMax: num(pick(b, 'rkMax', 'maxRk', 'controlMax'), 40),
    attendance,
    attendanceMax: num(pick(b, 'attendanceMax', 'maxAttendance'), 20),
    total,
    hasDebt: Boolean(pick(raw, 'hasDebt', 'debt', 'isDebt')),
  };
}

export const toGrades = (data: unknown): SubjectGrade[] =>
  unwrapList(data, 'subjects', 'grades')
    .map(toSubjectGrade)
    .filter((g): g is SubjectGrade => g !== null);

// ───────────────────────── requests

const REQUEST_TYPE: Record<string, RequestType> = {
  STUDY_CERTIFICATE: 'STUDY_CERTIFICATE',
  ENROLLMENT_CERTIFICATE: 'STUDY_CERTIFICATE',
  CERTIFICATE: 'STUDY_CERTIFICATE',
  MILITARY_CERTIFICATE: 'MILITARY_CERTIFICATE',
  MILITARY: 'MILITARY_CERTIFICATE',
  FINANCIAL_AID: 'FINANCIAL_AID',
  MATERIAL_AID: 'FINANCIAL_AID',
  RETAKE: 'RETAKE',
  RETAKE_APPLICATION: 'RETAKE',
  ACADEMIC_TRANSCRIPT: 'ACADEMIC_TRANSCRIPT',
  TRANSCRIPT: 'ACADEMIC_TRANSCRIPT',
  PGAS: 'PGAS',
  DORMITORY_PASS: 'DORMITORY_PASS',
};

const REQUEST_STATUS: Record<string, RequestStatus> = {
  CREATED: 'CREATED',
  NEW: 'CREATED',
  DRAFT: 'CREATED',
  PENDING: 'PENDING',
  IN_REVIEW: 'PENDING',
  IN_PROGRESS: 'PENDING',
  REVIEW: 'PENDING',
  APPROVED: 'APPROVED',
  SIGNED: 'APPROVED',
  READY: 'APPROVED',
  DONE: 'APPROVED',
  REJECTED: 'REJECTED',
  DECLINED: 'REJECTED',
};

export function toRequest(raw: unknown): StudentRequest | null {
  const r = unwrapOne(raw, 'request');
  if (!r || pick(r, 'id') === undefined) return null;
  const studentRaw = pick(r, 'student', 'user', 'author');
  const student = isObj(studentRaw) ? toUser(studentRaw) : null;
  return {
    id: str(pick(r, 'id')),
    type: REQUEST_TYPE[str(pick(r, 'type', 'kind')).toUpperCase()] ?? 'STUDY_CERTIFICATE',
    status: REQUEST_STATUS[str(pick(r, 'status')).toUpperCase()] ?? 'CREATED',
    createdAt: dateStr(pick(r, 'createdAt')) ?? new Date().toISOString(),
    updatedAt: dateStr(pick(r, 'updatedAt')),
    comment: optStr(pick(r, 'comment', 'reason', 'details')) ?? null,
    adminComment: optStr(pick(r, 'adminComment', 'resolution', 'rejectReason')) ?? null,
    registryNumber: optStr(pick(r, 'registryNumber', 'registry', 'number')) ?? null,
    signedAt: dateStr(pick(r, 'signedAt', 'approvedAt')) ?? null,
    signedBy: optStr(pick(r, 'signedBy', 'approvedBy', 'signer')) ?? null,
    student: student
      ? { id: student.id, fullName: student.fullName, group: student.group, email: student.email }
      : undefined,
    payload: (() => {
      const p = pick(r, 'payload');
      if (isObj(p)) return p;
      const j = pick(r, 'payloadJson');
      if (typeof j === 'string' && j) {
        try {
          const parsed: unknown = JSON.parse(j);
          return isObj(parsed) ? parsed : null;
        } catch {
          return null;
        }
      }
      return null;
    })(),
  };
}

export const toRequests = (data: unknown): StudentRequest[] =>
  unwrapList(data, 'requests')
    .map(toRequest)
    .filter((r): r is StudentRequest => r !== null);

// ───────────────────────── dashboard

const ANN_TYPES: Record<string, AnnouncementType> = {
  URGENT: 'URGENT',
  ROOM_CHANGE: 'ROOM_CHANGE',
  RESCHEDULE: 'ROOM_CHANGE',
  INFO: 'INFO',
};

export function toAnnouncement(raw: unknown): Announcement | null {
  const a = unwrapOne(raw, 'announcement');
  if (!a) return null;
  return {
    id: str(pick(a, 'id'), Math.random().toString(36).slice(2)),
    type: ANN_TYPES[str(pick(a, 'type', 'kind')).toUpperCase()] ?? 'INFO',
    title: str(pick(a, 'title'), 'Объявление'),
    body: str(pick(a, 'body', 'text', 'content', 'message')),
    createdAt: dateStr(pick(a, 'createdAt', 'publishedAt')) ?? new Date().toISOString(),
    group: optStr(pick(a, 'group', 'targetGroup')),
  };
}

export function toDashboard(data: unknown): DashboardData {
  const root = unwrapOne(data, 'dashboard') ?? {};
  const avg = pick(root, 'averageScore', 'avgScore', 'averageBrs', 'brsAverage');
  return {
    nextLesson: toLesson(pick(root, 'nextLesson', 'upcomingLesson')),
    deadlines: toAssignments(pick(root, 'deadlines', 'upcomingDeadlines', 'assignments') ?? []),
    activeRequest: toRequest(pick(root, 'activeRequest', 'lastRequest') ?? null),
    averageScore: avg === undefined ? null : num(avg),
    announcements: unwrapList(pick(root, 'announcements', 'notifications') ?? [])
      .map(toAnnouncement)
      .filter((a): a is Announcement => a !== null),
  };
}

// ───────────────────────── ai

export function toChatReply(data: unknown): ChatReply {
  if (typeof data === 'string') return { reply: data, suggestions: [] };
  const root = unwrapOne(data) ?? {};
  const msg = pick(root, 'reply', 'answer', 'content', 'message', 'text');
  const reply = isObj(msg) ? str(pick(msg, 'content', 'text')) : str(msg);
  const sugg = pick(root, 'suggestions', 'quickReplies', 'followUps');
  return {
    reply,
    suggestions: Array.isArray(sugg) ? sugg.map((s) => (isObj(s) ? str(pick(s, 'text', 'label')) : str(s))).filter(Boolean).slice(0, 4) : [],
  };
}
