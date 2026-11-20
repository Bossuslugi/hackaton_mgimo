/**
 * Серверная сессия. userId и role берутся ТОЛЬКО из верифицированного JWT в cookie orbita_token
 * и дополнительно сверяются с БД (удалённый пользователь или сменившаяся роль → 401).
 */
import { cookies } from 'next/headers';
import type { User } from '@prisma/client';
import { prisma } from './prisma';
import { HttpError } from './http';
import { SESSION_COOKIE, verifySession, type SessionPayload } from './jwt';

export interface Session extends SessionPayload {
  user: User;
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const payload = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!payload) return null;
  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user || user.role !== payload.role) return null;
  return { ...payload, user };
}

export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) throw new HttpError(401, 'Требуется вход в систему');
  return s;
}

type AppRole = 'STUDENT' | 'ADMIN' | 'TEACHER';

const ROLE_DENIED: Record<string, string> = {
  ADMIN: 'Доступ запрещён: действие доступно только сотруднику деканата',
  STUDENT: 'Доступ запрещён: раздел доступен только студентам',
  'TEACHER,ADMIN': 'Доступ запрещён: раздел доступен только преподавателям и деканату',
};

/** Требует одну из ролей; иначе 403. */
export async function requireRole(...roles: AppRole[]): Promise<Session> {
  const s = await requireSession();
  if (!roles.includes(s.role)) {
    throw new HttpError(403, ROLE_DENIED[roles.join(',')] ?? 'Доступ запрещён');
  }
  return s;
}
