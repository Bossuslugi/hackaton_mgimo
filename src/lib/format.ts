import type { BadgeTone } from '@/components/ui/Badge';
import type { LessonType, MaterialCategory, RequestStatus, RequestType } from './types';

export function plural(n: number, forms: [string, string, string]): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
}

export const points = (n: number) => `${n} ${plural(n, ['балл', 'балла', 'баллов'])}`;

const dateFmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' });
const dateShortFmt = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});
const weekdayFmt = new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });

const valid = (iso?: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const fmtDate = (iso?: string | null) => (valid(iso) ? dateFmt.format(valid(iso)!) : '—');
export const fmtDateShort = (iso?: string | null) => (valid(iso) ? dateShortFmt.format(valid(iso)!) : '—');
export const fmtDateTime = (iso?: string | null) => (valid(iso) ? dateTimeFmt.format(valid(iso)!) : '—');
export const fmtToday = (d = new Date()) => {
  const s = weekdayFmt.format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export const WEEKDAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'] as const;
export const WEEKDAYS_FULL = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'] as const;

/** 1 — понедельник … 7 — воскресенье */
export const isoWeekday = (d = new Date()) => (d.getDay() === 0 ? 7 : d.getDay());

export function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return ((parts[1]?.[0] ?? '') + (parts[0]?.[0] ?? '')).toUpperCase() || '·';
}

/** «Соколов Алексей Игоревич» → «Алексей» */
export const firstName = (fullName: string) => fullName.trim().split(/\s+/)[1] ?? fullName.split(/\s+/)[0];

export function greeting(d = new Date()): string {
  const h = d.getHours();
  if (h < 5) return 'Доброй ночи';
  if (h < 12) return 'Доброе утро';
  if (h < 18) return 'Добрый день';
  return 'Добрый вечер';
}

// ───────────────────────── дедлайны

export interface CountdownParts {
  ms: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export function countdownParts(targetIso: string, now = Date.now()): CountdownParts {
  const ms = new Date(targetIso).getTime() - now;
  const abs = Math.max(0, ms);
  return {
    ms,
    days: Math.floor(abs / 86_400_000),
    hours: Math.floor((abs % 86_400_000) / 3_600_000),
    minutes: Math.floor((abs % 3_600_000) / 60_000),
    seconds: Math.floor((abs % 60_000) / 1000),
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

export function countdownLabel(p: CountdownParts): string {
  if (p.ms <= 0) return 'Просрочено';
  const clock = `${pad(p.hours)}:${pad(p.minutes)}:${pad(p.seconds)}`;
  return p.days > 0 ? `${p.days} д ${clock}` : clock;
}

export function deadlineTone(ms: number): BadgeTone {
  if (ms <= 24 * 3_600_000) return 'danger';
  if (ms <= 72 * 3_600_000) return 'warning';
  return 'neutral';
}

/** Минут до HH:MM сегодня (отрицательно — уже прошло). */
export function minutesUntil(hhmm: string, now = new Date()): number {
  const [h, m] = hhmm.split(':').map(Number);
  const t = new Date(now);
  t.setHours(h || 0, m || 0, 0, 0);
  return Math.round((t.getTime() - now.getTime()) / 60_000);
}

export function inMinutesLabel(min: number): string {
  if (min <= 0) return 'сейчас';
  if (min < 60) return `через ${min} мин`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `через ${h} ч ${m} мин` : `через ${h} ч`;
}

// ───────────────────────── словари

export const LESSON_TYPE_LABEL: Record<LessonType, string> = {
  LECTURE: 'Лекция',
  SEMINAR: 'Семинар',
  LAB: 'Лабораторная',
  EXAM: 'Экзамен',
  OTHER: 'Занятие',
};

export const MATERIAL_CATEGORY_LABEL: Record<MaterialCategory, string> = {
  NOTES: 'Конспект',
  CHEATSHEET: 'Шпаргалка к РК',
  TICKETS: 'Билеты',
  LAB_TEMPLATE: 'Шаблон лабы',
};

export const REQUEST_TYPE_LABEL: Record<RequestType, string> = {
  STUDY_CERTIFICATE: 'Справка об обучении',
  MILITARY_CERTIFICATE: 'Справка для военкомата',
  ACADEMIC_TRANSCRIPT: 'Академическая справка',
  FINANCIAL_AID: 'Заявление на материальную помощь',
  PGAS: 'Повышенная стипендия (ПГАС)',
  RETAKE: 'Заявление на пересдачу',
  DORMITORY_PASS: 'Пропуск в общежитие',
};

export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  CREATED: 'Создано',
  PENDING: 'На проверке',
  APPROVED: 'Подписано ЭЦП',
  REJECTED: 'Отклонено',
};

export const REQUEST_STATUS_TONE: Record<RequestStatus, BadgeTone> = {
  CREATED: 'neutral',
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
};

const timeFmt = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });
export const fmtTime = (iso?: string | null) => (valid(iso) ? timeFmt.format(valid(iso)!) : '');

/** Для списка диалогов: время сегодня, «вчера», иначе дата. */
export function fmtChatStamp(iso?: string | null, now = new Date()): string {
  const d = valid(iso);
  if (!d) return '';
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 86_400_000);
  if (diff === 0) return timeFmt.format(d);
  if (diff === 1) return 'вчера';
  return dateShortFmt.format(d).slice(0, 5);
}

/** «2026-11-22» → «22 ноября», без сдвига часового пояса. */
export function fmtYmd(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return ymd;
  return dateFmt.format(new Date(y, m - 1, d));
}

export const fmtHours = (h: number) => h.toLocaleString('ru-RU', { maximumFractionDigits: 1 });
