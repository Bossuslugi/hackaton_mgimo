/**
 * Единый формат ответов и ошибок API. Обработчики бросают HttpError,
 * обёртка `route()` превращает его в JSON без утечки stack trace.
 */
import { NextResponse } from 'next/server';
import { ZodError, type ZodType, type ZodTypeDef } from 'zod';

export class HttpError extends Error {
  status: number;
  extra?: Record<string, unknown>;
  constructor(status: number, message: string, extra?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

export const json = <T>(data: T, status = 200, headers?: HeadersInit) =>
  NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store', ...headers } });

export const errorJson = (status: number, error: string, extra?: Record<string, unknown>) =>
  json({ error, ...extra }, status);

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

export function route<C = unknown>(fn: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof HttpError) {
        const headers: Record<string, string> = {};
        if (e.status === 429 && typeof e.extra?.retryAfterSec === 'number') {
          headers['Retry-After'] = String(e.extra.retryAfterSec);
        }
        return json({ error: e.message, ...e.extra }, e.status, headers);
      }
      console.error('[api] unhandled error', req.method, new URL(req.url).pathname, e);
      return errorJson(500, 'Внутренняя ошибка сервера');
    }
  };
}

/** Читает и валидирует JSON-тело запроса. */
export async function parseBody<T>(req: Request, schema: ZodType<T, ZodTypeDef, unknown>): Promise<T> {
  let raw: unknown;
  try {
    const text = await req.text();
    raw = text ? JSON.parse(text) : {};
  } catch {
    throw new HttpError(400, 'Некорректный JSON в теле запроса');
  }
  try {
    return schema.parse(raw);
  } catch (e) {
    if (e instanceof ZodError) {
      const first = e.issues[0];
      throw new HttpError(400, first?.message || 'Некорректные данные запроса', {
        details: e.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    throw e;
  }
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  return (fwd?.split(',')[0] || req.headers.get('x-real-ip') || 'local').trim();
}
