'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/cn';
import { applyTheme, readTheme, type Theme } from '@/lib/theme';
import { ICON_STROKE } from '@/lib/ui';

function useTheme(): [Theme | null, (t: Theme) => void] {
  // null до монтирования: сервер не знает выбор пользователя
  const [theme, setTheme] = useState<Theme | null>(null);
  useEffect(() => {
    setTheme(readTheme());
    const on = (e: Event) => setTheme((e as CustomEvent<Theme>).detail);
    window.addEventListener('orbita-theme', on);
    return () => window.removeEventListener('orbita-theme', on);
  }, []);
  return [theme, applyTheme];
}

/** Иконка-кнопка в шапке: 44×44 на мобильном. */
export function ThemeToggle({ className }: { className?: string }) {
  const [theme, set] = useTheme();
  const next: Theme = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      onClick={() => set(next)}
      aria-label={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}
      title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
      className={cn(
        'inline-flex size-11 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 lg:size-10',
        'dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50',
        className,
      )}
    >
      {theme === 'light' ? (
        <Moon size={20} strokeWidth={ICON_STROKE} className="lg:size-[18px]" />
      ) : (
        <Sun size={20} strokeWidth={ICON_STROKE} className="lg:size-[18px]" />
      )}
    </button>
  );
}

/** Сегментированный выбор Тёмная / Светлая — для профиля. */
export function ThemeSwitch({ className }: { className?: string }) {
  const [theme, set] = useTheme();
  const opts: { value: Theme; label: string; icon: typeof Sun }[] = [
    { value: 'dark', label: 'Obsidian Dark', icon: Moon },
    { value: 'light', label: 'Светлая', icon: Sun },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="Тема интерфейса"
      className={cn('inline-flex rounded-lg bg-slate-100 p-1 dark:bg-zinc-900', className)}
    >
      {opts.map((o) => {
        const on = theme === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => set(o.value)}
            className={cn(
              'inline-flex min-h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors',
              on
                ? 'border-slate-200 bg-white text-slate-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-50',
            )}
          >
            <o.icon size={14} strokeWidth={ICON_STROKE} />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
