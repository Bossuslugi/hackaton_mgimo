'use client';

/**
 * Живые мини-превью компонентов «Орбиты» для веб-презентации /pitch.
 * Логика взята из настоящих модулей (пороги БРС из src/lib/brs.ts, QR из src/lib/qr.ts, формат пароля Wi-Fi
 * из src/lib/campus.ts), данные — вымышленные. Цвета заданы явно (без dark:), чтобы в PDF уходил тот же вид.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  BookOpen,
  CalendarDays,
  ChartColumn,
  Check,
  Copy,
  FileText,
  LayoutDashboard,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldCheck,
  Stamp,
} from 'lucide-react';
import { QRCode } from '@/components/ui/QRCode';
import { ADMISSION_THRESHOLD, STIPEND_THRESHOLD, gradeOf } from '@/lib/brs';
import { copyText } from '@/lib/clipboard';
import { cn } from '@/lib/cn';

export const STROKE = 1.75;

// ───────────────────────── Бейдж (Obsidian Dark, без dark:-варианта)

export type Tone = 'success' | 'warning' | 'danger' | 'brand' | 'neutral';
const TONE: Record<Tone, string> = {
  success: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60',
  warning: 'bg-amber-950/60 text-amber-300 border-amber-800/60',
  danger: 'bg-red-950/60 text-red-300 border-red-800/60',
  brand: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  neutral: 'bg-zinc-900 text-zinc-400 border-zinc-800',
};

export function Tag({ tone = 'neutral', mono, children, className }: { tone?: Tone; mono?: boolean; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 text-[13px] font-medium tabular-nums',
        mono && 'font-mono text-[12px]',
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Карточка Obsidian Dark: #12141A + рамка #27272A. */
export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('rounded-xl border border-zinc-800 bg-[#12141A]', className)}>{children}</div>;
}

const BTN =
  'inline-flex min-h-9 shrink-0 whitespace-nowrap items-center justify-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition-[transform,background-color] duration-150 active:scale-[0.97] motion-reduce:transition-none';
const BTN_PRIMARY = `${BTN} bg-blue-500 text-white hover:bg-blue-600`;
const BTN_SECONDARY = `${BTN} border border-zinc-800 bg-zinc-900 text-zinc-200 hover:bg-zinc-800`;

// ───────────────────────── «Фокус дня» на телефоне

