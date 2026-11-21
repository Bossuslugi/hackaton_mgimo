/**
 * Тема интерфейса — specs/02_DESIGN_SYSTEM.md §2.6.
 * Obsidian Dark по умолчанию; выбор пользователя хранится в localStorage.
 */

export type Theme = 'dark' | 'light';

export const THEME_STORAGE_KEY = 'orbita-theme';

const THEME_COLOR: Record<Theme, string> = { dark: '#09090B', light: '#FFFFFF' };

/**
 * Выполняется в <head> до первой отрисовки: без мигания светлой темы.
 * Любая ошибка доступа к localStorage (приватный режим) → тёмная тема по умолчанию.
 */
export const THEME_BOOT_SCRIPT = `(function(){var t='dark';try{var s=localStorage.getItem('${THEME_STORAGE_KEY}');if(s==='light'||s==='dark')t=s;}catch(e){}var r=document.documentElement;r.classList.toggle('dark',t==='dark');r.style.colorScheme=t;var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',t==='dark'?'${THEME_COLOR.dark}':'${THEME_COLOR.light}');})();`;

export function readTheme(): Theme {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.add('theme-transition');
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme]);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* приватный режим — тема просто не запомнится */
  }
  window.setTimeout(() => root.classList.remove('theme-transition'), 250);
  window.dispatchEvent(new CustomEvent<Theme>('orbita-theme', { detail: theme }));
}
