'use client';

/**
 * Плеер веб-презентации /pitch.
 * Экран: холст 1280×720 масштабируется под окно, видим один слайд; ← / → / пробел, клик (левая треть — назад),
 * свайп, Home / End, F — полный экран. Номер слайда синхронизирован с #hash.
 * Печать («Сохранить в PDF»): все 10 слайдов уходят на страницы 16:9 без масштабирования — см. globals.css, блок /pitch.
 */
import Link from 'next/link';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Maximize, Minimize, RotateCcw, Smartphone } from 'lucide-react';
import { LogoMark } from '@/components/brand/Logo';
import { cn } from '@/lib/cn';
import { STROKE } from './live';
import { SLIDES, TOTAL } from './slides';

const W = 1280;
const H = 720;
const pad = (n: number) => String(n).padStart(2, '0');

const ICON_BTN =
  'inline-flex size-11 items-center justify-center rounded-lg text-zinc-400 transition-[transform,background-color,color] duration-150 hover:bg-zinc-900 hover:text-zinc-50 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-30 motion-reduce:transition-none';

export function PitchDeck() {
  const [index, setIndex] = useState(0);
  const [scale, setScale] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);

  const go = useCallback((i: number) => setIndex(Math.min(TOTAL - 1, Math.max(0, i))), []);
  const next = useCallback(() => setIndex((i) => Math.min(TOTAL - 1, i + 1)), []);
  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  // #3 в адресе открывает третий слайд; при листании адрес обновляется без записи в историю
  useEffect(() => {
    const fromHash = () => {
      const n = Number(window.location.hash.slice(1));
      if (Number.isInteger(n) && n >= 1 && n <= TOTAL) setIndex(n - 1);
    };
    fromHash();
    window.addEventListener('hashchange', fromHash);
    return () => window.removeEventListener('hashchange', fromHash);
  }, []);
  useEffect(() => {
    window.history.replaceState(null, '', `#${index + 1}`);
  }, [index]);

  // Масштаб холста под размер сцены
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const fit = () => setScale(Math.min(el.clientWidth / W, el.clientHeight / H));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => undefined);
  }, []);
  useEffect(() => {
    const on = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);

  // Клавиатура. Если фокус в поле ввода (ползунок симулятора) — стрелки остаются ему.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      switch (e.key) {
        case 'ArrowRight':
        case 'PageDown':
        case ' ':
          e.preventDefault();
          next();
          break;
        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault();
          prev();
          break;
        case 'Home':
          go(0);
          break;
        case 'End':
          go(TOTAL - 1);
          break;
        case 'f':
        case 'F':
          toggleFullscreen();
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, next, prev, toggleFullscreen]);

  const isInteractive = (t: EventTarget | null) =>
    t instanceof Element && Boolean(t.closest('button, a, input, label, select, textarea, [data-interactive]'));

  const onStageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isInteractive(e.target) || window.getSelection()?.toString()) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (e.clientX - rect.left < rect.width / 3) prev();
    else next();
  };

  const onTouchStart = (e: React.TouchEvent) => {
    touch.current = isInteractive(e.target) ? null : { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touch.current;
    touch.current = null;
    if (!start) return;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.2) (dx < 0 ? next : prev)();
  };

  const savePdf = () => {
    // Имя PDF по умолчанию берётся из заголовка документа
    const title = document.title;
    document.title = 'Orbita_Presentation';
    window.addEventListener('afterprint', () => (document.title = title), { once: true });
    window.print();
  };

  return (
    <div className="pitch-root fixed inset-0 flex flex-col bg-zinc-950 text-zinc-50">
      {/* Прогресс: scaleX, а не width — только GPU-свойства (spec §2.7) */}
      <div className="h-0.5 w-full bg-zinc-900" data-no-print>
        <div
          className="h-full origin-left bg-blue-500 transition-transform duration-300 ease-out motion-reduce:transition-none"
          style={{ transform: `scaleX(${(index + 1) / TOTAL})` }}
        />
      </div>

      {/* Подсказка для телефона в портретной ориентации */}
      <p className="pitch-rotate-hint hidden items-center justify-center gap-2 px-4 pt-3 text-center text-[12px] text-zinc-500" data-no-print>
        <Smartphone size={14} strokeWidth={STROKE} className="shrink-0 rotate-90" aria-hidden />
        Поверните телефон горизонтально — слайды 16:9 станут крупнее
      </p>

      <div
        ref={stageRef}
        className="pitch-stage relative min-h-0 flex-1 cursor-pointer select-none overflow-hidden"
        onClick={onStageClick}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        aria-roledescription="карусель"
        aria-label="Презентация «Орбита»"
      >
        <div
          className="pitch-canvas absolute left-1/2 top-1/2"
          data-print-root
          style={{ width: W, height: H, transform: `translate(-50%, -50%) scale(${scale})`, opacity: scale ? 1 : 0 }}
        >
          {SLIDES.map(({ title, Component }, i) => (
            <section
              key={title}
              className={cn(
                'pitch-slide absolute inset-0 overflow-hidden rounded-xl border border-zinc-900 bg-zinc-950',
                i === index ? 'pitch-slide-active block' : 'hidden',
              )}
              aria-roledescription="слайд"
              aria-label={`${i + 1} из ${TOTAL}: ${title}`}
              aria-hidden={i !== index}
            >
              <Component />
            </section>
          ))}
        </div>
      </div>

      <nav className="flex h-16 shrink-0 items-center gap-1 px-2 sm:gap-2 sm:px-4" data-no-print aria-label="Управление презентацией">
        <Link href="/" className="mr-auto inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-[13px] text-zinc-400 hover:text-zinc-50" aria-label="Открыть приложение">
          <LogoMark size={22} className="text-zinc-300" />
          <span className="hidden sm:inline">Открыть приложение</span>
        </Link>

        <button type="button" className={ICON_BTN} onClick={prev} disabled={index === 0} aria-label="Предыдущий слайд">
          <ChevronLeft size={20} strokeWidth={STROKE} aria-hidden />
        </button>
        <div className="flex min-w-[88px] flex-col items-center leading-tight" aria-live="polite">
          <span className="font-mono text-[14px] text-zinc-50 tabular-nums">
            {pad(index + 1)} <span className="text-zinc-600">/</span> {pad(TOTAL)}
          </span>
          <span className="hidden max-w-[220px] truncate text-[11px] text-zinc-500 md:block">{SLIDES[index].title}</span>
        </div>
        <button type="button" className={ICON_BTN} onClick={next} disabled={index === TOTAL - 1} aria-label="Следующий слайд">
          <ChevronRight size={20} strokeWidth={STROKE} aria-hidden />
        </button>

        <div className="ml-auto flex items-center gap-1">
          {index > 0 && (
            <button type="button" className={cn(ICON_BTN, 'max-sm:hidden')} onClick={() => go(0)} aria-label="К первому слайду">
              <RotateCcw size={18} strokeWidth={STROKE} aria-hidden />
            </button>
          )}
          <button type="button" className={ICON_BTN} onClick={toggleFullscreen} aria-label={fullscreen ? 'Выйти из полноэкранного режима' : 'Полноэкранный режим'}>
            {fullscreen ? <Minimize size={18} strokeWidth={STROKE} aria-hidden /> : <Maximize size={18} strokeWidth={STROKE} aria-hidden />}
          </button>
          <button
            type="button"
            onClick={savePdf}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-500 px-3 text-[13px] font-medium text-white transition-[transform,background-color] duration-150 hover:bg-blue-600 active:scale-[0.97] motion-reduce:transition-none sm:px-4"
          >
            <Download size={16} strokeWidth={STROKE} aria-hidden />
            <span className="max-sm:sr-only">Сохранить в PDF</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
