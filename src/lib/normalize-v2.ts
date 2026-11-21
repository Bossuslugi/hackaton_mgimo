/**
 * Нормализация ответов эндпоинтов V2 (specs/04_API_CONTRACT.md §V2).
 * Как и normalize.ts — единственное место, где фронтенд знает имена полей API.
 */
import { toAssignments, toLessons, toRole, unwrapList, unwrapOne } from './normalize';
import type {
  Booking,
  BookingsData,
  Contact,
  Message,
  Room,
  ScheduleSearch,
  StatsData,
  TeacherCabinet,
} from './types';

type Raw = Record<string, unknown>;

const isObj = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);

function pick(obj: Raw, ...keys: string[]): unknown {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null) return obj[k];
  }
  return undefined;
}

const str = (v: unknown, fallback = ''): string => (v === undefined || v === null ? fallback : String(v));
const optStr = (v: unknown): string | undefined => (v === undefined || v === null || v === '' ? undefined : String(v));
const num = (v: unknown, fallback = 0): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const optNum = (v: unknown): number | null => (v === undefined || v === null ? null : num(v));
const strs = (v: unknown) => (Array.isArray(v) ? v.map((x) => str(x)).filter(Boolean) : []);
const dateStr = (v: unknown): string | undefined => (v === undefined || v === null || v === '' ? undefined : String(v));

// ───────────────────────── мессенджер

export function toMessage(raw: unknown): Message | null {
  const m = unwrapOne(raw, 'message');
  if (!m || pick(m, 'id') === undefined) return null;
  return {
    id: str(pick(m, 'id')),
    senderId: str(pick(m, 'senderId')),
    receiverId: str(pick(m, 'receiverId')),
    content: str(pick(m, 'content', 'text', 'body')),
    isRead: Boolean(pick(m, 'isRead')),
    mine: Boolean(pick(m, 'mine')),
    createdAt: dateStr(pick(m, 'createdAt')) ?? new Date().toISOString(),
  };
}

export function toContact(raw: unknown): Contact | null {
  if (!isObj(raw) || pick(raw, 'id') === undefined) return null;
  return {
    id: str(pick(raw, 'id')),
    fullName: str(pick(raw, 'fullName', 'name'), 'Пользователь'),
    role: toRole(pick(raw, 'role')),
    group: optStr(pick(raw, 'groupName', 'group')),
    department: optStr(pick(raw, 'department')),
    position: optStr(pick(raw, 'position')),
    avatarUrl: optStr(pick(raw, 'avatarUrl')) ?? null,
    lastMessage: raw.lastMessage ? toMessage(raw.lastMessage) : null,
    unreadCount: num(pick(raw, 'unreadCount'), 0),
  };
}

export interface ContactsData {
  contacts: Contact[];
  unreadTotal: number;
}

export function toContacts(data: unknown): ContactsData {
  const root = unwrapOne(data) ?? {};
  const contacts = unwrapList(data, 'contacts')
    .map(toContact)
    .filter((c): c is Contact => c !== null);
  return { contacts, unreadTotal: num(pick(root, 'unreadTotal'), contacts.reduce((s, c) => s + c.unreadCount, 0)) };
}

export function toThread(data: unknown): { peer: Contact | null; messages: Message[] } {
  const root = unwrapOne(data) ?? {};
  return {
    peer: toContact(pick(root, 'peer')),
    messages: unwrapList(pick(root, 'messages') ?? [])
      .map(toMessage)
      .filter((m): m is Message => m !== null),
  };
}

// ───────────────────────── бронирования

export function toBooking(raw: unknown): Booking | null {
  const b = unwrapOne(raw, 'booking');
  if (!b) return null;
  return {
    id: optStr(pick(b, 'id')),
    roomName: str(pick(b, 'roomName'), 'Помещение'),
    building: str(pick(b, 'building')),
    date: str(pick(b, 'date')).slice(0, 10),
    timeSlot: str(pick(b, 'timeSlot')),
    participantsCount: num(pick(b, 'participantsCount'), 1),
    status: str(pick(b, 'status')).toUpperCase() === 'CANCELLED' ? 'CANCELLED' : 'CONFIRMED',
    isMine: Boolean(pick(b, 'isMine')),
    purpose: optStr(pick(b, 'purpose')),
    createdAt: dateStr(pick(b, 'createdAt')),
  };
}

