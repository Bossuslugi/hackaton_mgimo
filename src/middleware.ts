/**
 * Первый рубеж защиты API (specs/03_DATA_AND_SECURITY.md §3.3):
 *  1) все /api/* кроме входа/выхода требуют валидный JWT в cookie orbita_token → иначе 401;
 *  2) изменяющие запросы с чужим Origin отклоняются → 403 (CSRF, поверх SameSite=Lax).
 * Обработчики всё равно повторно проверяют сессию — middleware не единственная линия обороны.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySession } from '@/lib/jwt';

const PUBLIC = new Set(['/api/auth/login', '/api/auth/logout']);
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const deny = (status: number, error: string) =>
  NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (MUTATING.has(req.method)) {
    const origin = req.headers.get('origin');
    const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
    if (origin && host) {
      let originHost: string | null = null;
      try {
        originHost = new URL(origin).host;
      } catch {
        originHost = null;
      }
      if (originHost !== host) return deny(403, 'Запрос с недоверенного источника отклонён (CSRF protection)');
    }
  }

  if (PUBLIC.has(pathname)) return NextResponse.next();

  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return deny(401, 'Требуется вход в систему');
  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