function useCountdown(seconds: number) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    const end = Date.now() + seconds * 1000;
    const t = setInterval(() => setLeft(Math.max(0, Math.round((end - Date.now()) / 1000))), 1000);
    return () => clearInterval(t);
  }, [seconds]);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(Math.floor(left / 3600))}:${p(Math.floor((left % 3600) / 60))}:${p(left % 60)}`;
}

export function FocusPhone() {
  const timer = useCountdown(5 * 3600 + 42 * 60 + 10);
  const tabs = [LayoutDashboard, CalendarDays, BookOpen, ChartColumn, FileText];
  return (
    <div className="flex h-[478px] w-[280px] flex-col overflow-hidden rounded-[30px] border border-zinc-700 bg-zinc-950">
      <div className="flex items-baseline justify-between px-5 pb-2.5 pt-5">
        <span className="text-[17px] font-semibold text-zinc-50">Сводка</span>
        <span className="text-[12px] text-zinc-500">чт, 26 ноября</span>
      </div>
      <div className="flex flex-col gap-2 px-3.5">
        <Panel className="p-3.5">
          <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            Следующая пара · <span className="tabular-nums">11:40</span>
          </p>
          <p className="mt-1.5 text-[14px] font-semibold text-zinc-50">Алгоритмы и структуры данных</p>
          <div className="mt-2.5 flex items-center gap-2 text-[12px] text-zinc-400">
            <Tag tone="warning" className="text-[11px]">Перенос</Tag>
            <span className="tabular-nums">Ауд. 405 → Лаб. 105</span>
          </div>
        </Panel>
        <Panel className="p-3.5">
          <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Горящий дедлайн</p>
          <p className="mt-1.5 text-[13px] text-zinc-100">Лабораторная №3 · Алгоритмы</p>
          <Tag tone="danger" mono className="mt-2.5">{timer}</Tag>
        </Panel>
        <div className="grid grid-cols-2 gap-2.5">
          <Panel className="p-3.5">
            <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Средний балл</p>
            <p className="mt-1 text-[30px] font-semibold leading-none tracking-tight text-zinc-50 tabular-nums">91</p>
          </Panel>
          <Panel className="p-3.5">
            <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Справка</p>
            <Tag tone="brand" className="mt-2.5 text-[11px]">На проверке</Tag>
          </Panel>
        </div>
      </div>
      <div className="mt-auto flex h-14 shrink-0 items-center justify-around border-t border-zinc-800 bg-[#12141A]/80">
        {tabs.map((Icon, i) => (
          <Icon key={i} size={20} strokeWidth={STROKE} className={i === 0 ? 'text-blue-400' : 'text-zinc-500'} aria-hidden />
        ))}
      </div>
    </div>
  );
}

// ───────────────────────── Симулятор БРС «Что если?»

const SIM_BASE = { labs: 14, rk: 12, attendance: 16 } as const;
const SIM_MAX = { labs: 40, rk: 40, attendance: 20 } as const;
const SIM_ROWS = [
  ['labs', 'Лабораторные'],
  ['rk', 'Рубежный контроль'],
  ['attendance', 'Посещаемость'],
] as const;

export function BrsSimulator() {
  const [add, setAdd] = useState({ labs: 10, rk: 10, attendance: 0 });
  const base = SIM_BASE.labs + SIM_BASE.rk + SIM_BASE.attendance;
  const total = base + add.labs + add.rk + add.attendance;
  const grade = gradeOf(total);
  const toAdmission = Math.max(0, ADMISSION_THRESHOLD - total);
  const toExcellent = Math.max(0, STIPEND_THRESHOLD - total);

  return (
    <Panel className="flex h-full flex-col p-6" >
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">Симулятор «Что если?» · живой</p>
      <p className="mt-2 text-[19px] font-semibold text-zinc-50">Математический анализ</p>
      <div className="mt-3 flex items-baseline gap-3 tabular-nums">
        <span className="text-[44px] font-semibold leading-none tracking-tight text-zinc-500">{base}</span>
        <span className="text-[22px] text-zinc-600">→</span>
        <span className="text-[44px] font-semibold leading-none tracking-tight text-zinc-50">{total}</span>
        <span className="text-[17px] text-zinc-500">/ 100</span>
      </div>

      <div className="relative mt-6">
        <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full origin-left rounded-full bg-blue-500 transition-transform duration-200 motion-reduce:transition-none"
            style={{ transform: `scaleX(${total / 100})` }}
          />
        </div>
        {[
          [ADMISSION_THRESHOLD, `допуск ${ADMISSION_THRESHOLD}`],
          [STIPEND_THRESHOLD, `отлично ${STIPEND_THRESHOLD}`],
        ].map(([v, label]) => (
          <div key={label} className="absolute top-[-5px] flex -translate-x-1/2 flex-col items-center" style={{ left: `${v}%` }}>
            <span className="h-[18px] w-px bg-zinc-400" />
            <span className="mt-1 whitespace-nowrap text-[11px] text-zinc-500 tabular-nums">{label}</span>
          </div>
        ))}
      </div>

      <div className="mt-9 flex flex-col gap-3">
        {SIM_ROWS.map(([key, label]) => {
          const room = SIM_MAX[key] - SIM_BASE[key];
          const value = add[key];
          return (
            <label key={key} className="block" data-interactive>
              <span className="flex items-baseline justify-between text-[13px]">
                <span className="text-zinc-400">{label}</span>
                <span className="font-mono tabular-nums text-zinc-500">
                  {SIM_BASE[key] + value}/{SIM_MAX[key]}{' '}
                  <span className={value ? 'text-blue-400' : 'text-zinc-600'}>+{value}</span>
                </span>
              </span>
              <input
                type="range"
                min={0}
                max={room}
                value={value}
                onChange={(e) => setAdd((a) => ({ ...a, [key]: Number(e.target.value) }))}
                className="range -my-3 w-full"
                style={{ ['--fill' as string]: `${(value / room) * 100}%` }}
                aria-label={`Добрать баллов: ${label}`}
              />
            </label>
          );
        })}
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
        {toAdmission > 0 ? (
          <Tag tone="danger">Не хватает {toAdmission} до допуска</Tag>
        ) : (
          <Tag tone="success">Допуск получен</Tag>
        )}
        <Tag tone={grade.tone}>{grade.label}</Tag>
        {toAdmission === 0 && toExcellent > 0 && <Tag>до «отлично» {toExcellent}</Tag>}
        {toExcellent === 0 && <Tag tone="success">Стипендия сохраняется</Tag>}
      </div>
    </Panel>
  );
}

// ───────────────────────── Справка с ЭЦП и QR: два касания студента + подпись деканата

const CERT_STEPS = ['Создана', 'На проверке', 'Подписано ЭЦП'] as const;

export function CertificateDemo() {
  // По умолчанию — итоговое состояние: так бланк с QR попадает и в PDF
  const [step, setStep] = useState(2);
  const registry = 'ОРБ-2026-0042';

  return (
    <div className="flex h-full flex-col gap-4">
      <Panel className="p-5">
        <ol className="flex items-center gap-2">
          {CERT_STEPS.map((label, i) => (
            <li key={label} className={cn('flex items-center gap-2', i < 2 && 'flex-1')}>
              <span
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold tabular-nums',
                  i <= step ? 'border-blue-500 bg-blue-500 text-white' : 'border-zinc-700 text-zinc-500',
                )}
              >
                {i < step || step === 2 ? <Check size={13} strokeWidth={2.25} aria-hidden /> : i + 1}
              </span>
              <span className={cn('whitespace-nowrap text-[12px]', i <= step ? 'text-zinc-100' : 'text-zinc-500')}>{label}</span>
              {i < 2 && <span className={cn('h-px flex-1', i < step ? 'bg-blue-500' : 'bg-zinc-800')} />}
            </li>
          ))}
        </ol>
        <div className="mt-4 flex items-center justify-between gap-3" data-interactive>
          {step === 0 && (
            <>
              <span className="text-[13px] text-zinc-400">Студент · справка об обучении</span>
              <button type="button" className={BTN_PRIMARY} onClick={() => setStep(1)}>
                <Send size={15} strokeWidth={STROKE} aria-hidden /> Отправить заявку
              </button>
            </>
          )}
          {step === 1 && (
            <>
              <span className="text-[13px] text-zinc-400">Деканат · очередь заявок</span>
              <button type="button" className={BTN_PRIMARY} onClick={() => setStep(2)}>
                <Stamp size={15} strokeWidth={STROKE} aria-hidden /> Одобрить и подписать ЭЦП
              </button>
            </>
          )}
          {step === 2 && (
            <>
              <span className="text-[13px] text-emerald-300">Готово — справка у студента</span>
              <button type="button" className={BTN_SECONDARY} onClick={() => setStep(0)} data-no-print>
                <RotateCcw size={15} strokeWidth={STROKE} aria-hidden /> Пройти заново
              </button>
            </>
          )}
        </div>
      </Panel>

      {/* Бланк всегда светлый, как печатная справка в приложении */}
      <div className="relative flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white p-6 text-slate-900">
        <p className="text-[13px] font-semibold uppercase tracking-[0.08em]">Справка об обучении</p>
        <p className="mt-1 font-mono text-[12px] text-slate-500 tabular-nums">№ {step === 2 ? registry : '— присваивается при подписи'}</p>
        <div className="my-4 h-px bg-slate-200" />
        <p className="text-[13px] leading-relaxed text-slate-700">
          Дана Соколову Алексею Дмитриевичу в том, что он действительно обучается на 2 курсе, группа{' '}
          <span className="tabular-nums">М3203</span>, форма обучения — очная, бюджет.
        </p>
        <div className="mt-5 flex items-center gap-5">
          <div className={cn('transition-opacity duration-300 motion-reduce:transition-none', step === 2 ? 'opacity-100' : 'opacity-15')}>
            <QRCode value={`https://orbita.example/verify/${registry}`} size={112} title="QR-код проверки справки" />
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-[12px] text-slate-500">Сканируйте, чтобы проверить подлинность</p>
            {step === 2 ? (
              <span className="inline-flex w-fit items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[12px] font-medium text-emerald-700">
                <ShieldCheck size={13} strokeWidth={STROKE} aria-hidden /> Подписано ЭЦП
              </span>
            ) : (
              <span className="inline-flex w-fit rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[12px] font-medium text-slate-500">
                Ожидает подписи
              </span>
            )}
          </div>
        </div>
        <p className="absolute bottom-4 left-6 text-[11px] text-slate-400">Данные вымышлены · демо-бланк</p>
      </div>
    </div>
  );
}

