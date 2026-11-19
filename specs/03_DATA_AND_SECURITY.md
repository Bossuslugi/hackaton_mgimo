# 03 · Данные и безопасность

> Статус: утверждено для прототипа · Источник истины для схемы — `prisma/schema.prisma`; этот документ описывает смысл полей и обязательные правила доступа. Любое изменение схемы или правил сначала вносится сюда.

## 1. Хранилище

- **SQLite + Prisma ORM** (`prisma/dev.db`). Нет внешних сервисов и сетевых зависимостей — стенд работает из РФ без VPN, изменения жюри сохраняются сразу.
- SQLite не поддерживает `enum` в Prisma, поэтому перечисления хранятся строками. Допустимые значения — в `src/lib/domain.ts`; API отклоняет всё остальное (`400`).
- Пересоздать БД с демо-данными: `npm run db:setup` (= `prisma db push --force-reset` + `prisma db seed`).

## 2. Модели

### User

| Поле | Тип | Примечание |
|------|-----|------------|
| `id` | cuid | |
| `email` | string, unique | логин, хранится в нижнем регистре |
| `passwordHash` | string | bcrypt, cost 10; **никогда** не покидает сервер |
| `fullName` | string | |
| `role` | `STUDENT` \| `ADMIN` | |
| `faculty`, `program`, `course`, `groupName` | | учебные атрибуты студента |
| `studyForm` | `Бюджет` \| `Договор` | основа обучения |
| `studentCardNumber`, `curatorName`, `scholarshipStatus` | string? | |
| `position` | string? | должность сотрудника деканата |

### ScheduleItem

`groupName`, `dayOfWeek` (1–6), `startTime`/`endTime` (`HH:MM`), `subject`, `type` (`Лекция` \| `Практика` \| `Лабораторная`), `building`, `room`, `oldRoom?`, `teacher`, `isRescheduled`. Расписание принадлежит группе, а не пользователю: студент получает строки по `groupName` **из своей записи в БД**, а не из параметра запроса.

### SubjectGrade

`userId` → User, `subject`, `teacher`, `controlType` (`Экзамен` \| `Зачёт`), `labsScore/labsMax`, `midtermScore/midtermMax`, `attendanceScore/attendanceMax`, `examMax`, `currentTotal` (= labs + midterm + attendance, 0–100). Уникальность `(userId, subject)`. Правила расчёта — `01_PRODUCT_PRD.md` §3.4.

### Assignment

`userId` → User, `subject`, `title`, `description`, `deadline` (ISO-8601 строка), `brsWeight`, `status` (`TODO` \| `SUBMITTED` \| `GRADED` \| `OVERDUE`), `submissionUrl?`, `studentComment?`, `submittedAt?`, `score?`.

### StudyMaterial

`faculty`, `subject`, `title`, `category` (`Конспект` \| `Шпаргалка к РК` \| `Билеты` \| `Шаблон лабы`), `readTimeMinutes`, `contentMarkdown`. Доступ — по факультету студента.

### DocumentRequest

`id` (autoincrement Int — **намеренно предсказуемый**, см. §4.3), `userId` → User, `type` (`STUDY_CERTIFICATE` \| `MILITARY_CERTIFICATE` \| `FINANCIAL_AID` \| `RETAKE` \| `PGAS`), `status` (`NEW` \| `IN_REVIEW` \| `APPROVED` \| `REJECTED`), `comment?`, `adminComment?`, `registryNumber` (unique, `ОРБ-<год>-<NNNN>`), `reviewedBy?`, `createdAt`, `updatedAt`.

### Notification

`userId` → User, `category` (`DEADLINE` \| `SCHEDULE` \| `REQUEST` \| `DEAN`), `title`, `message`, `isRead`, `isCritical`, `createdAt`.

Все связи с User — `onDelete: Cascade`.

## 3. Аутентификация

### 3.1. Пароли

- Хеширование **bcryptjs**, cost factor 10 (`src/lib/password.ts`). Чистая JS-реализация — без нативной сборки на Windows/macOS/Linux.
- Сравнение — только `bcrypt.compare`. Если пользователь не найден, всё равно выполняется `compare` с фиктивным хешем, чтобы время ответа не выдавало существование email.
- Ответ на любую ошибку входа одинаков: `401 { error: "Неверный email или пароль" }`.
- Ограничение перебора: 5 неудачных попыток на пару «IP + email» за 15 минут → `429` (in-memory, `src/lib/rate-limit.ts`; для продакшена — Redis).

### 3.2. Сессия: JWT в HttpOnly-cookie

- Библиотека **jose** (`src/lib/jwt.ts`), алгоритм `HS256`, секрет — `process.env.JWT_SECRET` (≥ 32 символа).
- Полезная нагрузка: `{ sub: userId, role }`, `iat`, `exp` = +8 ч, `iss = "orbita"`, `aud = "orbita-web"`. При проверке жёстко заданы алгоритм, `iss` и `aud`.
- Cookie `orbita_token`: `HttpOnly; SameSite=Lax; Path=/; Max-Age=28800`, `Secure` в production. JavaScript страницы токен не видит → XSS не может его украсть.
- Выход — перезапись cookie с `Max-Age=0`.
- Если `JWT_SECRET` не задан: в production сервер отказывается выпускать/проверять токены (ошибка конфигурации); в development генерируется случайный секрет на время жизни процесса (с предупреждением в консоли), чтобы стенд запускался «из коробки».

### 3.3. Проверка на каждом запросе

