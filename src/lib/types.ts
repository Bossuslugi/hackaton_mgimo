/**
 * Доменные типы фронтенда. Ответы бэкенда приводятся к ним в `normalize.ts`,
 * поэтому компоненты не зависят от точных имён полей API.
 */

export type Role = 'STUDENT' | 'ADMIN';

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

export type RequestType = 'STUDY_CERTIFICATE' | 'MILITARY_CERTIFICATE' | 'FINANCIAL_AID' | 'RETAKE';
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
