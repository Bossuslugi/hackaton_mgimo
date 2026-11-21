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


---

# V2 · Данные и безопасность

> Статус: реализовано · Схема V1 не меняется деструктивно: только новые поля (nullable или со значением по умолчанию) и новые модели. Пересоздать стенд: `npm run db:setup`.

## V2.1. Изменения моделей

### User

| Поле | Тип | Примечание |
|------|-----|------------|
| `role` | `STUDENT` \| `ADMIN` \| **`TEACHER`** | роль преподавателя |
| `department` | string? | кафедра преподавателя |
| `campusHoursWeek` | float, default 22.5 | часы в кампусе за неделю |
| `campusHoursSemester` | int, default 318 | часы в кампусе за семестр |

### Assignment

| Поле | Тип | Примечание |
|------|-----|------------|
| `authorId` | string? | id преподавателя-автора; **основа проверки прав на оценку** |
| `authorName` | string, default «Доц. Волков И.С.» | подпись автора для UI |
| `groupName` | string, default «М3203» | группа, которой выдано задание |
| `taskPrompt` | string, default «» | условие в Markdown |
| `starterTemplate` | string? | шаблон кода/ответа |
| `solutionText` | string? | решение студента (≤ 20 000 символов) |
| `gradeAwarded` | int? | балл преподавателя, `0…brsWeight` |
| `teacherFeedback` | string? | комментарий преподавателя (≤ 2000) |
| `materialId` | string? → StudyMaterial | привязанная методичка, `onDelete: SetNull` |

Онлайн-задание хранится **отдельной строкой на каждого студента** (как в V1): владелец строки — `userId`, автор — `authorId`. Так IDOR-правила V1 для студента не меняются.

### DocumentRequest

`payloadJson` (string?) — JSON структурированных полей формы, ≤ 4000 символов. Схема полей зависит от типа (`01_PRODUCT_PRD.md` §V2.7) и проверяется zod; в БД попадает только нормализованный результат. В API отдаётся и строкой `payloadJson`, и разобранным объектом `payload`. Новые типы: `ACADEMIC_TRANSCRIPT`, `DORMITORY_PASS`.

### Notification

Новая категория `GRADE` — оценка преподавателя.

### RoomBooking (новая)

`id`, `userId` → User, `roomName`, `building`, `date` (`YYYY-MM-DD`, московская дата), `timeSlot` (`"15:20 – 16:50"`), `purpose`, `participantsCount`, `status` (`CONFIRMED` \| `CANCELLED`), `createdAt`, служебное `activeSlotKey`.

`activeSlotKey = "<roomName>|<date>|<timeSlot>"` у активной брони и `NULL` у отменённой, поле **уникально**. Проверка «слот свободен» делается в коде (для понятного `409`), а уникальный индекс гарантирует отсутствие двойной брони даже при одновременных запросах: второй `INSERT` падает с нарушением уникальности и тоже превращается в `409`.

`roomName` и `building` должны совпадать с каталогом помещений (`src/lib/domain.ts → ROOMS_CATALOG`); `building` из тела запроса игнорируется — берётся из каталога.

### DirectMessage (новая)

`id`, `senderId` → User, `receiverId` → User, `content` (≤ 2000), `isRead`, `createdAt`. Индексы по `(senderId, receiverId, createdAt)` и `(receiverId, isRead)`.

## V2.2. Роль TEACHER в правилах V1

| Эндпоинт V1 | TEACHER |
|-------------|---------|
| `GET /api/dashboard` | дашборд преподавателя (без данных деканата) |
| `GET /api/schedule` | `mode=my` — только его занятия (по совпадению ФИО в расписании) |
| `GET /api/grades` | `403` — нет собственных оценок |
| `GET /api/study` | все материалы, `assignments: []` (выданные им задания — в `/api/teacher/assignments`) |
| `GET /api/requests`, `GET /api/requests/[id]` | как у студента: только свои заявки, чужая или несуществующая → `403` |
| `POST /api/requests`, `PATCH /api/requests/[id]`, `POST /api/admin/announcements` | `403` |
| `POST /api/ai/chat` | справочный режим без персональных данных студентов |

Правило IDOR для `GET /api/requests/[id]` в V2 сформулировано через «не ADMIN», а не «STUDENT»: любая роль, кроме деканата, видит только свои заявки.

## V2.3. Изоляция переписок (мессенджер)

1. **Контакт-лист — это ACL.** `canMessage(me, peer)`:
   - `me` — STUDENT: `peer` — STUDENT той же группы, либо TEACHER, либо ADMIN;
   - `me` — TEACHER или ADMIN: любой пользователь;
   - сам себе — нельзя.
2. `GET /api/messages/[peerId]` выбирает сообщения строго условием
   `(senderId = session.userId AND receiverId = peerId) OR (senderId = peerId AND receiverId = session.userId)`.
   Параметр задаёт только **собеседника**, вторым участником всегда остаётся `session.userId`, поэтому запросом нельзя получить переписку двух других людей — она недостижима в принципе.
