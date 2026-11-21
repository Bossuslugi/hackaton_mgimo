import type { BadgeTone } from '@/components/ui/Badge';
import type { SubjectGrade } from './types';

/** Порог «отлично» и условие повышенной стипендии. */
export const STIPEND_THRESHOLD = 85;
export const PASS_THRESHOLD = 60;
export const ADMISSION_THRESHOLD = 50;
export const BRS_MAX = 100;

export interface GradeInfo {
  label: string;
  short: string;
  tone: BadgeTone;
}

export function gradeOf(total: number): GradeInfo {
  if (total >= STIPEND_THRESHOLD) return { label: 'Отлично', short: '5', tone: 'success' };
  if (total >= 71) return { label: 'Хорошо', short: '4', tone: 'brand' };
  if (total >= PASS_THRESHOLD) return { label: 'Удовлетворительно', short: '3', tone: 'warning' };
  return { label: 'Неудовлетворительно', short: '2', tone: 'danger' };
}

export const subjectMax = (s: SubjectGrade) => s.labsMax + s.rkMax + s.attendanceMax;

export interface SimDelta {
  labs: number;
  rk: number;
  attendance: number;
}

export const zeroDelta = (): SimDelta => ({ labs: 0, rk: 0, attendance: 0 });

/** Сколько баллов ещё можно добрать по каждой составляющей. */
export function headroom(s: SubjectGrade): SimDelta {
  return {
    labs: Math.max(0, s.labsMax - s.labs),
    rk: Math.max(0, s.rkMax - s.rk),
    attendance: Math.max(0, s.attendanceMax - s.attendance),
  };
}

export function projectedTotal(s: SubjectGrade, d: SimDelta): number {
  return Math.min(BRS_MAX, Math.round(s.total + d.labs + d.rk + d.attendance));
}

export const average = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
