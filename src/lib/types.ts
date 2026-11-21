/**
 * Доменные типы фронтенда. Ответы бэкенда приводятся к ним в `normalize.ts`,
 * поэтому компоненты не зависят от точных имён полей API.
 */

export type Role = 'STUDENT' | 'ADMIN' | 'TEACHER';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  group?: string;
  faculty?: string;
  program?: string;
  course?: number;
  studyForm?: string;
  funding?: string;
  studentCardNumber?: string;
  enrolledAt?: string;
  validUntil?: string;
  position?: string;
  department?: string;
}

export type LessonType = 'LECTURE' | 'SEMINAR' | 'LAB' | 'EXAM' | 'OTHER';

export interface Lesson {
  id: string;
  subject: string;
  type: LessonType;
  teacher?: string;
  room: string;
  oldRoom?: string | null;
  isRescheduled: boolean;
  /** 1 — понедельник … 6 — суббота */
  dayOfWeek: number;
  /** ISO-дата, если бэкенд отдаёт конкретный день */
  date?: string;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  note?: string;
  group?: string;
  building?: string;
}

export type AssignmentStatus = 'ACTIVE' | 'SUBMITTED' | 'GRADED' | 'OVERDUE';

export interface Assignment {
  id: string;
  title: string;
  subject: string;
  description?: string;
  deadline: string; // ISO
  points: number; // вес в баллах БРС
  status: AssignmentStatus;
  submittedAt?: string;
  submissionLink?: string;
  score?: number | null;
  // V2 · онлайн-ДЗ
  group?: string;
  authorName?: string;
  taskPrompt: string;
  starterTemplate?: string | null;
  solutionText?: string | null;
  studentComment?: string | null;
  gradeAwarded?: number | null;
  teacherFeedback?: string | null;
  material?: { id: string; title: string; category: MaterialCategory } | null;
  student?: { id: string; fullName: string; group?: string };
}

export type MaterialCategory = 'NOTES' | 'CHEATSHEET' | 'TICKETS' | 'LAB_TEMPLATE';

export interface Material {
  id: string;
  title: string;
  subject: string;
  category: MaterialCategory;
  description?: string;
  contentMarkdown: string;
  updatedAt?: string;
  readingMinutes?: number;
}

export interface SubjectGrade {
  id: string;
  name: string;
  teacher?: string;
  labs: number;
  labsMax: number;
  rk: number;
  rkMax: number;
  attendance: number;
  attendanceMax: number;
  total: number;
  hasDebt?: boolean;
}

export type RequestType =
  | 'STUDY_CERTIFICATE'
  | 'MILITARY_CERTIFICATE'
  | 'ACADEMIC_TRANSCRIPT'
  | 'FINANCIAL_AID'
  | 'PGAS'
  | 'RETAKE'
  | 'DORMITORY_PASS';
export type RequestStatus = 'CREATED' | 'PENDING' | 'APPROVED' | 'REJECTED';

export interface RequestStudent {
  id?: string;
  fullName: string;
  group?: string;
  email?: string;
}

export interface StudentRequest {
  id: string;
  type: RequestType;
  status: RequestStatus;
  createdAt: string;
  updatedAt?: string;
  comment?: string | null;
  adminComment?: string | null;
  registryNumber?: string | null;
  signedAt?: string | null;
  signedBy?: string | null;
  student?: RequestStudent;
  payload?: Record<string, unknown> | null;
}

export type AnnouncementType = 'URGENT' | 'ROOM_CHANGE' | 'INFO';

export interface Announcement {
  id: string;
  type: AnnouncementType;
  title: string;
  body: string;
  createdAt: string;
  group?: string;
}

export interface DashboardData {
  nextLesson: Lesson | null;
  deadlines: Assignment[];
  activeRequest: StudentRequest | null;
  averageScore: number | null;
  announcements: Announcement[];
}

export type CopilotMode = 'TUTOR' | 'DEANERY';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  error?: boolean;
}

export interface CopilotContext {
  kind: 'assignment' | 'material';
  id: string;
  title: string;
  subject: string;
  text?: string;
}

export interface ChatReply {
  reply: string;
  suggestions: string[];
}

// ───────────────────────── V2 · мессенджер

export interface Contact {
  id: string;
  fullName: string;
  role: Role;
  group?: string;
  department?: string;
  position?: string;
  lastMessage?: Message | null;
  unreadCount: number;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  isRead: boolean;
  mine: boolean;
  createdAt: string;
  /** клиентский статус оптимистичной отправки */
  pending?: boolean;
  failed?: boolean;
}

// ───────────────────────── V2 · бронирования

export interface RoomSlot {
  timeSlot: string;
  available: boolean;
  taken: boolean;
}

export interface Room {
  roomName: string;
  building: string;
  capacity: number;
  equipment: string[];
  description?: string;
  slots: RoomSlot[];
}

export interface Booking {
  id?: string;
  roomName: string;
  building: string;
  date: string; // YYYY-MM-DD
  timeSlot: string;
  participantsCount: number;
  status: 'CONFIRMED' | 'CANCELLED';
  isMine: boolean;
  purpose?: string;
  createdAt?: string;
}

export interface BookingsData {
  date: string;
  today: string;
  timeSlots: string[];
  myBookings: Booking[];
  allBookingsToday: Booking[];
  rooms: Room[];
}

// ───────────────────────── V2 · расписание с поиском

export interface ScheduleSearch {
  lessons: Lesson[];
  availableGroups: string[];
  availableRooms: string[];
}

// ───────────────────────── V2 · статистика

export interface StatsData {
  role: Role;
  campusHoursWeek: number;
  campusHoursSemester: number;
  classHoursWeek: number;
  attendancePercent: number | null;
  avgBrs: number | null;
  rankInGroup: number | null;
  groupSize: number | null;
  weeklyActivity: { day: string; dayOfWeek: number; campusHours: number; studyHours: number }[];
  timeBreakdown: { category: string; hours: number; percent: number }[];
}

// ───────────────────────── V2 · кабинет преподавателя

export interface TeacherCabinet {
  assignments: Assignment[];
  summary: { total: number; TODO: number; SUBMITTED: number; GRADED: number; OVERDUE: number };
  toReview: number;
  groups: string[];
  subjects: string[];
}