// ───────────────────────── Генератор пароля Wi-Fi (формат и алфавит как в src/lib/campus.ts)

const WIFI_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function secureIndex(n: number): number {
  // Отбрасывание выборки без смещения: берём байты, пока значение не попадёт в кратный n диапазон
  const limit = 256 - (256 % n);
  const buf = new Uint8Array(1);
  do crypto.getRandomValues(buf);
  while (buf[0] >= limit);
  return buf[0] % n;
}
const group = () => Array.from({ length: 4 }, () => WIFI_ALPHABET[secureIndex(WIFI_ALPHABET.length)]).join('');

export function WifiGenerator() {
  const [pwd, setPwd] = useState('Orb-K7QM-2XRA-H9TD');
  const [copied, setCopied] = useState(false);
  const [n, setN] = useState(0);

  return (
    <div className="mt-3 flex flex-col gap-2" data-interactive>
      <div className="flex items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2">
        <span key={n} className="font-mono text-[14px] tracking-wide text-zinc-50 tabular-nums [animation:pop_.3s_ease-out]">
          {pwd}
        </span>
        <button
          type="button"
          aria-label="Скопировать пароль"
          className="flex size-7 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          onClick={async () => {
            if (await copyText(pwd)) {
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            }
          }}
        >
          {copied ? <Check size={14} strokeWidth={STROKE} aria-hidden /> : <Copy size={14} strokeWidth={STROKE} aria-hidden />}
        </button>
      </div>
      <button
        type="button"
        className={cn(BTN_SECONDARY, 'w-fit')}
        onClick={() => {
          setPwd(`Orb-${group()}-${group()}-${group()}`);
          setN((x) => x + 1);
        }}
      >
        <RefreshCw size={14} strokeWidth={STROKE} aria-hidden /> Сгенерировать новый
      </button>
    </div>
  );
}

