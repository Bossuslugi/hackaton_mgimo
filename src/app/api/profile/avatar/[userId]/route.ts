import { prisma } from '@/lib/prisma';
import { errorJson, route } from '@/lib/http';
import { requireSession } from '@/lib/session';
import { decodeAvatarDataUri } from '@/lib/campus';

type Ctx = { params: Promise<{ userId: string }> };

/**
 * GET /api/profile/avatar/[userId] — байты загруженного аватара для <img>.
 * Аватар — публичная часть профиля внутри вуза (любой авторизованный). Тип берётся из повторной проверки сигнатуры.
 */
export const GET = route<Ctx>(async (_req, { params }) => {
  await requireSession();
  const { userId } = await params;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { avatarUrl: true } });
  if (!user?.avatarUrl?.startsWith('data:')) return errorJson(404, 'Аватар не найден');

  const decoded = decodeAvatarDataUri(user.avatarUrl);
  if (typeof decoded === 'string') return errorJson(404, 'Аватар не найден');

  return new Response(new Uint8Array(decoded.bytes), {
    status: 200,
    headers: {
      'Content-Type': decoded.mime,
      'Content-Length': String(decoded.bytes.length),
      'Cache-Control': 'private, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'",
    },
  });
});