3. Если `peer` не проходит `canMessage` или не существует — `403` (одинаково, без оракула существования). Исключение: если переписка уже есть (например, преподаватель написал студенту другой группы), студент может её читать и отвечать.
4. Отметка «прочитано» ставится только сообщениям, где `receiverId = session.userId`.
5. Отправитель — всегда `session.userId`; поля `senderId`/`receiverId` из тела игнорируются.
6. Rate limit — 30 сообщений в минуту на пользователя.

## V2.4. Изоляция броней

- `POST /api/bookings` — владелец брони только `session.userId`.
- `DELETE /api/bookings/[id]`: бронь загружается по id; если `booking.userId !== session.userId` **или бронь не существует** → `403 { error: "Доступ запрещён: бронь принадлежит другому пользователю (IDOR protection)" }` и лог `[security] IDOR blocked`. Деканат тоже не отменяет чужие брони через этот эндпоинт.
- `GET /api/bookings`: `myBookings` — только свои; в `allBookingsToday` и сетке занятости чужие брони обезличены: нет `userId`, ФИО и `purpose`, только помещение, слот, число участников и `isMine`.

## V2.5. Кабинет преподавателя

- `requireRole('TEACHER', 'ADMIN')` на всех `/api/teacher/*`; STUDENT → `403`.
- **Создание**: TEACHER выдаёт задание только группе, в расписании которой он значится преподавателем (`ScheduleItem.teacher` = «Фамилия И. О.»), иначе `403`. ADMIN — любой группе. `authorId` = `session.userId`.
- **Просмотр**: TEACHER видит только строки с `authorId = session.userId`; ADMIN — все задания с автором. Студенческие данные в ответе ограничены `{ id, fullName, groupName }`.
- **Оценка** `PATCH /api/teacher/assignments/[id]/grade`: если `assignment.authorId !== session.userId` (для TEACHER) или задания нет → `403` (IDOR, без оракула). Для ADMIN несуществующее → `404`.
- Изменение БРС при оценке делается в одной транзакции с оценкой и уведомлением.

## V2.6. Новые ограничения ввода

| Поле | Ограничение |
|------|-------------|
| `solutionText` | ≤ 20 000 символов |
| `taskPrompt` | 1…20 000; `starterTemplate` ≤ 20 000; `description` ≤ 2000 |
| `deadline` | ISO-8601 в будущем, не дальше 180 дней |
| `brsWeight` | целое 1…40; `gradeAwarded` — целое `0…brsWeight` |
| `content` сообщения | 1…2000 после `trim` |
| `date` брони | `YYYY-MM-DD`, сегодня…+14 дней; `timeSlot` — из списка; `purpose` 3…200; `participantsCount` 1…вместимость |
| `payload` заявки | по схеме типа, сериализованный JSON ≤ 4000 символов |
| поиск расписания | `query` 1…50 символов, обязателен для `mode=group|room` |


---

# V3 · Данные и безопасность

> Статус: реализовано · Только аддитивные изменения схемы (nullable-поля и поля со значениями по умолчанию, новые модели, индексы).

## V3.1. Изменения моделей

### User

| Поле | Тип | Примечание |
|------|-----|------------|
| `avatarUrl` | string? | `data:image/(png\|jpeg\|webp);base64,…` (≤ 500 КБ после декодирования) или `https://`-URL |
| `avatarUpdatedAt` | DateTime? | версия аватара для кеширования (`?v=`) |
| `wifiLogin` | string, default `stud_orbita` | логин сети `Orbita-Edu-5G`, в сиде уникален у каждого |
| `wifiPassword` | string, default `Orbita#2026WiFi` | см. §V3.3 |
| `wifiUpdatedAt` | DateTime, default now() | |
| `peCurrentPoints` | int, default 14 | баллы/посещения физкультуры |
| `peTargetPoints` | int, default 20 | порог зачёта |

### StudyMaterial

`quizJson` (string?) — банк проверочных вопросов по методичке: `[{ question, options[4], correctIndex, explanation }]`.

### CampusEvent (новая)

`id`, `title`, `category` (`Хакатон` \| `Митап` \| `Карьера` \| `Наука` \| `Клубы`), `description`, `date` (`YYYY-MM-DD`), `timeRange`, `location`, `organizer`, `capacity`, `registeredCount`, `tags` (через запятую). Индекс `(date)`.

### EventRegistration (новая)

`id`, `eventId` → CampusEvent, `userId` → User, `ticketCode` (**unique**, `EVT-<год>-XXXX`), `createdAt`. `@@unique([eventId, userId])`, индекс `(userId)`.

### SportSection (новая)

`id`, `sportType` (`Плавание` \| `Скалолазание` \| `Футбол` \| `Баскетбол` \| `Настольный теннис` \| `Тренажёрный зал` \| `Киберспорт`), `title`, `coachName`, `campusLocation`, `scheduleText`, `capacity`, `enrolledCount`.

### SportEnrollment (новая)

`id`, `userId` → User (**unique** — одна секция в семестре), `sectionId` → SportSection, `updatedAt`. Индекс `(sectionId)`.

`registeredCount` и `enrolledCount` — агрегаты, включающие и студентов вне демо-набора; в сиде они согласованы с демо-записями.

### Индексы V3

