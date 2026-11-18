# 02 · Дизайн-система «Орбита»

> Статус: **утверждено для реализации**. Код фронтенда (`src/app/**` кроме `src/app/api/**`, `src/components/**`, `src/lib/**`) обязан соответствовать этому документу. Любое отклонение — сначала правка спеки, потом код.

Продукт — «Цифровой деканат будущего». Тон интерфейса: дорогой академический финтех. Ориентиры — Linear, Vercel, Raycast, Т-Банк. Спокойно, плотно, точно.

---

## 1. Анти-вайбкод правила (жёсткие запреты)

| # | Запрет | Чем заменяем |
|---|--------|--------------|
| 1 | Радужные и неоновые градиенты (`from-indigo-500 via-purple-500 to-pink-500` и любые `bg-gradient-*` с ≥2 хроматическими цветами), glow-пятна, `blur-3xl` цветные фоны, кислотные акценты | Плоские поверхности, один акцент `#2563EB` |
| 2 | Тяжёлые тени: `shadow-lg`, `shadow-xl`, `shadow-2xl` | Глубина = контраст фона страницы `#F8FAFC` + белая карточка `#FFFFFF` + рамка `1px solid #E2E8F0`. Допустим только `shadow-sm` у плавающих слоёв (тосты, поповеры, шторки) |
| 3 | Пропорциональные цифры в данных | `tabular-nums` на всех баллах БРС, таймерах, датах, времени пар, номерах групп, аудиторий, реестровых номерах |
| 4 | Цветные кружки-подложки вокруг каждой иконки, эмодзи как иконки | `lucide-react`, `strokeWidth={1.75}`, цвет — `currentColor` текста |
| 5 | Официальные логотипы вузов | Собственный SVG-логотип «Орбита» (`src/components/brand/Logo.tsx`) |
| 6 | Горизонтальный скролл страницы на 360px | Таблицы → карточки на мобильном, `min-w-0` у flex-детей, `break-words`, `overflow-x-hidden` на корне |

## 2. Токены

### 2.1 Цвет

| Токен | HEX | Tailwind | Где |
|-------|-----|----------|-----|
| `bg/page` | `#F8FAFC` | `bg-slate-50` | Фон страницы |
| `bg/card` | `#FFFFFF` | `bg-white` | Карточки, сайдбар, хедер |
| `bg/subtle` | `#F1F5F9` | `bg-slate-100` | Второстепенные зоны, треки прогресса, hover строк, пузырь пользователя в чате |
| `border/default` | `#E2E8F0` | `border-slate-200` | Все рамки 1px |
| `text/primary` | `#0F172A` | `text-slate-900` | Заголовки, значения |
| `text/secondary` | `#475569` | `text-slate-600` | Основной вторичный текст |
| `text/muted` | `#64748B` | `text-slate-500` | Подписи, метки, плейсхолдеры |
| `brand` | `#2563EB` | `blue-600` | Primary-кнопки, активная навигация, фокус, ссылки, прогресс |
| `brand/hover` | `#1D4ED8` | `blue-700` | Hover primary |
| `brand/subtle` | `#EFF6FF` | `blue-50` | Активный пункт меню, выбранный чип |

Семантические бейджи (единственный разрешённый способ цветового статуса):

| Тип | Классы | Значение |
|-----|--------|----------|
| Success | `bg-emerald-50 text-emerald-700 border-emerald-200` | Подписано, сдано, стипендия сохраняется |
| Warning | `bg-amber-50 text-amber-700 border-amber-200` | Перенос, на проверке, дедлайн < 72 ч |
| Danger | `bg-red-50 text-red-700 border-red-200` | Отклонено, долг, дедлайн < 24 ч / просрочен |
| Brand | `bg-blue-50 text-blue-700 border-blue-200` | Информационные метки, «Идёт сейчас» |
| Neutral | `bg-slate-50 text-slate-600 border-slate-200` | Тип пары, категория материала |

### 2.2 Типографика

- Шрифт: **Inter** (`next/font/google`, subsets `latin` + `cyrillic`), фичи `cv11`, `ss01`. Моноширинный: системный `ui-monospace` — только реестровые номера и коды ответов сервера.
- Шкала:

| Роль | Класс |
|------|-------|
| Display (крупные баллы) | `text-4xl font-semibold tracking-tight tabular-nums` |
| H1 страницы | `text-2xl font-semibold tracking-tight` (mobile `text-xl`) |
| H2 карточки | `text-sm font-medium text-slate-900` |
| Eyebrow / метка секции | `text-xs font-medium uppercase tracking-wider text-slate-500` |
| Body | `text-sm text-slate-600` |
| Caption | `text-xs text-slate-500` |