1. `src/middleware.ts` (matcher `/api/:path*`): для всех путей, кроме `POST /api/auth/login`, проверяет подпись и срок токена; невалидный/отсутствующий → `401` ещё до обработчика. Для изменяющих методов (`POST/PATCH/PUT/DELETE`) сверяет заголовок `Origin` с `Host` → иначе `403` (защита от CSRF поверх `SameSite=Lax`).
2. Каждый обработчик повторно вызывает `requireSession()` (`src/lib/session.ts`) — middleware не единственный рубеж. Сессия дополнительно сверяется с БД: если пользователь удалён или его роль изменилась, токен не принимается.
3. **`userId` и `role` берутся только из верифицированного токена.** Никакие `userId`, `role`, `groupName`, `faculty` из тела, query или заголовков не используются для авторизации.

## 4. Авторизация и защита от IDOR

### 4.1. Принципы

- **Deny by default**: обработчик начинает с `requireSession()` / `requireRole('ADMIN')`.
- **Владение проверяется в запросе к БД**: студенческие выборки всегда содержат `where: { userId: session.userId }` (или `groupName`/`faculty` из записи пользователя).
- **Объект по id**: сначала загрузить, затем сравнить владельца с `session.userId`, и только потом отдавать или менять.
- Ответ никогда не содержит `passwordHash` — сериализация пользователя идёт через белый список полей (`src/lib/serializers.ts`).

### 4.2. Матрица доступа

| Ресурс | STUDENT | ADMIN |
|--------|---------|-------|
| `GET /api/auth/me` | себя | себя |
| `GET /api/dashboard` | свой дашборд | статистика заявок |
| `GET /api/schedule` | только своя группа | все группы |
| `GET /api/grades` | только свои | `403` (нет учебных данных) |
| `GET /api/study` | свои задания + материалы своего факультета | все материалы, заданий нет |
| `POST /api/study/assignments/[id]/submit` | только своё задание, иначе `403` | `403` |
| `GET /api/requests` | только свои | все + `user { fullName, groupName, faculty }` |
| `POST /api/requests` | создаёт **для себя** | `403` |
| `GET /api/requests/[id]` | только своя, иначе `403` | любая; несуществующая — `404` |
| `PATCH /api/requests/[id]` | `403` | да |
| `GET /api/notifications`, `POST /api/notifications/read-all` | только свои | только свои |
| `POST /api/admin/announcements` | `403` | да |
| `POST /api/ai/chat` | контекст только из своих данных | общий режим без персональных данных студентов |

### 4.3. Критичный эндпоинт `GET /api/requests/[id]`

- Если `role === 'STUDENT'` и `request.userId !== session.userId` → `403 { error: "Доступ запрещён: попытка обращения к чужой заявке (IDOR protection)" }`.
- Для студента **несуществующий** id тоже даёт тот же `403`: иначе разница `403`/`404` превращается в оракул, по которому можно перечислить чужие заявки.
- id заявок — последовательные числа (1, 2, 3…). Это сознательное решение для демонстрации: защита не опирается на «секретность» идентификатора.
- Каждая заблокированная попытка пишется в серверный лог `[security] IDOR blocked` с `userId` и id заявки.
- Аналогично для `POST /api/study/assignments/[id]/submit`: чужое или несуществующее задание → `403`.

### 4.4. Валидация входа

- Все тела запросов проверяются схемами **zod** (`src/lib/validation.ts`): типы, длины, перечисления. Неизвестные поля игнорируются; лишние поля вида `userId`/`role` не имеют эффекта.
- `submissionUrl` — только `https://`, до 2048 символов.
- Ограничения длины: комментарий ≤ 1000, сообщение ИИ ≤ 2000, заголовок объявления ≤ 200, текст ≤ 2000.
- Некорректный JSON → `400`.

## 5. Секреты и конфигурация

| Переменная | Назначение | Обязательна |
|------------|------------|-------------|
| `JWT_SECRET` | подпись сессионных JWT, ≥ 32 символа | в production — да |
| `AI_API_KEY` | ключ OpenAI-совместимого LLM | нет (без него — rule-based ответы) |
| `AI_BASE_URL` | базовый URL API (по умолчанию `https://api.openai.com/v1`) | нет |
| `AI_MODEL` | имя модели (по умолчанию `gpt-4o-mini`) | нет |

- Секреты читаются только в серверном коде (`src/lib/**`, `src/app/api/**`). Ни одна переменная не имеет префикса `NEXT_PUBLIC_`, поэтому Next.js не встраивает их в клиентский бандл.
- `.env` в `.gitignore`; в репозитории только `.env.example` без значений.
- Ошибки LLM-провайдера логируются на сервере без ключа и без тела запроса; клиент получает rule-based ответ.
- Ответы `500` не содержат stack trace — только `{ error: "Внутренняя ошибка сервера" }`.

## 6. Прочие меры

- **Rate limiting**: вход (§3.1), ИИ-чат — 20 запросов/мин на пользователя.
- **Минимизация данных**: ADMIN в списке заявок получает только `fullName`, `groupName`, `faculty`, `email` владельца.
- **Персональные данные**: все демо-данные вымышлены; в контекст LLM уходят только данные текущего пользователя.
- **Аудит**: смена статуса заявки фиксирует `reviewedBy` и создаёт уведомление владельцу.

## 7. Известные ограничения прототипа

- Rate limiting и dev-секрет живут в памяти процесса и сбрасываются при перезапуске.
- Нет отзыва токенов до истечения срока (кроме удаления пользователя/смены роли).
- Нет загрузки файлов — сдача ДЗ только ссылкой.
