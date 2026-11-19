/**
 * Доменные константы и чистые функции бэкенда «Орбиты».
 * Используется в API (src/app/api/**), сидере (prisma/seed.ts) и ИИ-ассистенте.
 * Правила — specs/01_PRODUCT_PRD.md §3.4–3.7.
 */

export const ROLES = ['STUDENT', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export const LESSON_TYPES = ['Лекция', 'Практика', 'Лабораторная'] as const;
export const CONTROL_TYPES = ['Экзамен', 'Зачёт'] as const;

export const ASSIGNMENT_STATUSES = ['TODO', 'SUBMITTED', 'GRADED', 'OVERDUE'] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

export const MATERIAL_CATEGORIES = ['Конспект', 'Шпаргалка к РК', 'Билеты', 'Шаблон лабы'] as const;

export const REQUEST_TYPES = [
  'STUDY_CERTIFICATE',
  'MILITARY_CERTIFICATE',
  'FINANCIAL_AID',
  'RETAKE',
  'PGAS',
] as const;
export type RequestType = (typeof REQUEST_TYPES)[number];

export const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  STUDY_CERTIFICATE: 'Справка об обучении',
  MILITARY_CERTIFICATE: 'Справка для военкомата',
  FINANCIAL_AID: 'Заявление на материальную помощь',
  RETAKE: 'Направление на пересдачу',
  PGAS: 'Заявка на повышенную академическую стипендию (ПГАС)',
};

/** Нормативный срок рассмотрения, рабочих дней — используется ассистентом и в ответах API. */
export const REQUEST_SLA_DAYS: Record<RequestType, number> = {
  STUDY_CERTIFICATE: 1,
  MILITARY_CERTIFICATE: 3,
  FINANCIAL_AID: 10,
  RETAKE: 3,
  PGAS: 10,
};

export const REQUEST_STATUSES = ['NEW', 'IN_REVIEW', 'APPROVED', 'REJECTED'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];
export const ACTIVE_REQUEST_STATUSES: RequestStatus[] = ['NEW', 'IN_REVIEW'];

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  NEW: 'Новая',
  IN_REVIEW: 'На рассмотрении',
  APPROVED: 'Одобрена',
  REJECTED: 'Отклонена',
};

export const NOTIFICATION_CATEGORIES = ['DEADLINE', 'SCHEDULE', 'REQUEST', 'DEAN'] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

// ───────────────────────── БРС

export const BRS = {
  MAX: 100,
  ADMISSION: 50,
  SATISFACTORY: 60,
  GOOD: 71,
  EXCELLENT: 85,
} as const;

export function gradeLabel(total: number): string {
  if (total >= BRS.EXCELLENT) return 'Отлично';
  if (total >= BRS.GOOD) return 'Хорошо';
  if (total >= BRS.SATISFACTORY) return 'Удовлетворительно';
  return 'Неудовлетворительно';
}

export interface GradeLike {
  labsScore: number;
  midtermScore: number;
  attendanceScore: number;
  currentTotal: number;
}

export const computeTotal = (g: Pick<GradeLike, 'labsScore' | 'midtermScore' | 'attendanceScore'>) =>
  Math.min(BRS.MAX, g.labsScore + g.midtermScore + g.attendanceScore);

export const pointsToAdmission = (total: number) => Math.max(0, BRS.ADMISSION - total);
export const pointsToExcellent = (total: number) => Math.max(0, BRS.EXCELLENT - total);
export const hasDebt = (total: number) => total < BRS.ADMISSION;

export function averageTotal(totals: number[]): number | null {
  if (!totals.length) return null;
  return Math.round((totals.reduce((a, b) => a + b, 0) / totals.length) * 10) / 10;
}

// ───────────────────────── заявки

/** Реестровый номер вида ОРБ-2026-0418: год + порядковый номер (id + смещение). */
export function registryNumber(id: number, date = new Date()): string {
  return `ОРБ-${date.getFullYear()}-${String(id + 415).padStart(4, '0')}`;
}

// ───────────────────────── задания

/** Эффективный статус задания с учётом текущего времени. */
export function effectiveAssignmentStatus(status: string, deadlineIso: string, now = Date.now()): AssignmentStatus {
  if (status === 'TODO' && new Date(deadlineIso).getTime() < now) return 'OVERDUE';
  return (ASSIGNMENT_STATUSES as readonly string[]).includes(status) ? (status as AssignmentStatus) : 'TODO';
}

export const HOT_DEADLINE_HOURS = 72;

// ───────────────────────── время (МСК)

const TZ = 'Europe/Moscow';

/** День недели (1 = Пн … 7 = Вс) и время HH:MM в московском поясе. */
export function moscowNow(d = new Date()): { dayOfWeek: number; hhmm: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const map: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  return { dayOfWeek: map[get('weekday')] ?? 1, hhmm: `${get('hour')}:${get('minute')}` };
}

export interface SlotLike {
  dayOfWeek: number;
  startTime: string;
}

/** Ближайшее занятие: сегодня позже текущего времени, иначе первое в следующие дни (по кругу недели). */
export function findNextClass<T extends SlotLike>(items: T[], now = new Date()): T | null {
  if (!items.length) return null;
  const { dayOfWeek, hhmm } = moscowNow(now);
  const sorted = [...items].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime));
  const rank = (it: T) => {
    let dayDiff = (it.dayOfWeek - dayOfWeek + 7) % 7;
    if (dayDiff === 0 && it.startTime <= hhmm) dayDiff = 7;
    return dayDiff * 1440 + toMinutes(it.startTime);
  };
  return sorted.reduce((best, it) => (rank(it) < rank(best) ? it : best), sorted[0]);
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export const WEEKDAY_NAMES = ['', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'];
