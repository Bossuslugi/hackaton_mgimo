import { json, route } from '@/lib/http';
import { requireSession } from '@/lib/session';
import { serializeUser } from '@/lib/serializers';

export const GET = route(async () => {
  const { user } = await requireSession();
  return json({ user: serializeUser(user) });
});
