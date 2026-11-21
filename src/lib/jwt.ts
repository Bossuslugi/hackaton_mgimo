/**
 * Подпись и проверка сессионных JWT (jose, HS256).
 * Модуль edge-совместим: используется и в middleware, и в route handlers.
 * Правила — specs/03_DATA_AND_SECURITY.md §3.2.
 */
import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE = 'orbita_token';
export const SESSION_TTL_SECONDS = 8 * 60 * 60;

const ISSUER = 'orbita';
const AUDIENCE = 'orbita-web';
const ALG = 'HS256';

export interface SessionPayload {
  userId: string;
  role: 'STUDENT' | 'ADMIN' | 'TEACHER';
}

type G = typeof globalThis & { __orbitaDevSecret?: Uint8Array };

let warned = false;

function getSecret(): Uint8Array {
  const raw = process.env.JWT_SECRET;
  if (raw && raw.length >= 32) return new TextEncoder().encode(raw);
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET не задан или короче 32 символов');
  }
  // Dev-режим: детерминированный fallback для совпадения секретов между Edge (middleware) и Node.js (API)
  if (!warned) {
    warned = true;
    console.warn('[security] JWT_SECRET не задан — используется dev-fallback секрет.');
  }
  return new TextEncoder().encode('orbita-dev-insecure-secret-key-32-chars-min!');
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ role: payload.role })
    .setProtectedHeader({ alg: ALG })
    .setSubject(payload.userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecret());
}

/** Возвращает полезную нагрузку или null, если токен отсутствует, подделан или истёк. */
export async function verifySession(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: [ALG],
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    const role = payload.role;
    if (typeof payload.sub !== 'string' || (role !== 'STUDENT' && role !== 'ADMIN' && role !== 'TEACHER')) return null;
    return { userId: payload.sub, role };
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  // В production — Secure. COOKIE_SECURE=0 отключает флаг для демо по http в локальной сети (не localhost).
  secure: process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== '0',
  path: '/',
  maxAge: SESSION_TTL_SECONDS,
};