const toBookingList = (v: unknown) =>
  unwrapList(v ?? [])
    .map(toBooking)
    .filter((b): b is Booking => b !== null);

export function toBookings(data: unknown): BookingsData {
  const root = unwrapOne(data) ?? {};
  const rooms: Room[] = unwrapList(pick(root, 'roomsCatalog', 'rooms') ?? []).flatMap((r) => {
    if (!isObj(r)) return [];
    return [
      {
        roomName: str(pick(r, 'roomName', 'name'), 'Помещение'),
        building: str(pick(r, 'building')),
        capacity: num(pick(r, 'capacity'), 0),
        equipment: strs(r.equipment),
        description: optStr(pick(r, 'description')),
        slots: unwrapList(pick(r, 'slots') ?? []).flatMap((s) =>
          isObj(s)
            ? [{ timeSlot: str(pick(s, 'timeSlot')), available: Boolean(pick(s, 'available')), taken: Boolean(pick(s, 'taken')) }]
            : [],
        ),
      },
    ];
  });
  const today = str(pick(root, 'today'), new Date().toISOString().slice(0, 10));
  return {
    date: str(pick(root, 'date'), today),
    today,
    timeSlots: strs(root.timeSlots),
    myBookings: toBookingList(pick(root, 'myBookings')),
    allBookingsToday: toBookingList(pick(root, 'allBookingsToday')),
    rooms,
  };
}

// ───────────────────────── расписание с поиском

export function toScheduleSearch(data: unknown): ScheduleSearch {
  const root = unwrapOne(data) ?? {};
  return {
    lessons: toLessons(data),
    availableGroups: strs(pick(root, 'availableGroups')),
    availableRooms: strs(pick(root, 'availableRooms')),
  };
}

// ───────────────────────── статистика

export function toStats(data: unknown): StatsData {
  const r = unwrapOne(data, 'stats') ?? {};
  return {
    role: toRole(pick(r, 'role')),
    campusHoursWeek: num(pick(r, 'campusHoursWeek')),
    campusHoursSemester: num(pick(r, 'campusHoursSemester')),
    classHoursWeek: num(pick(r, 'classHoursWeek')),
    attendancePercent: optNum(pick(r, 'attendancePercent')),
    avgBrs: optNum(pick(r, 'avgBrs')),
    rankInGroup: optNum(pick(r, 'rankInGroup')),
    groupSize: optNum(pick(r, 'groupSize')),
    weeklyActivity: unwrapList(pick(r, 'weeklyActivity') ?? []).flatMap((d) =>
      isObj(d)
        ? [
            {
              day: str(pick(d, 'day')),
              dayOfWeek: num(pick(d, 'dayOfWeek')),
              campusHours: num(pick(d, 'campusHours')),
              studyHours: num(pick(d, 'studyHours')),
            },
          ]
        : [],
    ),
    timeBreakdown: unwrapList(pick(r, 'timeBreakdown') ?? []).flatMap((t) =>
      isObj(t) ? [{ category: str(pick(t, 'category')), hours: num(pick(t, 'hours')), percent: num(pick(t, 'percent')) }] : [],
    ),
  };
}

// ───────────────────────── кабинет преподавателя

export function toTeacherCabinet(data: unknown): TeacherCabinet {
  const root = unwrapOne(data) ?? {};
  const sm = isObj(root.summary) ? (root.summary as Raw) : {};
  return {
    assignments: toAssignments(pick(root, 'assignments') ?? []),
    summary: {
      total: num(pick(sm, 'total')),
      TODO: num(pick(sm, 'TODO')),
      SUBMITTED: num(pick(sm, 'SUBMITTED')),
      GRADED: num(pick(sm, 'GRADED')),
      OVERDUE: num(pick(sm, 'OVERDUE')),
    },
    toReview: num(pick(root, 'toReview')),
    groups: strs(pick(root, 'groups')),
    subjects: strs(pick(root, 'subjects')),
  };
}
