# 02 · Дизайн-система «Орбита»

> Статус: **утверждено для реализации**. Код фронтенда (`src/app/**` кроме `src/app/api/**`, `src/components/**`, `src/lib/**`) обязан соответствовать этому документу. Любое отклонение — сначала правка спеки, потом код.

Продукт — «Цифровой деканат будущего». Тон интерфейса: дорогой академический финтех. Ориентиры — Linear, Vercel, Raycast, Т-Банк. Спокойно, плотно, точно.

---

## 1. Анти-вайбкод правила (жёсткие запреты)

| # | Запрет | Чем заменяем |
|---|--------|--------------|
| 1 | Радужные и неоновые градиенты (`from-indigo-500 via-purple-500 to-pink-500` и любые `bg-gradient-*` с ≥2 хроматическими цветами), glow-пятна, `blur-3xl` цветные фоны, кислотные акценты — **в обеих темах** | Плоские поверхности, один акцент: `#2563EB` (светлая) / `#3B82F6` (Obsidian Dark) |
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

### 2.6 Obsidian Dark (V2, тема по умолчанию)

Тёмная тема — по умолчанию. Переключатель Dark / Light — иконка в шапке (`ThemeToggle`) и сегмент в профиле (`ThemeSwitch`). Выбор хранится в `localStorage['orbita-theme']`; класс `.dark` на `<html>` ставит inline-скрипт в `<head>` (`THEME_BOOT_SCRIPT`, `src/lib/theme.ts`) до первой отрисовки — без мигания. Смена темы — `transition-colors` 200 мс через временный класс `theme-transition`.

Вариант `dark:` объявлен в `globals.css` через `@custom-variant dark` и ограничен `@media screen`: **печатная справка всегда уходит на бумагу в светлой теме**.

| Токен | HEX | Tailwind |
|-------|-----|----------|
| Background Primary | `#09090B` | `dark:bg-zinc-950` |
| Surface Card | `#12141A` + рамка `1px #27272A` | `dark:bg-[#12141A] dark:border-zinc-800` |
| Surface Elevated / Input / Code | `#18181B` | `dark:bg-zinc-900` |
| Text Primary | `#FAFAFA` | `dark:text-zinc-50` |
| Text Secondary | `#A1A1AA` | `dark:text-zinc-400` |
| Brand Accent | `#3B82F6` | `dark:bg-blue-500`, текст-ссылки `dark:text-blue-400` |

Семантические бейджи в тёмной теме:

| Тип | Классы |
|-----|--------|
| Success | `dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60` |
| Warning | `dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/60` |
| Danger | `dark:bg-red-950/60 dark:text-red-300 dark:border-red-800/60` |
| Brand | `dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/30` |
| Neutral | `dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800` |

**Правило парности.** Каждый светлый цветовой класс в `src/app/**` и `src/components/**` имеет парный `dark:`-класс по таблице маппинга в `scripts/dark-codemod.mjs` (`bg-white → dark:bg-[#12141A]`, `bg-slate-50 → dark:bg-zinc-900`, `border-slate-200 → dark:border-zinc-800`, `text-slate-600 → dark:text-zinc-400`, `bg-blue-600 → dark:bg-blue-500` …). Ручной `dark:`-класс в той же строке классов имеет приоритет. Проверка перед коммитом:

```bash
node scripts/dark-codemod.mjs --check   # exit 1, если где-то не хватает dark-пары
node scripts/dark-codemod.mjs           # дописать недостающие пары
```

Графики (`StatsWidget`): серия «Пары» — `blue-600 / dark:blue-500`, «Самостоятельная работа» — `teal-600`; палитра прошла проверку контраста и различимости при дальтонизме в обеих темах. Величины без идентичности (структура недели) — один тон brand.

### 2.2 Типографика