### 2.3 Сетка, радиусы, отступы

- База 4px. Внутренний отступ карточки: `p-4` (mobile) / `p-5` (≥ sm).
- Gap сеток: `gap-3` mobile, `gap-4` ≥ lg.
- Радиусы: карточка `rounded-xl` (12px), кнопка/инпут `rounded-lg` (8px), бейдж `rounded-md` (6px), аватар `rounded-full`.
- Контейнер контента: `max-w-6xl mx-auto px-4 sm:px-6 lg:px-8`.

### 2.4 Иконки

`lucide-react`, размер 16px в тексте/кнопках, 18px в навигации, 20px в tab bar; `strokeWidth={1.75}` всегда. Без фоновых подложек. Константа `ICON_STROKE` в `src/lib/ui.ts`.

### 2.5 Движение

Только `transition-colors`/`transition-transform`, 150ms ease-out. Шторки — `translate`, 200ms. Скелетоны — `animate-pulse` на `bg-slate-100`. Без parallax, без bounce. Уважать `prefers-reduced-motion`.

## 3. Адаптив (mobile-first, 360px → desktop)

| Брейкпоинт | Навигация |
|-----------|-----------|
| `< lg` (до 1024px) | Хедер `h-14` (логотип, Copilot, колокольчик, аватар). Снизу фиксированный **Bottom Tab Bar `h-16`** ровно на 5 разделов: Сводка, Расписание, Учёба и ДЗ, БРС, Справки. Контенту — `pb-24`. Учитывать `env(safe-area-inset-bottom)` |
| `≥ lg` | Левый сайдбар **240px** (фикс), верхний хедер `h-16`: поле-кнопка «Спросить Орбита Copilot» (+ `⌘K`), колокольчик уведомлений, профиль |

- Тач-зоны ≥ **44×44px** (`min-h-11 min-w-11`) для всех интерактивных элементов на мобильном.
- Таблицы на `< md` превращаются в стек карточек. Ни один экран не создаёт горизонтальный скролл на 360px; корень `overflow-x-hidden`.
- Модалки: `< sm` — нижняя шторка на всю ширину (`rounded-t-2xl`, max-h 90dvh); `≥ sm` — центрированное окно. Copilot: `< lg` — fullscreen, `≥ lg` — правый drawer 440px.

## 4. Компоненты (src/components/ui)

| Компонент | Варианты | Правила |
|-----------|----------|---------|
| `Button` | `primary` (blue-600, белый текст), `secondary` (белый, рамка slate-200), `ghost`, `danger` (белый, текст red-700, рамка red-200) · размеры `sm` 36px / `md` 40px / `lg` 44px | На мобильном минимум 44px через `min-h-11` в местах первичных действий. Состояние `loading` — спиннер + disabled |
| `Badge` | success / warning / danger / brand / neutral | `border`, `rounded-md`, `text-xs font-medium`, `px-2 py-0.5` |
| `Card` | — | `bg-white border border-slate-200 rounded-xl` |
| `Skeleton` | — | `bg-slate-100 animate-pulse rounded-md` — повторяет геометрию реального контента |
| `EmptyState` | — | Иконка 20px slate-400, заголовок, пояснение, опциональная кнопка. Без иллюстраций |
| `Sheet` (модалка) | — | Оверлей `bg-slate-900/40`, закрытие по Esc/клику мимо, фокус-ловушка, `aria-modal` |
| `Segmented` | — | Трек `bg-slate-100 p-1 rounded-lg`, активный — `bg-white border border-slate-200` |
| `Toast` | success / error / info | Белая карточка + рамка + `shadow-sm`, иконка семантического цвета. Mobile — над tab bar, desktop — справа снизу. Автоскрытие 4с |
| `Stepper` | — | Создано → На проверке → Подписано ЭЦП / Готово. Пройденный шаг — blue-600, отклонённый — red-600 |
| `Countdown` | — | `tabular-nums`; < 24ч — danger, < 72ч — warning, иначе neutral. Тикает раз в секунду |

## 5. Логотип и юридический дисклеймер

