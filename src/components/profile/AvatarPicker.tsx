'use client';

import { useRef, useState } from 'react';
import { Camera, ImageUp, Trash2 } from 'lucide-react';
import { useSession } from '@/components/shell/SessionProvider';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { useToast } from '@/components/ui/Toast';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { api, ApiError, post } from '@/lib/api';
import { cn } from '@/lib/cn';
import { initials } from '@/lib/format';
import { ICON_STROKE } from '@/lib/ui';

const SIZE = 256;
const MAX_INPUT_BYTES = 15 * 1024 * 1024;

/** Плоские монограммы без градиентов (анти-вайбкод §1): фон + цвет инициалов. */
const PRESETS = [
  { id: 'blue', bg: '#2563EB', fg: '#FFFFFF', label: 'Синяя' },
  { id: 'teal', bg: '#0D9488', fg: '#FFFFFF', label: 'Бирюзовая' },
  { id: 'graphite', bg: '#18181B', fg: '#FAFAFA', label: 'Графит' },
  { id: 'paper', bg: '#F1F5F9', fg: '#0F172A', label: 'Светлая' },
] as const;

/** Центрированный квадратный кроп и сжатие до 256×256 JPEG. */
async function compress(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  const src: CanvasImageSource & { width: number; height: number } =
    bitmap ??
    (await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Не удалось прочитать изображение'));
      img.src = URL.createObjectURL(file);
    }));
  const side = Math.min(src.width, src.height);
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas недоступен');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, (src.width - side) / 2, (src.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  bitmap?.close();
  return canvas.toDataURL('image/jpeg', 0.85);
}

function monogram(name: string, bg: string, fg: string): string {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.fillStyle = fg;
  ctx.font = `600 ${SIZE * 0.4}px Inter, ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(initials(name), SIZE / 2, SIZE / 2 + SIZE * 0.02);
  return canvas.toDataURL('image/png');
}

/** Аватар профиля с кнопкой камеры «Изменить фото». */
export function AvatarEditor({ className }: { className?: string }) {
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  return (
    <div className={cn('relative inline-flex', className)}>
      <UserAvatar name={user.fullName} src={user.avatarUrl} size="lg" />
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Изменить фото"
        title="Изменить фото"
        className="absolute -bottom-1 -right-1 inline-flex size-9 items-center justify-center rounded-full border-2 border-white bg-blue-600 text-white transition-transform active:scale-95 dark:border-[#12141A] dark:bg-blue-500"
      >
        <Camera size={16} strokeWidth={ICON_STROKE} />
      </button>
      <AvatarSheet open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

export function AvatarSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, patchUser } = useSession();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  async function upload(dataUrl: string, key: string) {
    setBusy(key);
    setPreview(dataUrl);
    const prev = user.avatarUrl;
    patchUser({ avatarUrl: dataUrl }); // мгновенно в шапке, профиле и студбилете
    try {
      const raw = (await post('/api/profile/avatar', { avatarDataUrl: dataUrl })) as { avatarUrl?: string } | null;
      patchUser({ avatarUrl: raw?.avatarUrl ?? dataUrl });
      toast.success('Фото профиля обновлено');
      onClose();
    } catch (e) {
      patchUser({ avatarUrl: prev ?? null });
      toast.error('Не удалось сохранить фото', e instanceof ApiError ? e.message : undefined);
    } finally {
      setBusy(null);
      setPreview(null);
    }
  }

  async function onFile(f: File | undefined) {
    if (!f) return;
    if (!f.type.startsWith('image/') || f.type === 'image/svg+xml') {
      toast.error('Нужна фотография', 'Подойдут JPEG, PNG, WebP или HEIC.');
      return;
    }
    if (f.size > MAX_INPUT_BYTES) {
      toast.error('Файл слишком большой', 'Выберите изображение до 15 МБ.');
      return;
    }
    try {
      await upload(await compress(f), 'file');
    } catch (e) {
      toast.error('Не удалось обработать фото', e instanceof Error ? e.message : undefined);
    }
  }

  async function remove() {
    setBusy('remove');
    try {
      await api('/api/profile/avatar', 'DELETE');
      patchUser({ avatarUrl: null });
      toast.info('Фото удалено', 'Вместо фото показываются инициалы.');
      onClose();
    } catch (e) {
      toast.error('Не удалось удалить фото', e instanceof ApiError ? e.message : undefined);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Фото профиля"
      description="Появится в шапке, профиле и электронном студенческом билете"
      footer={
        user.avatarUrl ? (
          <Button variant="danger" onClick={() => void remove()} loading={busy === 'remove'} icon={<Trash2 size={16} strokeWidth={ICON_STROKE} />} className="min-h-11 sm:mr-auto sm:min-h-0">
            Удалить фото
          </Button>
        ) : undefined
      }
    >
      <div className="flex items-center gap-4">
        <UserAvatar name={user.fullName} src={preview ?? user.avatarUrl} size="lg" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-900 dark:text-zinc-50">{user.fullName}</p>
          <p className="text-xs text-slate-500 dark:text-zinc-400">Фото сжимается на устройстве до 256×256 перед отправкой</p>
        </div>
      </div>

      <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={(e) => void onFile(e.target.files?.[0]).finally(() => (e.target.value = ''))} />
      <Button
        block
        size="lg"
        onClick={() => fileRef.current?.click()}
        loading={busy === 'file'}
        disabled={busy !== null && busy !== 'file'}
        icon={<ImageUp size={16} strokeWidth={ICON_STROKE} />}
        className="mt-5"
      >
        Загрузить фото с устройства
      </Button>

      <p className="mb-2 mt-5 text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-400">Или монограмма в 1 клик</p>
      <ul className="grid grid-cols-4 gap-3">
        {PRESETS.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void upload(monogram(user.fullName, p.bg, p.fg), p.id)}
              aria-label={`Монограмма: ${p.label}`}
              className="group flex w-full flex-col items-center gap-1.5 disabled:opacity-60"
            >
              <span
                className={cn(
                  'flex aspect-square w-full max-w-20 items-center justify-center rounded-full border border-slate-200 text-lg font-semibold transition-transform group-active:scale-95 dark:border-zinc-700',
                  busy === p.id && 'animate-pulse',
                )}
                style={{ background: p.bg, color: p.fg }}
              >
                {initials(user.fullName)}
              </span>
              <span className="text-xs text-slate-500 dark:text-zinc-400">{p.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
