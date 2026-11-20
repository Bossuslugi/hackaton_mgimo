/**
 * Связи между людьми: какие группы ведёт преподаватель, кому можно писать в мессенджере.
 * Правила — specs/03_DATA_AND_SECURITY.md §V2.3, §V2.5.
 */
import type { User } from '@prisma/client';
import { prisma } from './prisma';
import { shortName } from './domain';

type Person = Pick<User, 'id' | 'role' | 'groupName'>;

/** Строка «Фамилия И. О.», под которой преподаватель записан в расписании. */
export const scheduleTeacherName = (u: Pick<User, 'fullName'>) => shortName(u.fullName);

/** Группы и дисциплины, которые преподаватель ведёт по расписанию. */
export async function teachingLoad(u: Pick<User, 'fullName'>) {
  const items = await prisma.scheduleItem.findMany({
    where: { teacher: scheduleTeacherName(u) },
    select: { groupName: true, subject: true },
  });
  return {
    groups: [...new Set(items.map((i) => i.groupName))].sort(),
    subjects: [...new Set(items.map((i) => i.subject))].sort(),
    pairs: items,
  };
}

/** Базовое правило контакт-листа (без учёта уже существующей переписки). */
export function isContact(me: Person, peer: Person): boolean {
  if (me.id === peer.id) return false;
  if (me.role !== 'STUDENT') return true;
  if (peer.role === 'TEACHER' || peer.role === 'ADMIN') return true;
  return peer.role === 'STUDENT' && !!me.groupName && me.groupName === peer.groupName;
}

/** Можно ли переписываться: контакт по правилам или переписка уже начата собеседником. */
export async function canMessage(me: Person, peer: Person): Promise<boolean> {
  if (me.id === peer.id) return false;
  if (isContact(me, peer)) return true;
  const existing = await prisma.directMessage.findFirst({
    where: { senderId: peer.id, receiverId: me.id },
    select: { id: true },
  });
  return !!existing;
}