- Логотип: две пересекающиеся эллиптические орбиты (повёрнуты на ±30°) и точка-«спутник» цвета `#2563EB`. Монохромный штрих `currentColor` 1.75. Файл: `src/components/brand/Logo.tsx`.
- Дисклеймер — в футере каждой страницы приложения и на `/login`:
  > Концепт для конкурса «Цифровой деканат будущего». Не является официальным сервисом вуза. Все персональные данные вымышленные.

  Оформление: `bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-500`, иконка `Info`.

## 6. Состояния экранов

Каждый экран реализует 4 состояния: **loading** (skeleton той же сетки), **empty** (`EmptyState`), **error** (`EmptyState` + «Повторить»), **data**. Мутации — оптимистично там, где безопасно, итог — `Toast`.

## 7. Язык интерфейса

Русский, обращение на «вы» в системных текстах. Числа и даты — `Intl` с локалью `ru-RU`. Кнопки — глаголом: «Сдать работу», «Заказать», «Одобрить и подписать ЭЦП».

---

## Приложение A. API-контракт, который ожидает фронтенд

Все запросы — `fetch(url, { credentials: 'include' })`, JSON. Клиент: `src/lib/api.ts`, типы: `src/lib/types.ts`, нормализация ответов: `src/lib/normalize.ts` (принимает как «голый» массив, так и обёртку `{ items }` / `{ requests }` и т.п.).

| Метод | Путь | Тело запроса | Ожидаемый ответ |
|-------|------|--------------|-----------------|
| POST | `/api/auth/login` | `{ email, password }` | `{ user }` + cookie сессии |
| POST | `/api/auth/logout` | — | `204/200` |
| GET | `/api/auth/me` | — | `{ user }`, `401` если не авторизован |
| GET | `/api/dashboard` | — | `{ nextLesson, deadlines[], activeRequest, averageScore, announcements[] }` |
| GET | `/api/schedule` | — | `{ lessons[] }` — `Lesson { id, subject, type, teacher, room, oldRoom?, isRescheduled, dayOfWeek (1–6) \| date, startTime "HH:MM", endTime }` |
| GET | `/api/study` | — | `{ assignments[], materials[] }` |
| POST | `/api/study/assignments/[id]/submit` | `{ link, comment }` | `{ assignment }` или `{ submission }` |
| GET | `/api/grades` | — | `{ subjects[] }` — `{ id, name, labs, labsMax, rk, rkMax, attendance, attendanceMax, total }` |
| GET | `/api/requests` | — | `{ requests[] }` (ADMIN — все заявки, с `student`) |
| POST | `/api/requests` | `{ type, comment? }` | `{ request }` |
| GET | `/api/requests/[id]` | — | `{ request }`, чужая — `403` |
| PATCH | `/api/requests/[id]` | `{ status: 'APPROVED' \| 'REJECTED', comment? }` | `{ request }` |
| POST | `/api/admin/announcements` | `{ type: 'URGENT' \| 'ROOM_CHANGE', title, body, group?, subject?, oldRoom?, newRoom? }` | `{ announcement }` |
| POST | `/api/ai/chat` | `{ message, mode: 'TUTOR' \| 'DEANERY', history[], context? }` | `{ reply, suggestions?[] }` |

Енамы: `Role = STUDENT | ADMIN`; `RequestStatus = CREATED | PENDING | APPROVED | REJECTED` (`IN_REVIEW` трактуется как `PENDING`); `RequestType = STUDY_CERTIFICATE | MILITARY_CERTIFICATE | FINANCIAL_AID | RETAKE`; `MaterialCategory = NOTES | CHEATSHEET | TICKETS | LAB_TEMPLATE`; `AssignmentStatus = ACTIVE | SUBMITTED | GRADED | OVERDUE`.

Если поля бэкенда называются иначе — правится только `src/lib/normalize.ts`.

Для демо без бэкенда: `NEXT_PUBLIC_API_MOCK=1` включает встроенные моки (`src/lib/mock/**`) с теми же тремя демо-аккаунтами.

## Приложение B. Запуск фронтенда

```bash
npm install
npm run dev                         # с реальным бэкендом (src/app/api/**)
NEXT_PUBLIC_API_MOCK=1 npm run dev  # без бэкенда, на встроенных моках
```

Демо-аккаунты (кнопки «Быстрый вход для жюри» на `/login`):

| Роль | Email | Пароль |
|------|-------|--------|
| Студент-отличник | alexey.sokolov@edu.orbita.ru | Student2026! |
| Студент с задолженностью | maria.kuznetsova@edu.orbita.ru | Student2026! |
| Сотрудник деканата | dekanat@edu.orbita.ru | Admin2026! |
