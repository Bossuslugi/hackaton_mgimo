/**
 * Доменные константы и чистые функции бэкенда «Орбиты».
 * Используется в API (src/app/api/**), сидере (prisma/seed.ts) и ИИ-ассистенте.
 * Правила — specs/01_PRODUCT_PRD.md §3.4–3.7.
 */

export const ROLES = ['STUDENT', 'ADMIN', 'TEACHER'] as const;
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
  // V2
  'ACADEMIC_TRANSCRIPT',
  'DORMITORY_PASS',
] as const;
export type RequestType = (typeof REQUEST_TYPES)[number];

export const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  STUDY_CERTIFICATE: 'Справка об обучении',
  MILITARY_CERTIFICATE: 'Справка для военкомата',
  FINANCIAL_AID: 'Заявление на материальную помощь',
  RETAKE: 'Направление на пересдачу',
  PGAS: 'Заявка на повышенную академическую стипендию (ПГАС)',
  ACADEMIC_TRANSCRIPT: 'Академическая справка (выписка оценок)',
  DORMITORY_PASS: 'Пропуск в общежитие',
};

/** Нормативный срок рассмотрения, рабочих дней — используется ассистентом и в ответах API. */
export const REQUEST_SLA_DAYS: Record<RequestType, number> = {
  STUDY_CERTIFICATE: 1,
  MILITARY_CERTIFICATE: 3,
  FINANCIAL_AID: 10,
  RETAKE: 3,
  PGAS: 10,
  ACADEMIC_TRANSCRIPT: 5,
  DORMITORY_PASS: 2,
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

export const NOTIFICATION_CATEGORIES = ['DEADLINE', 'SCHEDULE', 'REQUEST', 'DEAN', 'GRADE'] as const;
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

// ───────────────────────── V2: люди

/** «Волков Игорь Сергеевич» → «Волков И. С.» (формат поля ScheduleItem.teacher). */
export function shortName(full: string): string {
  const [last, ...rest] = full.trim().split(/\s+/);
  return [last, ...rest.map((p) => `${p[0]}.`)].join(' ');
}

/** Подпись автора задания: «Доц. Волков И. С.». */
export function authorLabel(fullName: string, position?: string | null): string {
  const p = (position ?? '').toLowerCase();
  const title = p.startsWith('профессор') ? 'Проф. ' : p.startsWith('доцент') ? 'Доц. ' : p.startsWith('ст') ? 'Ст. преп. ' : '';
  return `${title}${shortName(fullName)}`;
}

// ───────────────────────── V2: поиск

const LATIN_TO_CYR: Record<string, string> = { a: 'а', b: 'в', c: 'с', e: 'е', h: 'н', k: 'к', m: 'м', o: 'о', p: 'р', t: 'т', x: 'х', y: 'у' };

/** Нормализация для поиска: регистр, ё→е, латинские двойники → кириллица, без пробелов и точек. */
export function searchKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[a-z]/g, (ch) => LATIN_TO_CYR[ch] ?? ch)
    .replace(/[\s.«»"'-]+/g, '');
}

// ───────────────────────── V2: бронирование

export interface BookableRoom {
  roomName: string;
  building: string;
  capacity: number;
  equipment: string[];
  description: string;
}

export const ROOMS_CATALOG: BookableRoom[] = [
  {
    roomName: 'Коворкинг «Точка кипения»',
    building: 'Корпус А, 1 этаж',
    capacity: 40,
    equipment: ['Wi-Fi', 'Проектор', 'Маркерные стены', 'Кофе-поинт'],
    description: 'Открытое пространство для командной работы и митапов.',
  },
  {
    roomName: 'Проектная аудитория 304',
    building: 'Корпус Б, 3 этаж',
    capacity: 24,
    equipment: ['Интерактивная панель', 'ВКС', 'Модульная мебель'],
    description: 'Аудитория для проектных сессий и защит.',
  },
  {
    roomName: 'Переговорная Б-12',
    building: 'Корпус Б, 1 этаж',
    capacity: 8,
    equipment: ['ТВ-панель 65"', 'ВКС', 'Флипчарт'],
    description: 'Небольшая комната для встреч команды и созвонов.',
  },
  {
    roomName: 'Читальный зал №2',
    building: 'Библиотека, 2 этаж',
    capacity: 30,
    equipment: ['Тихая зона', 'Розетки у каждого места'],
    description: 'Тихая самостоятельная работа и подготовка к сессии.',
  },
  {
    roomName: 'Лекторий 201',
    building: 'Корпус А, 2 этаж',
    capacity: 120,
    equipment: ['Проектор', 'Звукоусиление', 'Запись лекций'],
    description: 'Большой зал для открытых лекций и мероприятий.',
  },
];

export const TIME_SLOTS = [
  '08:20 – 09:50',
  '10:00 – 11:30',
  '11:40 – 13:10',
  '13:30 – 15:00',
  '15:20 – 16:50',
  '17:00 – 18:30',
] as const;

export const BOOKING_HORIZON_DAYS = 14;
export const MAX_ACTIVE_BOOKINGS = 3;

export const slotStart = (slot: string) => slot.slice(0, 5);
export const slotKey = (roomName: string, date: string, timeSlot: string) => `${roomName}|${date}|${timeSlot}`;

/** Московская дата YYYY-MM-DD со сдвигом в днях. */
export function moscowDate(offsetDays = 0, d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(d.getTime() + offsetDays * 86_400_000),
  );
}

/** Слот ещё не начался (дата в будущем или сегодня позже текущего времени МСК). */
export function isSlotUpcoming(date: string, timeSlot: string, now = new Date()): boolean {
  const today = moscowDate(0, now);
  if (date !== today) return date > today;
  return slotStart(timeSlot) > moscowNow(now).hhmm;
}

/** Формат места занятия: «Корпус Б, ауд. 2337» или «Корпус А, Лаб. 105». */
export function formatLocation(building: string, room: string): string {
  return /^\d/.test(room) ? `${building}, ауд. ${room}` : `${building}, ${room}`;
}

export const LESSON_HOURS = 1.5;
export const WEEKDAY_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
