/**
 * Простой in-memory rate limiter (фиксированное окно).
 * Для прототипа достаточно; в продакшене — Redis/Upstash.
 */
type Bucket = { count: number; resetAt: number };

const g = globalThis as typeof globalThis & { __orbitaRate?: Map<string, Bucket> };
const buckets = (g.__orbitaRate ??= new Map<string, Bucket>());

export interface LimitResult {
  ok: boolean;
  retryAfterSec: number;
}

/** Учитывает попытку и сообщает, укладывается ли она в лимит. */
export function hit(key: string, limit: number, windowMs: number): LimitResult {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  b.count += 1;
  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
  }
  return { ok: b.count <= limit, retryAfterSec: Math.ceil((b.resetAt - now) / 1000) };
}

/** Проверка без учёта попытки. */
export function isBlocked(key: string, limit: number): LimitResult {
  const b = buckets.get(key);
  const now = Date.now();
  if (!b || b.resetAt <= now) return { ok: true, retryAfterSec: 0 };
  return { ok: b.count < limit, retryAfterSec: Math.ceil((b.resetAt - now) / 1000) };
}

export const reset = (key: string) => void buckets.delete(key);