| Модель | Индексы |
|--------|---------|
| User | `groupName`, `role+groupName` |
| Assignment | `userId`, `userId+status`, `authorId`, `groupName` |
| Notification | `userId+isRead`, `userId+createdAt` |
| DocumentRequest | `userId`, `status`, `userId+type+status` |
| DirectMessage | `senderId`, `receiverId`, `senderId+receiverId+createdAt`, `receiverId+isRead` |
| RoomBooking | `userId`, `date+roomName` |
| EventRegistration | `userId`; unique `eventId+userId` |
| SportEnrollment | `sectionId`; unique `userId` |

## V3.2. Правила доступа V3

| Эндпоинт | STUDENT | TEACHER | ADMIN |
|----------|---------|---------|-------|
| `POST/DELETE /api/profile/avatar` | только свой аватар | только свой | только свой |
| `GET /api/profile/avatar/[userId]` | любой авторизованный (аватар — публичная часть профиля внутри вуза) | ✓ | ✓ |
| `GET /api/campus/services`, `POST /api/campus/wifi/rotate` | только свои данные | только свои | только свои |
| `GET /api/campus/events`, `POST …/[id]/toggle` | ✓, своя регистрация | ✓ | ✓ |
| `GET /api/campus/sports` | ✓ | каталог | каталог |
| `POST /api/campus/sports/[id]/enroll` | ✓ | `403` | `403` |
| `POST /api/ai/quiz` | методички **своего факультета**, чужие/несуществующие → `403` | любые | любые |

Во всех V3-эндпоинтах владелец — `session.userId`; ни один из них не принимает `userId` в теле или query. Путь `[id]` у событий и секций — это id **публичного каталога**, а не чужого ресурса; регистрация и запись всегда создаются и удаляются только для `session.userId`.

## V3.3. Секреты пользователя: Wi-Fi и лицензии

- `wifiPassword` — секрет, который владелец должен **видеть** (чтобы ввести на устройстве), поэтому он хранится в открытом виде, а не хешем. Компенсирующие меры:
  - отдаётся только в `GET /api/campus/services` и `POST /api/campus/wifi/rotate` и только владельцу;
  - **не входит** в `serializeUser`/`serializeContact`, `/api/auth/me`, дашборды, контекст ИИ и логи;
  - ответы — `Cache-Control: no-store`;
  - в production пароль должен жить в RADIUS/IdP, а здесь — только ссылка (`03` §7, ограничения прототипа).
- Генерация пароля — `crypto.randomInt` (CSPRNG), алфавит из 31 символа без похожих (`0 O 1 I L`), 12 символов → ≈ 59 бит энтропии. Смена — не чаще 5 раз в час на пользователя (`429`).
- Ключи лицензий не хранятся и не отдаются целиком: `keyHint` — маска с последними 4 символами, производными от `userId` (демо).

## V3.4. Аватары

- `avatarDataUrl` проверяется строго:
  1. формат `^data:image/(png|jpeg|webp);base64,<base64>$`, без параметров и пробелов;
  2. размер после декодирования ≤ 500 КБ;
  3. **сигнатура** совпадает с заявленным типом: PNG `89 50 4E 47 0D 0A 1A 0A`, JPEG `FF D8 FF`, WebP `RIFF????WEBP`. SVG и любые другие типы отклоняются (`400`): SVG может содержать скрипты.
- Альтернатива — `https://`-URL до 2048 символов, без учётных данных в URL (`user:pass@`), только схема `https`.
- `GET /api/profile/avatar/[userId]` отдаёт байты из data-URI с заголовками `Content-Type` (из проверенного типа), `X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src 'none'`, `Cache-Control: private, max-age=86400` (URL версионирован `?v=`). Для URL-аватаров — `404` (клиент берёт `https`-ссылку из профиля напрямую), для пользователя без аватара — `404`.
- В списочных ответах data-URI не передаётся — только ссылка на этот эндпоинт.

## V3.5. Целостность счётчиков (события и секции)

- Запись на событие и в секцию идёт в транзакции Prisma:
  - инкремент — условный `updateMany` с `registeredCount < capacity` (`enrolledCount < capacity`); если обновлено 0 строк → `409`, транзакция откатывается;
  - вставка регистрации защищена уникальными индексами (`eventId+userId`, `SportEnrollment.userId`): параллельный дубль падает с `P2002` и превращается в корректный ответ, а не во второй инкремент;
  - отмена/смена секции декрементирует счётчик не ниже 0.
- Коллизия `ticketCode` (unique) → до 5 повторных генераций.
- Прошедшее событие (`date` < сегодня по МСК) изменить нельзя (`409`).

## V3.6. ИИ-квиз

- `materialId` → материал; для STUDENT проверяется `material.faculty === user.faculty`, иначе одинаковый `403` для чужого и несуществующего (без оракула).
- В LLM уходит только текст методички (≤ 6000 символов), без персональных данных. Ответ LLM валидируется схемой (ровно 4 варианта, `correctIndex` 0–3, непустые строки); невалидный ответ → локальный генератор.
- Лимит — 20 запросов в минуту на пользователя (отдельно от чата).
