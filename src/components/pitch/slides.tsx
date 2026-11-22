'use client';

/**
 * Слайды веб-презентации /pitch. Холст фиксирован — 1280×720 (16:9), плеер масштабирует его под экран,
 * а в PDF каждая страница печатается 1:1. Содержание совпадает с Orbita_Presentation.pptx.
 */
import type { ComponentType, ReactNode } from 'react';
import {
  ArrowRightLeft,
  Armchair,
  BookOpen,
  BookOpenCheck,
  CalendarDays,
  Bug,
  Building2,
  ChartColumn,
  Clock,
  Container,
  Cookie,
  Dumbbell,
  FilePen,
  FileText,
  GraduationCap,
  Inbox,
  Info,
  KeyRound,
  MapPin,
  MessagesSquare,
  Monitor,
  Palette,
  Presentation,
  ScanLine,
  ScanSearch,
  Server,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  SquareCode,
  Stamp,
  Ticket,
  Wifi,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { LogoMark } from '@/components/brand/Logo';
import { cn } from '@/lib/cn';
import {
  BrsSimulator,
  CertificateDemo,
  CopyCell,
  FocusPhone,
  IdorProbe,
  Panel,
  SDD_STAGES,
  STROKE,
  Tag,
  WifiGenerator,
  useSddCycle,
  type Tone,
} from './live';

export const TOTAL = 10;

// ───────────────────────── Каркас слайда

function Icon({ as: I, className, size = 22 }: { as: LucideIcon; className?: string; size?: number }) {
  return <I size={size} strokeWidth={STROKE} className={cn('shrink-0', className)} aria-hidden />;
}

function Frame({ n, eyebrow, title, children }: { n: number; eyebrow: string; title: string; children: ReactNode }) {
  return (
    <div className="flex h-full flex-col px-16 pb-8 pt-12">
      <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-blue-400">{eyebrow}</p>
      <h2 className="mt-2 text-[40px] font-semibold leading-tight tracking-tight text-zinc-50">{title}</h2>
      <div className="mt-8 min-h-0 flex-1">{children}</div>
      <footer className="mt-6 flex items-center justify-between text-[12px] text-zinc-500">
        <span className="flex items-center gap-2">
          <LogoMark size={18} className="text-zinc-400" />
          Орбита · Цифровой деканат будущего · конкурсный прототип
        </span>
        <span className="tabular-nums">{String(n).padStart(2, '0')}</span>
      </footer>
    </div>
  );
}

function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500', className)}>{children}</p>;
}

function FeatureCard({ icon, title, text, tag, className }: { icon: LucideIcon; title: string; text: string; tag?: ReactNode; className?: string }) {
  return (
    <Panel className={cn('flex flex-col p-6', className)}>
      <div className="flex items-start justify-between gap-3">
        <Icon as={icon} className="text-blue-400" />
        {tag}
      </div>
      <h3 className="mt-4 text-[18px] font-semibold text-zinc-50">{title}</h3>
      <p className="mt-2 text-[14px] leading-relaxed text-zinc-400">{text}</p>
    </Panel>
  );
}

// ───────────────────────── 01 · Титульный

