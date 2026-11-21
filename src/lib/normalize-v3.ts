/**
 * Нормализация ответов эндпоинтов V3 (specs/04_API_CONTRACT.md §V3):
 * IT-доступы, мероприятия, физкультура, ИИ-квиз.
 */
import { unwrapList, unwrapOne } from './normalize';

type Raw = Record<string, unknown>;

const isObj = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, fallback = ''): string => (v === undefined || v === null ? fallback : String(v));
const optStr = (v: unknown): string | null => (v === undefined || v === null || v === '' ? null : String(v));
const num = (v: unknown, fallback = 0): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const strs = (v: unknown) => (Array.isArray(v) ? v.map((x) => str(x)).filter(Boolean) : []);

// ───────────────────────── IT-доступы

export interface License {
  name: string;
  status: string;
  keyHint: string;
  description: string;
}

export interface CampusServices {
  wifiSsid: string;
  wifiLogin: string;
  wifiPassword: string;
  wifiUpdatedAt: string | null;
  corporateEmail: string;
  studentCardNumber: string | null;
  licenses: License[];
}

export function toWifi(raw: unknown): Pick<CampusServices, 'wifiSsid' | 'wifiLogin' | 'wifiPassword' | 'wifiUpdatedAt'> {
  const r = unwrapOne(raw) ?? {};
  return {
    wifiSsid: str(r.wifiSsid, 'Orbita-Edu-5G'),
    wifiLogin: str(r.wifiLogin),
    wifiPassword: str(r.wifiPassword),
    wifiUpdatedAt: optStr(r.wifiUpdatedAt),
  };
}

export function toCampusServices(raw: unknown): CampusServices {
  const r = unwrapOne(raw) ?? {};
  return {
    ...toWifi(r),
    corporateEmail: str(r.corporateEmail),
    studentCardNumber: optStr(r.studentCardNumber),
    licenses: unwrapList(r.licenses ?? []).flatMap((l) =>
      isObj(l)
        ? [{ name: str(l.name, 'Лицензия'), status: str(l.status), keyHint: str(l.keyHint), description: str(l.description) }]
        : [],
    ),
  };
}

// ───────────────────────── мероприятия

export interface CampusEvent {
  id: string;
  title: string;
  category: string;
  description: string;
  date: string; // YYYY-MM-DD
  timeRange: string;
  location: string;
  organizer: string;
  capacity: number;
  registeredCount: number;
  spotsLeft: number;
  tags: string[];
  isPast: boolean;
  isRegistered: boolean;
  ticketCode: string | null;
  registeredAt: string | null;
  /** клиентский флаг оптимистичного обновления */
  pending?: boolean;
}

export function toCampusEvent(raw: unknown): CampusEvent | null {
  const e = unwrapOne(raw, 'event');
  if (!e || e.id === undefined) return null;
  const capacity = num(e.capacity);
  const registeredCount = num(e.registeredCount);
  return {
    id: str(e.id),
    title: str(e.title, 'Мероприятие'),
    category: str(e.category, 'Митап'),
    description: str(e.description),
    date: str(e.date).slice(0, 10),
    timeRange: str(e.timeRange),
    location: str(e.location),
    organizer: str(e.organizer),
    capacity,
    registeredCount,
    spotsLeft: num(e.spotsLeft, Math.max(0, capacity - registeredCount)),
    tags: strs(e.tags),
    isPast: Boolean(e.isPast),
    isRegistered: Boolean(e.isRegistered),
    ticketCode: optStr(e.ticketCode),
    registeredAt: optStr(e.registeredAt),
  };
}

export interface EventsData {
  events: CampusEvent[];
  categories: string[];
  myRegistrations: number;
}

export function toEvents(raw: unknown): EventsData {
  const r = unwrapOne(raw) ?? {};
  const events = unwrapList(raw, 'events')
    .map(toCampusEvent)
    .filter((e): e is CampusEvent => e !== null);
  return {
    events,
    categories: strs(r.categories),
    myRegistrations: num(r.myRegistrations, events.filter((e) => e.isRegistered).length),
  };
}

// ───────────────────────── физкультура

export interface SportSection {
  id: string;
  sportType: string;
  title: string;
  coachName: string;
  campusLocation: string;
  scheduleText: string;
  capacity: number;
  enrolledCount: number;
  spotsLeft: number;
  isCurrent: boolean;
}

export function toSportSection(raw: unknown): SportSection | null {
  const s = unwrapOne(raw, 'section');
  if (!s || s.id === undefined) return null;
  const capacity = num(s.capacity);
  const enrolledCount = num(s.enrolledCount);
  return {
    id: str(s.id),
    sportType: str(s.sportType),
    title: str(s.title, 'Секция'),
    coachName: str(s.coachName),
    campusLocation: str(s.campusLocation),
    scheduleText: str(s.scheduleText),
    capacity,
    enrolledCount,
    spotsLeft: num(s.spotsLeft, Math.max(0, capacity - enrolledCount)),
    isCurrent: Boolean(s.isCurrent),
  };
}

export interface SportsData {
  sections: SportSection[];
  currentSectionId: string | null;
  enrolledAt: string | null;
  peCurrentPoints: number;
  peTargetPoints: number;
  peProgressPercent: number;
  canEnroll: boolean;
}

export function toSports(raw: unknown): SportsData {
  const r = unwrapOne(raw) ?? {};
  const target = num(r.peTargetPoints, 20);
  const current = num(r.peCurrentPoints);
  return {
    sections: unwrapList(raw, 'sections')
      .map(toSportSection)
      .filter((s): s is SportSection => s !== null),
    currentSectionId: optStr(r.currentSectionId),
    enrolledAt: optStr(r.enrolledAt),
    peCurrentPoints: current,
    peTargetPoints: target,
    peProgressPercent: num(r.peProgressPercent, target ? Math.round((current / target) * 100) : 0),
    canEnroll: r.canEnroll === undefined ? true : Boolean(r.canEnroll),
  };
}

// ───────────────────────── ИИ-квиз

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface Quiz {
  title: string;
  subject: string;
  questions: QuizQuestion[];
  source: string;
}

export function toQuiz(raw: unknown): Quiz {
  const r = unwrapOne(raw) ?? {};
  return {
    title: str(r.title),
    subject: str(r.subject),
    source: str(r.source, 'rules'),
    questions: unwrapList(r.questions ?? []).flatMap((q) => {
      if (!isObj(q)) return [];
      const options = strs(q.options);
      const correctIndex = num(q.correctIndex, -1);
      if (options.length < 2 || correctIndex < 0 || correctIndex >= options.length) return [];
      return [{ question: str(q.question), options, correctIndex, explanation: str(q.explanation) }];
    }),
  };
}