// ───────────────────────── Живой IDOR-тест против настоящего API

type Probe = { state: 'idle' } | { state: 'loading' } | { state: 'done'; status: number; ms: number } | { state: 'error' };

const PROBE_EXPLAIN: Record<number, { tone: Tone; text: string }> = {
  401: { tone: 'warning', text: 'Вы не вошли: middleware отклоняет запрос без HttpOnly-токена ещё до обработчика.' },
  403: { tone: 'danger', text: 'Вы вошли, но заявка не ваша: чужой и несуществующий id дают одинаковый 403.' },
  404: { tone: 'neutral', text: 'Вы вошли как сотрудник деканата: ему видны все заявки, а этой просто нет.' },
};

export function IdorProbe() {
  const [probe, setProbe] = useState<Probe>({ state: 'idle' });

  async function run() {
    setProbe({ state: 'loading' });
    const t0 = performance.now();
    try {
      const res = await fetch('/api/requests/99999', { credentials: 'include', cache: 'no-store' });
      setProbe({ state: 'done', status: res.status, ms: Math.round(performance.now() - t0) });
    } catch {
      setProbe({ state: 'error' });
    }
  }

  const explain = probe.state === 'done' ? PROBE_EXPLAIN[probe.status] : undefined;
  return (
    <div className="flex flex-col gap-3" data-interactive>
      <div className="flex items-center gap-3">
        <code className="flex-1 truncate rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-[13px] text-zinc-200">
          GET /api/requests/99999
        </code>
        <button type="button" className={BTN_PRIMARY} onClick={run} disabled={probe.state === 'loading'}>
          {probe.state === 'loading' ? 'Запрос…' : 'Отправить'}
        </button>
      </div>
      <div className="min-h-[52px] text-[13px]">
        {probe.state === 'idle' && <p className="text-zinc-500">Настоящий запрос к API этого стенда, с вашими cookie.</p>}
        {probe.state === 'error' && <p className="text-zinc-500">Сервер недоступен — откройте /pitch на запущенном стенде.</p>}
        {probe.state === 'done' && (
          <div className="flex items-start gap-3">
            <Tag tone={explain?.tone ?? 'neutral'} mono className="text-[13px]">
              {probe.status} · <span className="tabular-nums">{probe.ms} мс</span>
            </Tag>
            <p className="text-zinc-400">{explain?.text ?? 'Неожиданный ответ сервера.'}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ───────────────────────── SDD-пайплайн: шаги подсвечиваются по кругу, клик — описание

export const SDD_STAGES = [
  { key: 'spec', title: 'Контракт в /specs', text: 'PRD, дизайн-система, данные и безопасность, API — единственный источник истины для людей и агентов.' },
  { key: 'a', title: 'Stream A · Backend & Security', text: 'Prisma-схема и seed → /api с zod → JWT, bcrypt, IDOR, rate limit. Зона: prisma/**, src/lib/**, src/app/api/**.' },
  { key: 'b', title: 'Stream B · Design & Frontend', text: 'UI-кит → экраны и Copilot → normalize.ts и моки API. Зона: src/app/(app)/**, src/components/**.' },
  { key: 'audit', title: 'Независимый ИИ-аудит', text: 'Отдельный агент сверяет код со спеками, ищет рассинхроны и уязвимости. Отчёты V1 и V2 — в ai-docs/.' },
  { key: 'fix', title: 'Исправление → правка спеки', text: 'Дефект чинится в коде и в контракте одновременно. Затем следующая итерация: V1 → V2 → V3.' },
] as const;

export function useSddCycle() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setActive((a) => (a + 1) % SDD_STAGES.length), 2200);
    return () => clearInterval(t);
  }, [paused]);
  return useMemo(
    () => ({ active, select: (i: number) => { setActive(i); setPaused(true); }, paused, resume: () => setPaused(false) }),
    [active, paused],
  );
}

// ───────────────────────── Кнопка копирования для таблицы аккаунтов

export function CopyCell({ value }: { value: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      data-interactive
      onClick={async () => {
        if (await copyText(value)) {
          setOk(true);
          setTimeout(() => setOk(false), 1200);
        }
      }}
      className="group inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-left font-mono text-[13px] text-zinc-100 hover:bg-zinc-800"
      aria-label={`Скопировать ${value}`}
    >
      {value}
      <span className="text-zinc-600 group-hover:text-zinc-300" data-no-print>
        {ok ? <Check size={12} strokeWidth={STROKE} aria-hidden /> : <Copy size={12} strokeWidth={STROKE} aria-hidden />}
      </span>
    </button>
  );
}