function S1() {
  return (
    <div className="relative flex h-full flex-col overflow-hidden px-16 py-14">
      {/* Крупный знак-орбита: штрих цвета рамки, без свечения и градиентов */}
      <svg viewBox="0 0 32 32" fill="none" className="pointer-events-none absolute -right-10 top-16 h-[600px] w-[600px]" aria-hidden>
        <ellipse cx="16" cy="16" rx="13.25" ry="6" transform="rotate(-32 16 16)" stroke="#1c1d23" strokeWidth="1.75" />
        <ellipse cx="16" cy="16" rx="13.25" ry="6" transform="rotate(32 16 16)" stroke="#1c1d23" strokeWidth="1.75" />
        <circle cx="16" cy="16" r="2.25" fill="#1c1d23" />
        <circle cx="26.4" cy="8.6" r="2.6" fill="#1e3a6b" stroke="#09090b" strokeWidth="1.5" />
      </svg>

      <div className="relative flex items-center gap-4">
        <LogoMark size={44} />
        <Tag tone="brand">Конкурс «Цифровой деканат будущего» · 2026</Tag>
      </div>

      <div className="relative mt-auto">
        <h1 className="text-[104px] font-semibold leading-none tracking-[0.06em] text-zinc-50">ОРБИТА</h1>
        <p className="mt-4 text-[34px] tracking-tight text-zinc-400">Цифровой деканат будущего</p>
        <p className="mt-4 text-[18px] text-zinc-500">Учёба, деканат и кампус в одном окне — с телефона, за пару касаний.</p>

        <dl className="mt-10 grid w-[760px] grid-cols-4 gap-6">
          {[
            ['3', 'контура: учёба, деканат, кампус'],
            ['30', 'API-маршрутов с проверкой владельца'],
            ['13', 'моделей данных в Prisma'],
            ['360 px', 'минимальная ширина экрана'],
          ].map(([v, l]) => (
            <div key={l}>
              <dt className="text-[34px] font-semibold tracking-tight text-zinc-50 tabular-nums">{v}</dt>
              <dd className="mt-1 text-[13px] leading-snug text-zinc-500">{l}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-10 flex w-[760px] items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-[13px] text-zinc-400">
          <Icon as={Info} size={18} />
          Конкурсный прототип. Не является официальным сервисом вуза. Все персональные данные вымышленные.
        </div>
      </div>
    </div>
  );
}

// ───────────────────────── 02 · Проблема

function S2() {
  const frags: [LucideIcon, string, string][] = [
    [CalendarDays, 'Расписание', 'отдельная система'],
    [ChartColumn, 'Баллы БРС', 'другая система'],
    [BookOpen, 'Домашние задания', 'LMS'],
    [FileText, 'Справки', 'окошко деканата'],
    [ArrowRightLeft, 'Переносы пар', 'чат старосты'],
    [Wifi, 'Пароль Wi-Fi', 'старое письмо в почте'],
  ];
  const pains: [LucideIcon, string, string][] = [
    [Smartphone, 'Студент со смартфона', 'Таблицы не влезают в 360 px, у каждой системы свой вход. Нужное приходится искать, а не открывать.'],
    [Clock, 'Время уходит на поиск', 'Где пара? Сколько баллов не хватает до допуска? Когда дедлайн? Сколько ждать справку?'],
    [Inbox, 'Деканат в бумагах', 'Однотипные бумажные заявки и нет быстрого способа оповестить группу о переносе аудитории.'],
  ];
  return (
    <Frame n={2} eyebrow="Проблема" title="Студенческая жизнь разложена по десятку систем">
      <div className="grid h-full grid-cols-[1fr_400px] gap-8">
        <div className="flex flex-col">
          <p className="text-[16px] text-zinc-400">Каждая потребность живёт в своём месте, и почти ничего из этого не открывается нормально с телефона.</p>
          <div className="mt-6 grid grid-cols-3 gap-4">
            {frags.map(([I, t, where]) => (
              <Panel key={t} className="p-5">
                <Icon as={I} className="text-zinc-400" />
                <p className="mt-4 text-[16px] font-semibold text-zinc-50">{t}</p>
                <Tag className="mt-2.5 text-[12px]">{where}</Tag>
              </Panel>
            ))}
          </div>
          <p className="mt-auto text-[14px] italic text-zinc-500">6 мест — 6 логинов, 6 интерфейсов, ни одного общего «что важно сегодня».</p>
        </div>
        <Panel className="flex flex-col divide-y divide-zinc-800 px-6">
          {pains.map(([I, t, d]) => (
            <div key={t} className="flex flex-1 gap-4 py-5">
              <Icon as={I} className="mt-0.5 text-blue-400" />
              <div>
                <p className="text-[17px] font-semibold text-zinc-50">{t}</p>
                <p className="mt-1.5 text-[14px] leading-relaxed text-zinc-400">{d}</p>
              </div>
            </div>
          ))}
        </Panel>
      </div>
    </Frame>
  );
}

// ───────────────────────── 03 · Решение

function S3() {
  const contours: [LucideIcon, string, string][] = [
    [GraduationCap, 'Учебный', 'Расписание с переносами, БРС и симулятор, онлайн-задачи, методички с ИИ-квизами, кабинет преподавателя'],
    [Stamp, 'Административный', 'Онлайн-заявки и справки с реестровым номером, очередь деканата, подпись ЭЦП, бланк с QR'],
    [Building2, 'Кампусный', 'Бронирование коворкингов, Wi-Fi и IT-доступы, Smart-пропуск, афиша, спортсекции, мессенджер'],
  ];
  return (
    <Frame n={3} eyebrow="Решение" title="«Фокус дня» вместо пассивных таблиц">
      <div className="flex h-full gap-10">
        <div className="shrink-0">
          <FocusPhone />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <p className="text-[16px] leading-relaxed text-zinc-400">
            Приложение само говорит, что важно сегодня: ближайшая пара с переносом, дедлайн с обратным отсчётом (он тикает), статус заявок и средний балл.
            Всё остальное — на расстоянии одного касания.
          </p>
          <div className="grid grid-cols-3 gap-4">
            {contours.map(([I, t, d]) => (
              <FeatureCard key={t} icon={I} title={t} text={d} />
            ))}
          </div>
          <Panel className="mt-auto flex gap-4 bg-zinc-900 p-5">
            <Icon as={Sparkles} className="mt-0.5 text-blue-400" />
            <div>
              <p className="text-[16px] font-semibold text-zinc-50">Орбита Copilot — проактивный консьерж</p>
              <p className="mt-1.5 text-[14px] leading-relaxed text-zinc-400">
                Сервер собирает контекст текущего пользователя из БД: Copilot знает именно ваши баллы, долги и дедлайны. Работает с любым OpenAI-совместимым LLM, а без ключа отвечает по правилам на реальных данных.
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </Frame>
  );
}

// ───────────────────────── 04 · Учебный трек

function S4() {
  return (
    <Frame n={4} eyebrow="Учебный трек" title="От задания до балла в БРС — без выхода из Орбиты">
      <div className="grid h-full grid-cols-[1fr_1fr_430px] gap-5">
        <FeatureCard icon={SquareCode} title="Онлайн-решатель задач" text="Split-View: условие слева, редактор справа (на телефоне — вкладки). Нумерация строк, JetBrains Mono, шаблон кода." />
        <FeatureCard icon={Presentation} title="Кабинет преподавателя" text="Выдать задание в Markdown, открыть решение, поставить балл с рецензией. Балл попадает в БРС одной транзакцией." />
        <div className="row-span-2">
          <BrsSimulator />
        </div>
        <FeatureCard icon={BookOpenCheck} title="Методички + ИИ-квиз" text="Встроенный ридер и «Проверь себя»: 3 вопроса, мгновенная проверка и пояснения. Работает и без LLM-ключа." />
        <FeatureCard
          icon={SlidersHorizontal}
          title="Симулятор «Что если?»"
          text="Подвигайте ползунки справа: итог, оценка, долги и стипендия пересчитываются сразу — по тем же порогам, что у сервера."
          tag={<Tag tone="brand">живой</Tag>}
        />
      </div>
    </Frame>
  );
}

// ───────────────────────── 05 · Документооборот

function S5() {
  const lifecycle: [string, Tone][] = [['NEW', 'neutral'], ['IN_REVIEW', 'warning'], ['APPROVED', 'success'], ['REJECTED + комментарий', 'danger']];
  const rows = [
    ['Подача', 'Заявление в окошке', '7 типов заявок онлайн с динамическими полями'],
    ['Статус', '«Зайдите через неделю»', 'Степпер статусов и номер ОРБ-2026-NNNN'],
    ['Подпись', 'Живая подпись и печать', '«Одобрить и подписать ЭЦП» в один клик'],
    ['Проверка', 'Звонок в деканат', 'QR-код проверки на печатном бланке'],
  ];
  return (
    <Frame n={5} eyebrow="Цифровой документооборот" title="Справка с ЭЦП и QR-кодом за 2 касания">
      <div className="grid h-full grid-cols-[1fr_430px] gap-8">
        <div className="flex flex-col gap-5">
          <Panel className="p-5">
            <Eyebrow>Двусторонний контур</Eyebrow>
            <div className="mt-4 grid grid-cols-[84px_1fr_24px_1fr_24px_1fr] items-center gap-y-4 text-[14px] font-semibold">
              <span className="text-[12px] font-medium text-zinc-500">Студент</span>
              <Node>1 · Выбрать тип</Node>
              <Arrow />
              <Node>2 · Отправить</Node>
              <span />
              <Node tone="success">Справка с QR</Node>

              <span className="text-[12px] font-medium text-zinc-500">Деканат</span>
              <span />
              <span />
              <Node>Проверка</Node>
              <Arrow />
              <Node tone="brand">Подписать ЭЦП</Node>
            </div>
          </Panel>
          <div className="flex flex-wrap items-center gap-2 text-[13px] text-zinc-500">
            <span className="mr-2">Жизненный цикл</span>
            {lifecycle.map(([t, tone], i) => (
              <span key={t} className="flex items-center gap-2">
                <Tag tone={tone} mono>{t}</Tag>
                {i < 2 && <span>→</span>}
                {i === 2 && <span>|</span>}
              </span>
            ))}
          </div>
          <Panel className="overflow-hidden">
            <table className="w-full text-left text-[14px]">
              <thead className="bg-zinc-900 text-[11px] uppercase tracking-[0.12em] text-zinc-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium" />
                  <th className="px-4 py-2.5 font-medium">Было</th>
                  <th className="px-4 py-2.5 font-medium">Стало в Орбите</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {rows.map(([k, a, b]) => (
                  <tr key={k}>
                    <td className="px-4 py-2.5 font-semibold text-zinc-50">{k}</td>
                    <td className="px-4 py-2.5 text-zinc-500">{a}</td>
                    <td className="px-4 py-2.5 text-zinc-200">{b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </div>
        <CertificateDemo />
      </div>
    </Frame>
  );
}

function Node({ children, tone }: { children: ReactNode; tone?: 'success' | 'brand' }) {
  return (
    <span
      className={cn(
        'flex h-11 items-center justify-center rounded-lg border px-2 text-center',
        tone === 'success' && 'border-emerald-800/60 bg-emerald-950/60 text-emerald-300',
        tone === 'brand' && 'border-blue-500/30 bg-blue-500/10 text-blue-400',
        !tone && 'border-zinc-800 bg-zinc-900 text-zinc-100',
      )}
    >
      {children}
    </span>
  );
}
const Arrow = () => <span className="text-center text-zinc-600" aria-hidden>→</span>;

// ───────────────────────── 06 · Кампус 360°

function S6() {
  return (
    <Frame n={6} eyebrow="Кампус 360°" title="Весь кампус в одном хабе">
      <div className="grid h-full grid-cols-3 grid-rows-2 gap-4">
        <FeatureCard icon={Armchair} title="Коворкинги и аудитории" text="5 пространств, слоты совпадают с парами. Двойная бронь невозможна даже при одновременных запросах." tag={<Tag mono>409 Conflict</Tag>} />
        <Panel className="flex flex-col p-6">
          <div className="flex items-start justify-between gap-3">
            <Icon as={Wifi} className="text-blue-400" />
            <Tag mono>Orbita-Edu-5G</Tag>
          </div>
          <h3 className="mt-4 text-[18px] font-semibold text-zinc-50">Генератор Wi-Fi паролей</h3>
          <p className="mt-1 text-[13px] text-zinc-500">CSPRNG, ~59 бит, без 0/O и 1/I/L</p>
          <WifiGenerator />
        </Panel>
        <FeatureCard icon={Ticket} title="Афиша мероприятий" text="Хакатоны, митапы, карьера, наука, клубы. Запись в 1 клик, счётчик мест меняется атомарно." tag={<Tag mono>EVT-2026-XXXX</Tag>} />
        <FeatureCard icon={Dumbbell} title="Спортивные секции" text="Трекер зачёта по физкультуре и каталог из 7 секций. Переход между секциями — одной транзакцией." tag={<Tag mono>16 / 20</Tag>} />
        <FeatureCard icon={MessagesSquare} title="Мессенджер" text="Одногруппники, преподаватели и деканат. Шаблоны, непрочитанные, «Написать преподавателю» прямо из ДЗ." tag={<Tag mono>Optimistic UI</Tag>} />
        <FeatureCard icon={ScanLine} title="Smart-пропуск" text="QR-токен обновляется каждые 30 секунд, «живые» часы отличают пропуск от скриншота." tag={<Tag mono>QR · 30 с</Tag>} />
      </div>
    </Frame>
  );
}

// ───────────────────────── 07 · Дизайн и Mobile-First

function S7() {
  const swatches = [
    ['#09090B', 'Фон'],
    ['#12141A', 'Карточка'],
    ['#27272A', 'Рамка'],
    ['#3B82F6', 'Акцент'],
    ['#FAFAFA', 'Текст'],
    ['#A1A1AA', 'Вторичный'],
  ];
  const rules = [
    ['Неоновые и радужные градиенты, glow-пятна', 'Плоские поверхности и один акцент'],
    ['Тяжёлые тени shadow-lg / xl / 2xl', 'Глубина через контраст фона и рамку 1 px'],
    ['Пропорциональные цифры в данных', 'tabular-nums на баллах, таймерах, датах'],
    ['Эмодзи и цветные подложки у иконок', 'lucide-react, штрих 1.75, currentColor'],
    ['Горизонтальный скролл на 360 px', 'Таблицы → карточки, min-w-0'],
  ];
  return (
    <Frame n={7} eyebrow="Дизайн и Mobile-First" title="Obsidian Dark: спокойно, плотно, точно">
      <div className="grid h-full grid-cols-[1fr_200px_170px] gap-8">
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-6 gap-3">
            {swatches.map(([hex, name]) => (
              <div key={hex}>
                <div className="h-14 rounded-lg border border-zinc-700" style={{ background: hex }} />
                <p className="mt-2 text-[13px] font-semibold text-zinc-100">{name}</p>
                <p className="font-mono text-[11px] text-zinc-500">{hex}</p>
              </div>
            ))}
          </div>
          <Panel className="overflow-hidden">
            <table className="w-full text-left text-[14px]">
              <thead className="bg-zinc-900 text-[11px] uppercase tracking-[0.12em] text-zinc-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Запрещено</th>
                  <th className="px-4 py-2.5 font-medium">Вместо этого</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {rules.map(([a, b]) => (
                  <tr key={a}>
                    <td className="px-4 py-2.5 text-zinc-500">{a}</td>
                    <td className="px-4 py-2.5 text-zinc-200">{b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </div>

        {/* Схема экрана 360 px */}
        <div className="flex flex-col items-center">
          <div className="flex h-[400px] w-[190px] flex-col overflow-hidden rounded-[26px] border border-zinc-700 bg-zinc-950 p-2.5">
            <div className="flex h-8 items-center justify-center rounded-md border border-zinc-800 bg-[#12141A]/80 text-[10px] text-zinc-500">шапка · стекло</div>
            <div className="mt-2 flex flex-1 flex-col gap-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex-1 rounded-md border border-zinc-800 bg-[#12141A]" />
              ))}
            </div>
            <div className="mt-2 flex h-10 items-center justify-around border-t border-zinc-800">
              {[0, 1, 2, 3, 4].map((i) => (
                <span key={i} className={cn('size-6 rounded-md border', i === 0 ? 'border-blue-500/30 bg-blue-500/10' : 'border-zinc-800 bg-[#12141A]')} />
              ))}
            </div>
          </div>
          <div className="mt-3 flex w-[190px] items-center gap-2 text-blue-400">
            <span className="h-px flex-1 bg-blue-500" />
            <span className="font-mono text-[12px] font-semibold tabular-nums">360 px</span>
            <span className="h-px flex-1 bg-blue-500" />
          </div>
        </div>

        <dl className="flex flex-col justify-between">
          {[
            ['44×44', 'тач-зоны на мобильном'],
            ['60 FPS', 'анимации только transform и opacity'],
            ['5', 'разделов в нижнем таб-баре'],
            ['0 мс', 'мигания темы при загрузке'],
          ].map(([v, l]) => (
            <div key={l}>
              <dt className="text-[28px] font-semibold tracking-tight text-zinc-50 tabular-nums">{v}</dt>
              <dd className="mt-0.5 text-[13px] leading-snug text-zinc-500">{l}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Frame>
  );
}

// ───────────────────────── 08 · Безопасность

function S8() {
  const steps: [LucideIcon, string, string, boolean?][] = [
    [Monitor, 'GET /api/requests/99999', 'Студент подставляет чужой id', true],
    [Cookie, 'middleware.ts', 'JWT из HttpOnly-cookie, сверка Origin'],
    [KeyRound, 'session.ts', 'userId и role — только из токена'],
    [ShieldCheck, 'Проверка владельца', 'Чужой и несуществующий id — одинаково'],
  ];
  const threats = [
    ['IDOR', 'Владелец проверяется на каждом ресурсе, ответ 403'],
    ['Кража сессии (XSS)', 'JWT HS256 в cookie HttpOnly · SameSite=Lax · Secure'],
    ['Утечка паролей', 'bcrypt cost 10, защита от тайминг-атаки'],
    ['Перебор паролей', '5 попыток на «IP + email» за 15 минут → 429'],
    ['CSRF', 'SameSite=Lax и сверка Origin с Host'],
    ['Утечка секретов', 'JWT_SECRET и AI_API_KEY только на сервере'],
  ];
  return (
    <Frame n={8} eyebrow="Безопасность · AppSec" title="Чужая заявка недоступна даже по прямой ссылке">
      <div className="grid h-full grid-cols-[400px_1fr] gap-6">
        <Panel className="flex flex-col p-5">
          <Eyebrow>Путь запроса</Eyebrow>
          <ol className="mt-3 flex flex-col">
            {steps.map(([I, t, d, mono], i) => (
              <li key={t} className="flex flex-col items-center">
                <div className="flex w-full items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-2.5">
                  <Icon as={I} size={18} className="text-zinc-400" />
                  <div className="min-w-0">
                    <p className={cn('text-[14px] font-semibold text-zinc-50', mono && 'font-mono text-[13px]')}>{t}</p>
                    <p className="text-[12px] text-zinc-500">{d}</p>
                  </div>
                </div>
                <span className="h-3 w-px bg-zinc-700" aria-hidden />
              </li>
            ))}
          </ol>
          <div className="flex items-center justify-center gap-3 rounded-lg border border-red-800/60 bg-red-950/60 px-4 py-3 text-red-300">
            <span className="font-mono text-[16px] font-semibold">403 Forbidden</span>
            <span className="text-[12px]">+ лог [security] IDOR blocked</span>
          </div>
        </Panel>

        <div className="flex min-w-0 flex-col gap-4">
          <Panel className="overflow-hidden">
            <table className="w-full text-left text-[14px]">
              <thead className="bg-zinc-900 text-[11px] uppercase tracking-[0.12em] text-zinc-500">
                <tr>
                  <th className="w-[180px] px-4 py-2 font-medium">Угроза</th>
                  <th className="px-4 py-2 font-medium">Защита</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {threats.map(([a, b]) => (
                  <tr key={a}>
                    <td className="px-4 py-2 font-semibold text-zinc-50">{a}</td>
                    <td className="px-4 py-2 text-zinc-300">{b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
          <div className="grid flex-1 grid-cols-[1fr_250px] gap-4">
            <Panel className="p-4">
              <Eyebrow className="mb-3">Проверьте сами · живой запрос</Eyebrow>
              <IdorProbe />
            </Panel>
            <Panel className="bg-zinc-900 p-4">
              <Icon as={MapPin} size={20} className="text-blue-400" />
              <p className="mt-2 text-[15px] font-semibold text-zinc-50">Автономность в РФ без VPN</p>
              <p className="mt-1 text-[13px] leading-relaxed text-zinc-400">SQLite в файле, внешних сервисов нет. Copilot и квизы работают без LLM-ключа.</p>
            </Panel>
          </div>
        </div>
      </div>
    </Frame>
  );
}

// ───────────────────────── 09 · SDD

function S9() {
  const { active, select, paused, resume } = useSddCycle();
  const specs = [
    ['01_PRODUCT_PRD.md', 'роли, пороги БРС, сценарии'],
    ['02_DESIGN_SYSTEM.md', 'токены, анти-вайбкод, 360 px'],
    ['03_DATA_AND_SECURITY.md', 'модели, матрица доступа'],
    ['04_API_CONTRACT.md', 'запросы, ответы, ошибки'],
  ];
  const on = (i: number) => active === i;
  const box = (i: number) =>
    cn(
      'rounded-xl border text-left transition-colors duration-200 motion-reduce:transition-none',
      on(i) ? 'border-blue-500/60 bg-blue-500/10' : 'border-zinc-800 bg-[#12141A] hover:border-zinc-700',
    );
  const Stream = ({ i, icon, chain }: { i: number; icon: LucideIcon; chain: string[] }) => (
    <button type="button" data-interactive onClick={() => select(i)} className={cn(box(i), 'flex flex-1 flex-col p-4')}>
      <span className="flex items-center gap-2.5">
        <Icon as={icon} size={20} className="text-blue-400" />
        <span className="text-[15px] font-semibold text-zinc-50">{SDD_STAGES[i].title}</span>
      </span>
      <span className="mt-3 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-1.5">
        {chain.map((c, j) => (
          <Chip key={c} last={j === chain.length - 1}>{c}</Chip>
        ))}
      </span>
    </button>
  );
  return (
    <Frame n={9} eyebrow="Масштаб ИИ-разработки · Spec-Driven Development" title="Сначала контракт, потом код">
      <div className="flex h-full flex-col gap-4">
        <div className="grid flex-1 grid-cols-[250px_24px_1fr_24px_270px] items-stretch">
          <button type="button" data-interactive onClick={() => select(0)} className={cn(box(0), 'flex flex-col gap-2 p-3')}>
            <Eyebrow>1 · Контракты /specs</Eyebrow>
            {specs.map(([f, d]) => (
              <span key={f} className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2">
                <span className="block font-mono text-[12px] font-semibold text-zinc-100">{f}</span>
                <span className="block text-[11px] text-zinc-500">{d}</span>
              </span>
            ))}
          </button>
          <Flow active={on(1) || on(2)} />
          <div className="flex flex-col gap-3">
            <Stream i={1} icon={Server} chain={['Prisma + seed', '/api + zod', 'JWT · bcrypt · IDOR']} />
            <Stream i={2} icon={Palette} chain={['UI-кит', 'Экраны + Copilot', 'normalize + моки']} />
          </div>
          <Flow active={on(3)} />
          <div className="flex flex-col gap-3">
            {([[3, ScanSearch, 'Сверка кода со спеками · поиск рассинхронов'], [4, FilePen, 'Исправление в коде и в спеке']] as const).map(([i, I, t]) => (
              <button key={i} type="button" data-interactive onClick={() => select(i)} className={cn(box(i), 'flex flex-1 flex-col p-4')}>
                <Eyebrow>{i === 3 ? '3 · Двойной ИИ-аудит' : '4 · Петля версий'}</Eyebrow>
                <span className="mt-2.5 flex items-start gap-2.5">
                  <Icon as={i === 3 ? Bug : I} size={20} className="mt-0.5 text-zinc-400" />
                  <span className="text-[14px] font-medium text-zinc-100">{t}</span>
                </span>
                {i === 3 && (
                  <span className="mt-auto flex gap-1.5 pt-2">
                    <Tag mono className="text-[10px]">REVIEW_REPORT.md</Tag>
                    <Tag mono className="text-[10px]">…_V2.md</Tag>
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <Panel className="flex items-center gap-5 bg-zinc-900 px-5 py-3.5">
          <span className="w-[230px] shrink-0">
            <span className="block font-mono text-[11px] text-blue-400 tabular-nums">{String(active + 1).padStart(2, '0')} / 05</span>
            <span className="mt-0.5 block text-[13px] font-semibold text-zinc-50">{SDD_STAGES[active].title}</span>
            <button type="button" data-interactive data-no-print onClick={resume} className={cn('mt-1 text-[12px] text-zinc-500 underline-offset-2 hover:underline', !paused && 'invisible')}>
              ▸ продолжить автопоказ
            </button>
          </span>
          <p className="text-[14px] leading-relaxed text-zinc-300">{SDD_STAGES[active].text}</p>
        </Panel>

        <div className="grid grid-cols-3 gap-4">
          {[
            ['V1', 'Вход, «Фокус дня», БРС, заявки с QR, Copilot, IDOR'],
            ['V2', 'Роль TEACHER, онлайн-ДЗ, мессенджер, бронирование'],
            ['V3', 'Кампус, афиша, ⌘K, .ics, ИИ-квиз, Optimistic UI'],
          ].map(([v, d]) => (
            <div key={v} className="flex items-center gap-3">
              <Tag tone="brand" mono>{v}</Tag>
              <span className="text-[13px] text-zinc-400">{d}</span>
            </div>
          ))}
        </div>
      </div>
    </Frame>
  );
}

function Chip({ children, last }: { children: ReactNode; last?: boolean }) {
  return (
    <>
      <span className="flex h-11 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 px-1.5 text-center text-[12px] leading-tight text-zinc-300">
        {children}
      </span>
      {!last && <span className="text-[12px] text-zinc-600" aria-hidden>→</span>}
    </>
  );
}

function Flow({ active }: { active: boolean }) {
  return (
    <span className="flex items-center justify-center" aria-hidden>
      <span className={cn('text-[16px] transition-colors duration-200', active ? 'text-blue-400' : 'text-zinc-700')}>→</span>
    </span>
  );
}

// ───────────────────────── 10 · Итоги

function S10() {
  const stack = ['Next.js 15', 'React 19', 'TypeScript', 'Tailwind CSS v4', 'Prisma + SQLite', 'jose (JWT)', 'bcryptjs', 'zod'];
  const accounts: [string, Tone, string, string, string][] = [
    ['Студент · отличник', 'brand', 'alexey.sokolov@edu.orbita.ru', 'Student2026!', '«Фокус дня», симулятор, решатель, Wi-Fi, IDOR-тест'],
    ['Студент · риск', 'warning', 'maria.kuznetsova@edu.orbita.ru', 'Student2026!', '42 балла и «не хватает 8 до допуска»'],
    ['Деканат', 'success', 'dekanat@edu.orbita.ru', 'Admin2026!', 'Одобрить и подписать ЭЦП, перенос аудитории'],
    ['Преподаватель', 'brand', 'volkov.igor@edu.orbita.ru', 'Teacher2026!', 'Выдать задачу, оценить — балл в БРС'],
    ['Одногруппник', 'neutral', 'dmitry.orlov@edu.orbita.ru', 'Student2026!', 'Чужой слот брони → 409'],
  ];
  const roleColor: Record<Tone, string> = {
    brand: 'text-blue-400',
    warning: 'text-amber-300',
    success: 'text-emerald-300',
    neutral: 'text-zinc-300',
    danger: 'text-red-300',
  };
  return (
    <Frame n={10} eyebrow="Итоги" title="Готово к проверке: одна команда и пять аккаунтов">
      <div className="flex h-full flex-col gap-5">
        <div className="flex flex-wrap gap-2">
          {stack.map((s) => (
            <Tag key={s} className="px-3 py-1 text-[13px] text-zinc-300">{s}</Tag>
          ))}
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-[320px_1fr] gap-5">
          <div className="flex flex-col gap-4">
            <Panel className="bg-zinc-900 p-5">
              <p className="flex items-center gap-2.5 text-[16px] font-semibold text-zinc-50">
                <Icon as={Container} size={20} className="text-blue-400" /> Docker-деплой
              </p>
              <code className="mt-3 block rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 font-mono text-[13px] text-zinc-100">
                $ docker compose up --build -d
              </code>
              <p className="mt-3 text-[13px] leading-relaxed text-zinc-400">Сборка, схема БД, демо-данные и запуск на localhost:3000. База сохраняется в томе.</p>
            </Panel>
            <Panel className="flex-1 p-5">
              <p className="flex items-center gap-2.5 text-[16px] font-semibold text-zinc-50">
                <Icon as={Zap} size={20} className="text-blue-400" /> Быстрый вход для жюри
              </p>
              <p className="mt-3 text-[13px] leading-relaxed text-zinc-400">
                На /login — вход в один клик для первых четырёх аккаунтов, пятый — через форму. Сброс стенда: npm run db:setup. Все аккаунты и данные вымышлены.
              </p>
            </Panel>
          </div>
          <Panel className="overflow-hidden">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-zinc-900 text-[11px] uppercase tracking-[0.12em] text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Роль</th>
                  <th className="px-2 py-3 font-medium">Логин</th>
                  <th className="px-2 py-3 font-medium">Пароль</th>
                  <th className="px-4 py-3 font-medium">Что проверить</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {accounts.map(([role, tone, login, pwd, what]) => (
                  <tr key={login}>
                    <td className={cn('whitespace-nowrap px-4 py-3.5 font-semibold', roleColor[tone])}>{role}</td>
                    <td className="px-2 py-3.5"><CopyCell value={login} /></td>
                    <td className="px-2 py-3.5"><CopyCell value={pwd} /></td>
                    <td className="px-4 py-3.5 text-zinc-400">{what}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </div>
      </div>
    </Frame>
  );
}

export const SLIDES: { title: string; Component: ComponentType }[] = [
  { title: 'Орбита — Цифровой деканат будущего', Component: S1 },
  { title: 'Проблема', Component: S2 },
  { title: 'Решение', Component: S3 },
  { title: 'Учебный трек', Component: S4 },
  { title: 'Цифровой документооборот', Component: S5 },
  { title: 'Кампус 360°', Component: S6 },
  { title: 'Дизайн и Mobile-First', Component: S7 },
  { title: 'Безопасность', Component: S8 },
  { title: 'Spec-Driven Development', Component: S9 },
  { title: 'Итоги', Component: S10 },
];
