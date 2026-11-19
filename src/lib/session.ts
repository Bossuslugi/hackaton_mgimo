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

export async function requireRole(role: 'STUDENT' | 'ADMIN'): Promise<Session> {
  const s = await requireSession();
  if (s.role !== role) {
    throw new HttpError(
      403,
      role === 'ADMIN' ? 'Доступ запрещён: действие доступно только сотруднику деканата' : 'Доступ запрещён: раздел доступен только студентам',
    );
  }
  return s;
}
