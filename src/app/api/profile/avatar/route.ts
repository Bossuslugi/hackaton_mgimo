import { prisma } from '@/lib/prisma';
import { HttpError, json, parseBody, route } from '@/lib/http';
import { requireSession } from '@/lib/session';
import { avatarSchema } from '@/lib/validation';
import { avatarHref, decodeAvatarDataUri, validateAvatarUrl } from '@/lib/campus';

/**
 * POST /api/profile/avatar — { avatarDataUrl } (PNG/JPEG/WebP ≤ 500 КБ, сигнатура проверяется) или https-ссылка.
 * Сохраняется только для session.userId.
 */
export const POST = route(async (req) => {
  const session = await requireSession();
  const { value } = await parseBody(req, avatarSchema);

  let stored: string;
  if (value.startsWith('data:')) {
    const decoded = decodeAvatarDataUri(value);
    if (typeof decoded === 'string') throw new HttpError(400, decoded);
    // Перекодируем в канонический вид — в БД попадает только проверенный тип и байты.
    stored = `data:${decoded.mime};base64,${decoded.bytes.toString('base64')}`;
  } else {
    const err = validateAvatarUrl(value);
    if (err) throw new HttpError(400, err);
    stored = new URL(value).toString();
  }

  const user = await prisma.user.update({
    where: { id: session.userId },
    data: { avatarUrl: stored, avatarUpdatedAt: new Date() },
    select: { id: true, avatarUrl: true, avatarUpdatedAt: true },
  });
  return json({ avatarUrl: avatarHref(user), kind: stored.startsWith('data:') ? 'upload' : 'url' });
});

/** DELETE /api/profile/avatar — убрать свой аватар. */
export const DELETE = route(async () => {
  const session = await requireSession();
  await prisma.user.update({ where: { id: session.userId }, data: { avatarUrl: null, avatarUpdatedAt: new Date() } });
  return json({ ok: true, avatarUrl: null });
});
