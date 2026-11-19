import { SESSION_COOKIE, sessionCookieOptions } from '@/lib/jwt';
import { json, route } from '@/lib/http';

export const POST = route(async () => {
  const res = json({ ok: true });
  res.cookies.set(SESSION_COOKIE, '', { ...sessionCookieOptions, maxAge: 0 });
  return res;
});
