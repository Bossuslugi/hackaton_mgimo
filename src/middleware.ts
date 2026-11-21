/**
 * Первый рубеж защиты API и приватных страниц (specs/03_DATA_AND_SECURITY.md §3.3):
 *  1) все /api/* кроме входа/выхода требуют валидный JWT в cookie orbita_token → иначе 401;
 *  2) изменяющие запросы с чужим Origin отклоняются → 403 (CSRF, поверх SameSite=Lax);
 *  3) приватные страницы требуют авторизации → иначе редирект на /login;
 *  4) авторизованный пользователь на /login редиректится на главную /.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySession } from '@/lib/jwt';

const PUBLIC_API = new Set(['/api/auth/login', '/api/auth/logout']);
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const deny = (status: number, error: string) =>
  NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // CSRF-защита для изменяющих запросов
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

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);

  // Обработка API-маршрутов
  if (pathname.startsWith('/api')) {
    if (PUBLIC_API.has(pathname)) return NextResponse.next();
    if (!session) return deny(401, 'Требуется вход в систему');
    return NextResponse.next();
  }

  // Обработка страниц: если уже вошёл и зашёл на /login -> на главную
  if (pathname === '/login') {
    if (session) return NextResponse.redirect(new URL('/', req.url));
    return NextResponse.next();
  }

  // Защита всех приватных страниц
  if (!session) {
    const loginUrl = new URL('/login', req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/api/:path*',
    '/',
    '/schedule/:path*',
    '/study/:path*',
    '/grades/:path*',
    '/requests/:path*',
    '/profile/:path*',
    '/messages/:path*',
    '/login',
  ],
};