- Шрифт: **Inter** (`next/font/google`, subsets `latin` + `cyrillic`), фичи `cv11`, `ss01`. Моноширинный: **JetBrains Mono** (`next/font/google`, `--font-jetbrains`) — редактор решений, код студентов, реестровые номера.
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
| `< lg` (до 1024px) | Хедер `h-14` (логотип, Copilot, **сообщения со счётчиком**, колокольчик, **переключатель темы**, аватар). Снизу фиксированный **Bottom Tab Bar `h-16`**: студент — ровно 5 разделов (Сводка, Расписание, Учёба и ДЗ, БРС, Справки), преподаватель — 4 (Сводка, Расписание, Кабинет, Профиль). «Сообщения» в tab bar не добавляются. Контенту — `pb-24`. Учитывать `env(safe-area-inset-bottom)` |
| `≥ lg` | Левый сайдбар **240px** (фикс) с секцией «Связь → Сообщения» и бейджем непрочитанных, верхний хедер `h-16`: поле-кнопка «Спросить Орбита Copilot» (+ `⌘K`), сообщения, колокольчик, тема, профиль |

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
| `Button` `square` | sm 36 / md 40 / lg 44 | Иконка-кнопка без текста; на мобильном — `max-sm:size-11` |
| `ThemeToggle` / `ThemeSwitch` | — | Иконка Sun/Moon в шапке; сегмент «Obsidian Dark / Светлая» в профиле |
| `CodeEditor` | — | `<textarea>` + жёлоб нумерации строк, JetBrains Mono, Tab → 4 пробела, `wrap=off`. Без внешних зависимостей |
| `Workspace` | — | Рабочая зона задачи: fullscreen-слой; ≥ lg — Split-View (условие / решение), < lg — вкладки «Условие / Решение» и липкая кнопка отправки |

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

Енамы: `Role = STUDENT | ADMIN | TEACHER`; `RequestStatus = CREATED | PENDING | APPROVED | REJECTED` (`IN_REVIEW` трактуется как `PENDING`); `RequestType = STUDY_CERTIFICATE | MILITARY_CERTIFICATE | ACADEMIC_TRANSCRIPT | FINANCIAL_AID | PGAS | RETAKE | DORMITORY_PASS`; `MaterialCategory = NOTES | CHEATSHEET | TICKETS | LAB_TEMPLATE`; `AssignmentStatus = ACTIVE | SUBMITTED | GRADED | OVERDUE`.

Если поля бэкенда называются иначе — правится только `src/lib/normalize.ts`.

Для демо без бэкенда: `NEXT_PUBLIC_API_MOCK=1` включает встроенные моки (`src/lib/mock/**`) с теми же тремя демо-аккаунтами.

### A.2 Эндпоинты V2, которые использует фронтенд

Нормализация — `src/lib/normalize-v2.ts`.

| Экран | Метод | Путь |
|-------|-------|------|
| Учёба (студент) — сдача решения | POST | `/api/study/assignments/[id]/submit` `{ solutionText?, submissionUrl?, studentComment? }` |
| Кабинет преподавателя | GET / POST | `/api/teacher/assignments` |
| Проверка решения | PATCH | `/api/teacher/assignments/[id]/grade` `{ gradeAwarded, teacherFeedback? }` |
| Сообщения | GET | `/api/messages` (контакты + `unreadTotal`, опрос раз в 30 с) |
| Диалог | GET / POST | `/api/messages/[peerId]` (опрос раз в 10 с, оптимистичная отправка) |
| Поиск расписания | GET | `/api/schedule?mode=group\|room&query=…` |
| Бронирования | GET / POST / DELETE | `/api/bookings[?date=]`, `/api/bookings/[id]` (409 → ошибка в форме + перезагрузка сетки) |
| Заявки с полями | POST | `/api/requests` `{ type, comment?, payload? }` — поля схемы `payload` (`04` §V2.8), прочее (способ получения, портфолио, маска карты МИР) — построчно в `comment` |
| Статистика | GET | `/api/stats` |

«Написать преподавателю» ищет контакт по фамилии и первому инициалу (`findTeacher`) и открывает `/messages?peer=<id>&draft=<текст>`; если преподавателя нет среди контактов — список преподавателей.

Номер карты МИР проверяется на клиенте (диапазон 2200–2204 + Luhn) и в заявку уходит только маска `•••• 1234`.

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
| Преподаватель (доцент) | volkov.igor@edu.orbita.ru | Teacher2026! |
