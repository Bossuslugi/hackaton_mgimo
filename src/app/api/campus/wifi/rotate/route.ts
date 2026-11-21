import { prisma } from '@/lib/prisma';
import { HttpError, json, route } from '@/lib/http';
import { requireSession } from '@/lib/session';
import { hit } from '@/lib/rate-limit';
import { WIFI_SSID, generateWifiPassword } from '@/lib/campus';

/** POST /api/campus/wifi/rotate — новый CSPRNG-пароль Wi-Fi для session.userId (не чаще 5 раз в час). */
export const POST = route(async () => {
  const session = await requireSession();
  const limit = hit(`wifi:${session.userId}`, 5, 60 * 60 * 1000);
  if (!limit.ok) throw new HttpError(429, 'Пароль Wi-Fi можно менять не чаще 5 раз в час', { retryAfterSec: limit.retryAfterSec });

  const user = await prisma.user.update({
    where: { id: session.userId },
    data: { wifiPassword: generateWifiPassword(), wifiUpdatedAt: new Date() },
    select: { wifiLogin: true, wifiPassword: true, wifiUpdatedAt: true },
  });
  return json({
    wifiSsid: WIFI_SSID,
    wifiLogin: user.wifiLogin,
    wifiPassword: user.wifiPassword,
    wifiUpdatedAt: user.wifiUpdatedAt.toISOString(),
  });
});
