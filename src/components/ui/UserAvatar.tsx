'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';
import { initials } from '@/lib/format';

const SIZES = {
  xs: 'size-7 text-[11px]',
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-20 text-2xl',
} as const;

/**
 * Аватар пользователя: фото из avatarUrl (`/api/profile/avatar/<id>?v=…` или https),
 * при отсутствии или ошибке загрузки — инициалы на нейтральной подложке.
 */
export function UserAvatar({
  name,
  src,
  size = 'sm',
  tone = 'neutral',
  className,
  shape = 'circle',
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof SIZES;
  tone?: 'neutral' | 'brand';
  className?: string;
  shape?: 'circle' | 'card';
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const showImg = Boolean(src) && failed !== src;
  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden border font-medium',
        shape === 'circle' ? 'rounded-full' : 'rounded-lg',
        shape === 'circle' && SIZES[size],
        tone === 'brand'
          ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-400'
          : 'border-slate-200 bg-slate-100 text-slate-700 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300',
        className,
      )}
      aria-hidden
    >
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element -- приватный эндпоинт с cookie, next/image не нужен
        <img
          src={src!}
          alt=""
          className="size-full object-cover"
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setFailed(src ?? null)}
        />
      ) : (
        initials(name)
      )}
    </span>
  );
}
