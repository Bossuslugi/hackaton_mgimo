/**
 * Тонкий клиент к API-контракту (specs/02_DESIGN_SYSTEM.md, приложение A).
 * Всегда credentials: 'include' — сессия живёт в httpOnly-cookie бэкенда.
 */

export const USE_MOCK = process.env.NEXT_PUBLIC_API_MOCK === '1';

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

export interface RawResponse {
  ok: boolean;
  status: number;
  statusText: string;
  body: unknown;
  durationMs: number;
}

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

async function parseBody(res: Response): Promise<unknown> {
  if (res.status === 204) return null;
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function transport(path: string, method: Method, body?: unknown): Promise<RawResponse> {
  const started = performance.now();
  if (USE_MOCK) {
    const { mockFetch } = await import('./mock/handlers');
    const r = await mockFetch(path, method, body);
    return { ...r, durationMs: Math.round(performance.now() - started) };
  }
  const res = await fetch(path, {
    method,
    credentials: 'include',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  return {
    ok: res.ok,
    status: res.status,
    statusText: res.statusText,
    body: await parseBody(res),
    durationMs: Math.round(performance.now() - started),
  };
}

function errorMessage(status: number, body: unknown): string {
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>;
    const m = b.error ?? b.message;
    if (typeof m === 'string' && m) return m;
    if (m && typeof m === 'object' && typeof (m as Record<string, unknown>).message === 'string') {
      return (m as Record<string, string>).message;
    }
  }
  if (typeof body === 'string' && body.length < 200) return body;
  if (status === 401) return 'Сессия истекла. Войдите снова.';
  if (status === 403) return 'Доступ запрещён.';
  if (status === 404) return 'Не найдено.';
  if (status >= 500) return 'Сервер временно недоступен. Попробуйте ещё раз.';
  return `Ошибка запроса (${status}).`;
}

export async function api<T = unknown>(path: string, method: Method = 'GET', body?: unknown): Promise<T> {
  let res: RawResponse;
  try {
    res = await transport(path, method, body);
  } catch {
    throw new ApiError(0, 'Нет соединения с сервером.', null);
  }
  if (!res.ok) throw new ApiError(res.status, errorMessage(res.status, res.body), res.body);
  return res.body as T;
}

/** Без исключений — для демонстрации «как ответил сервер» (IDOR-тест). */
export async function apiRaw(path: string, method: Method = 'GET', body?: unknown): Promise<RawResponse> {
  try {
    return await transport(path, method, body);
  } catch {
    return { ok: false, status: 0, statusText: 'Network Error', body: null, durationMs: 0 };
  }
}

export const get = <T = unknown>(path: string) => api<T>(path, 'GET');
export const post = <T = unknown>(path: string, body?: unknown) => api<T>(path, 'POST', body ?? {});
export const patch = <T = unknown>(path: string, body?: unknown) => api<T>(path, 'PATCH', body ?? {});
