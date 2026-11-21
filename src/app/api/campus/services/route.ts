import { json, route } from '@/lib/http';
import { requireSession } from '@/lib/session';
import { WIFI_SSID, licensesFor } from '@/lib/campus';

/** GET /api/campus/services — IT-доступы текущего пользователя (только владельцу, no-store). */
export const GET = route(async () => {
  const { user } = await requireSession();
  return json({
    wifiSsid: WIFI_SSID,
    wifiLogin: user.wifiLogin,
    wifiPassword: user.wifiPassword,
    wifiUpdatedAt: user.wifiUpdatedAt.toISOString(),
    corporateEmail: user.email,
    studentCardNumber: user.studentCardNumber,
    licenses: licensesFor(user),
  });
});
