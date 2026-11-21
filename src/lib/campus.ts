/**
 * V3: кампусные сервисы — Wi-Fi, лицензии, билеты, аватары.
 * Правила — specs/03_DATA_AND_SECURITY.md §V3.3–V3.5.
 */
import { createHash, randomInt } from 'node:crypto';
import type { User } from '@prisma/client';

export const WIFI_SSID = 'Orbita-Edu-5G';

/** Алфавит без похожих символов (0/O, 1/I/L) — 31 символ. */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function randomGroup(len: number): string {
  let out = '';
  for (let i = 0; i < len; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

/** Пароль Wi-Fi вида Orb-XXXX-XXXX-XXXX: 12 символов CSPRNG ≈ 59 бит энтропии. */
export const generateWifiPassword = () => `Orb-${randomGroup(4)}-${randomGroup(4)}-${randomGroup(4)}`;

/** Код билета EVT-2026-XXXX. */
export const generateTicketCode = (year: string | number) => `EVT-${year}-${randomGroup(4)}`;

// ───────────────────────── лицензии

export interface License {
  name: string;
  status: string;
  keyHint: string;
  description: string;
}

/** Маска ключа: последние 4 символа детерминированно выводятся из userId (демо, без реальных ключей). */
function keyHint(userId: string, product: string, prefix: string): string {
  const tail = createHash('sha256').update(`${product}:${userId}`).digest('hex').slice(0, 4).toUpperCase();
  return `${prefix}-••••-••••-${tail}`;
}

export function licensesFor(u: Pick<User, 'id' | 'role'>): License[] {
  const student = u.role === 'STUDENT';
  return [
    {
      name: 'JetBrains All Products Pack',
      status: 'Активна до 31.08.2027',
      keyHint: keyHint(u.id, 'jetbrains', 'JB'),
      description: 'IntelliJ IDEA Ultimate, PyCharm Professional, CLion, DataGrip и другие IDE. Вход через корпоративную почту.',
    },
    {
      name: 'GitHub Student Developer Pack',
      status: student ? 'Активна' : 'Недоступна: только для студентов',
      keyHint: student ? keyHint(u.id, 'github', 'GH') : '—',
      description: 'GitHub Pro, Copilot для студентов, домены и кредиты партнёров. Подтверждается корпоративной почтой.',
    },
    {
      name: 'Облачный грант 10 000 ₽',
      status: student ? 'Доступен: активируйте до 31.12.2026' : 'Доступен по заявке кафедры',
      keyHint: keyHint(u.id, 'cloud', 'CLD'),
      description: 'Ресурсы облачной платформы для учебных проектов и ВКР: виртуальные машины, managed-БД, объектное хранилище.',
    },
    {
      name: 'Figma Education',
      status: 'Активна',
      keyHint: keyHint(u.id, 'figma', 'FIG'),
      description: 'Профессиональный план Figma и FigJam для учебных команд и проектных курсов.',
    },
  ];
}

// ───────────────────────── аватары

export const AVATAR_MAX_BYTES = 500 * 1024;

const DATA_URI_RE = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/;

export interface DecodedAvatar {
  mime: 'image/png' | 'image/jpeg' | 'image/webp';
  bytes: Buffer;
}

/** Проверяет сигнатуру файла: заявленный тип должен совпадать с реальным содержимым. */
function signatureMatches(kind: string, b: Buffer): boolean {
  if (kind === 'png') return b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (kind === 'jpeg') return b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (kind === 'webp') return b.length > 12 && b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP';
  return false;
}

/** Разбирает и проверяет data-URI аватара. Возвращает текст ошибки или декодированное изображение. */
export function decodeAvatarDataUri(input: string): DecodedAvatar | string {
  const m = DATA_URI_RE.exec(input);
  if (!m) return 'Поддерживаются только изображения PNG, JPEG или WebP в формате data:image/…;base64';
  // Оценка размера до декодирования, чтобы не выделять память под заведомо большой файл.
  if (Math.floor((m[2].length * 3) / 4) > AVATAR_MAX_BYTES + 3) return 'Изображение больше 500 КБ — сожмите его перед загрузкой';
  const bytes = Buffer.from(m[2], 'base64');
  if (bytes.length > AVATAR_MAX_BYTES) return 'Изображение больше 500 КБ — сожмите его перед загрузкой';
  if (!signatureMatches(m[1], bytes)) return 'Содержимое файла не соответствует заявленному формату изображения';
  return { mime: `image/${m[1]}` as DecodedAvatar['mime'], bytes };
}

/** https-URL без учётных данных. */
export function validateAvatarUrl(input: string): string | null {
  if (input.length > 2048) return 'Ссылка слишком длинная';
  let u: URL;
  try {
    u = new URL(input);
  } catch {
    return 'Некорректная ссылка';
  }
  if (u.protocol !== 'https:') return 'Ссылка на аватар должна начинаться с https://';
  if (u.username || u.password) return 'Ссылка не должна содержать логин и пароль';
  return null;
}

/** Ссылка на аватар для списков: data-URI заменяется кешируемым эндпоинтом. */
export function avatarHref(u: Pick<User, 'id' | 'avatarUrl' | 'avatarUpdatedAt'>): string | null {
  if (!u.avatarUrl) return null;
  if (u.avatarUrl.startsWith('https://')) return u.avatarUrl;
  const v = u.avatarUpdatedAt ? u.avatarUpdatedAt.getTime().toString(36) : '0';
  return `/api/profile/avatar/${u.id}?v=${v}`;
}
