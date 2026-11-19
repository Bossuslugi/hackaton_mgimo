import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/password';
import { signSession, SESSION_COOKIE, sessionCookieOptions } from '@/lib/jwt';
import { HttpError, clientIp, json, parseBody, route } from '@/lib/http';
import { loginSchema } from '@/lib/validation';
import { hit, isBlocked, reset } from '@/lib/rate-limit';
import { serializeUser } from '@/lib/serializers';

const MAX_FAILS = 5;
const WINDOW_MS = 15 * 60 * 1000;

export const POST = route(async (req) => {
  const { email, password } = await parseBody(req, loginSchema);
  const key = `login:${clientIp(req)}:${email}`;

  const blocked = isBlocked(key, MAX_FAILS);
  if (!blocked.ok) {
    throw new HttpError(429, 'Слишком много попыток входа. Попробуйте позже.', { retryAfterSec: blocked.retryAfterSec });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  const valid = await verifyPassword(password, user?.passwordHash);
  if (!user || !valid) {
    hit(key, MAX_FAILS, WINDOW_MS);
    throw new HttpError(401, 'Неверный email или пароль');
  }

  reset(key);
  const token = await signSession({ userId: user.id, role: user.role as 'STUDENT' | 'ADMIN' });
  const res = json({ user: serializeUser(user) });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  return res;
});
