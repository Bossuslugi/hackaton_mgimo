# 04 · API-контракт

> Статус: реализовано (`src/app/api/**`) · Правила доступа — `03_DATA_AND_SECURITY.md` §4 · Бизнес-логика — `01_PRODUCT_PRD.md`.
>
> Этот документ — источник истины для формы запросов и ответов. Приложение A в `02_DESIGN_SYSTEM.md` описывает, что ожидает фронтенд; бэкенд принимает оба варианта имён полей и отдаёт совместимые алиасы (см. §1.4).

## 1. Общие правила

### 1.1. Транспорт

- JSON, UTF-8. Все ответы — `Cache-Control: no-store`.
- Сессия: HttpOnly-cookie `orbita_token` (JWT HS256, 8 ч). Клиент шлёт `credentials: 'include'`.
- **`userId` и `role` берутся только из верифицированного токена.** Поля `userId`, `role` и т.п. в теле игнорируются.
- Изменяющие запросы (`POST/PATCH/PUT/DELETE`) с заголовком `Origin` другого хоста → `403` (CSRF).

### 1.2. Ошибки

```json
{ "error": "Человекочитаемое сообщение на русском", "details": [{ "path": "submissionUrl", "message": "…" }] }
```

| Код | Когда |
|-----|-------|
| `400` | невалидный JSON или тело не прошло схему (`details` — список проблем) |
| `401` | нет cookie, токен подделан/истёк, пользователь удалён; неверный логин/пароль |
| `403` | роль не подходит; чужой объект (IDOR); чужой Origin |
| `404` | объект не найден (только там, где это не создаёт оракул, — для ADMIN) |
| `409` | конфликт состояния: дубликат активной заявки, закрытая заявка, оценённое задание |
| `429` | превышен лимит (вход, ИИ-чат); заголовок `Retry-After` |
| `500` | `{ "error": "Внутренняя ошибка сервера" }` без деталей |

### 1.3. Перечисления

| Сущность | Значения в API |
|----------|----------------|
| `role` | `STUDENT`, `ADMIN` |
| `Lesson.type` | `LECTURE`, `PRACTICE`, `LAB` (+ `typeLabel`: Лекция / Практика / Лабораторная) |
| `Assignment.status` | `TODO`, `SUBMITTED`, `GRADED`, `OVERDUE` (OVERDUE вычисляется сервером по дедлайну) |
| `Material.category` | `NOTES`, `CHEATSHEET`, `TICKETS`, `LAB_TEMPLATE` (+ `categoryLabel`: Конспект / Шпаргалка к РК / Билеты / Шаблон лабы) |
| `Request.type` | `STUDY_CERTIFICATE`, `MILITARY_CERTIFICATE`, `FINANCIAL_AID`, `RETAKE`, `PGAS` (+ `typeLabel`) |
| `Request.status` | `NEW`, `IN_REVIEW`, `APPROVED`, `REJECTED` (+ `statusLabel`) |
| `Notification.category` | `DEADLINE`, `SCHEDULE`, `REQUEST`, `DEAN` |

В БД тип занятия и категория материала хранятся по-русски (см. `03`), в API отдаются кодом + подписью.

### 1.4. Совместимость с фронтендом

| Сущность | Поле контракта | Алиас для `src/lib/normalize.ts` |
|----------|----------------|----------------------------------|
| User | `groupName`, `studyForm` | `group`, `funding` |
| Grade | `labsScore`, `midtermScore`, `midtermMax`, `attendanceScore`, `currentTotal`, `subject` | `labs`, `rk`, `rkMax`, `attendance`, `total`, `name` |
| Assignment | `brsWeight`, `submissionUrl` | `points`, `submissionLink` |
| Material | `readTimeMinutes` | `readingMinutes` |
| Request | `user` | `student` (тот же объект) |
| Notification | `message` | `body`, `type` (`URGENT` / `ROOM_CHANGE` / `INFO`) |
| Dashboard | `nextClass`, `urgentAssignments`, `avgGrade`, `activeRequests` | `nextLesson`, `deadlines`, `averageScore`, `activeRequest` (первая активная) |
| Schedule | `items` | `lessons` |

Тела запросов: `submit` принимает `submissionUrl`/`link` и `studentComment`/`comment`; `PATCH /requests/[id]` — `adminComment`/`comment`; объявления — `message`/`body`, `targetGroup`/`group`, `rescheduleSubject`/`subject`; ИИ-чат — `mode` в любом регистре (`tutor`/`TUTOR`, `concierge`/`DEANERY`) и `contextTitle` или `context.title`.

## 2. Объекты

```ts
User {
  id: string; email: string; fullName: string; role: 'STUDENT' | 'ADMIN';
  faculty: string | null; program: string | null; course: number | null;
  groupName: string | null; studyForm: 'Бюджет' | 'Договор' | null;
  studentCardNumber: string | null; curatorName: string | null;
  scholarshipStatus: string | null; position: string | null;   // passwordHash — никогда
}

Lesson {
  id; groupName; dayOfWeek: 1..6; startTime: 'HH:MM'; endTime: 'HH:MM';
  subject; type: 'LECTURE'|'PRACTICE'|'LAB'; typeLabel; building; room;
  oldRoom: string | null; location: 'Корпус Б, ауд. 2337'; teacher; isRescheduled: boolean;
}

SubjectGrade {
  id; subject; teacher; controlType: 'Экзамен'|'Зачёт';
  labsScore; labsMax; midtermScore; midtermMax; attendanceScore; attendanceMax; examMax;
  currentTotal;                 // 0..100
  grade: 'Отлично'|'Хорошо'|'Удовлетворительно'|'Неудовлетворительно';
  hasDebt: boolean;             // currentTotal < 50
  pointsToAdmission: number;    // max(0, 50 − currentTotal)
  pointsToExcellent: number;    // max(0, 85 − currentTotal)
}

Assignment {
  id; subject; title; description; deadline: ISO; brsWeight: number;
  status: 'TODO'|'SUBMITTED'|'GRADED'|'OVERDUE';
  submissionUrl: string | null; studentComment: string | null;
  submittedAt: ISO | null; score: number | null; hoursLeft: number;  // < 0 — просрочено
}

StudyMaterial {
  id; faculty; subject; title; category; categoryLabel; readTimeMinutes; contentMarkdown; updatedAt: ISO;
}

DocumentRequest {
  id: number; type; typeLabel; status; statusLabel;
  comment: string | null; adminComment: string | null;
  registryNumber: 'ОРБ-2026-0418'; reviewedBy: string | null;
  signedBy: string | null; signedAt: ISO | null;   // заполнены только для APPROVED
  slaDays: number; createdAt: ISO; updatedAt: ISO;
  user?: { id; email; fullName; groupName; faculty };  // только в ADMIN-представлениях
}

Notification { id; category; title; message; isRead: boolean; isCritical: boolean; createdAt: ISO }
```

## 3. Эндпоинты

### Аутентификация

#### `POST /api/auth/login` — публичный

Тело: `{ email: string, password: string }`

- `200 { user: User }` + `Set-Cookie: orbita_token=…; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800[; Secure]`
- `401 { error: "Неверный email или пароль" }` — одинаково для неизвестного email и неверного пароля
- `429` — 5 неудачных попыток за 15 мин на пару IP + email

#### `POST /api/auth/logout` — публичный

`200 { ok: true }`, cookie перезаписывается с `Max-Age=0`.

#### `GET /api/auth/me`

`200 { user: User }` · `401`.

### Дашборд

#### `GET /api/dashboard`

STUDENT:

```json
{
  "role": "STUDENT",
  "user": User,
  "nextClass": Lesson | null,
  "urgentAssignments": Assignment[],
  "activeRequests": DocumentRequest[],
  "avgGrade": 90.8,
  "unreadCount": 2,
  "scholarshipStatus": "…",
  "subjectsAtRisk": SubjectGrade[],
  "announcements": Notification[]
}
```

`urgentAssignments` — задания `TODO` и `OVERDUE` (до 5), по возрастанию дедлайна. `nextClass` — следующее занятие группы по московскому времени. `announcements` — 10 последних уведомлений. Плюс алиасы из §1.4.

ADMIN:

```json
{
  "role": "ADMIN",
  "user": User,
  "stats": {
    "totalRequests": 3,
    "byStatus": { "NEW": 1, "IN_REVIEW": 1, "APPROVED": 1, "REJECTED": 0 },
    "activeRequests": 2, "newLast24h": 1, "students": 2, "studentsAtRisk": 1
  },
  "recentRequests": DocumentRequest[],
  "unreadCount": 0,
  "announcements": Notification[]
}
```

### Расписание

#### `GET /api/schedule`

`200 { items: Lesson[] }`, сортировка: группа → день → время. STUDENT — только `groupName` из своей записи; ADMIN — все группы.

### БРС

#### `GET /api/grades` — только STUDENT

`200 { subjects: SubjectGrade[], scholarshipStatus, averageScore, thresholds: { admission: 50, satisfactory: 60, good: 71, excellent: 85 } }` · ADMIN → `403`.

### Учёба

#### `GET /api/study`

`200 { assignments: Assignment[], materials: StudyMaterial[] }`. STUDENT — свои задания + материалы своего факультета. ADMIN — `assignments: []`, все материалы.

#### `POST /api/study/assignments/[id]/submit` — только STUDENT

Тело: `{ submissionUrl: "https://…", studentComment?: string }`

- `200 { assignment: Assignment, late: boolean }` — статус → `SUBMITTED`; `late = true`, если сдано после дедлайна
- `400` — ссылка не `https://` или длиннее 2048 символов
- `403` — задание чужое **или не существует** (IDOR, без оракула)
- `409` — задание уже `GRADED`

### Заявки

#### `GET /api/requests`

- STUDENT: `200 { requests: DocumentRequest[] }` — только свои, без `user`
- ADMIN: `200 { requests: DocumentRequest[] }` — все, с `user: { id, email, fullName, groupName, faculty }`

#### `POST /api/requests` — только STUDENT

Тело: `{ type: RequestType, comment?: string }`

- `201 { request: DocumentRequest }` — статус `NEW`, `registryNumber` `ОРБ-<год>-<NNNN>`; владельцу и всем ADMIN создаются уведомления `REQUEST`
- `400` — неизвестный `type`
- `403` — ADMIN
- `409 { error, request }` — уже есть активная (`NEW`/`IN_REVIEW`) заявка того же типа

#### `GET /api/requests/[id]` — критичный IDOR-эндпоинт

- STUDENT, своя заявка: `200 { request }`
- STUDENT, чужая, несуществующая или некорректный id: `403 { error: "Доступ запрещён: попытка обращения к чужой заявке (IDOR protection)" }`, событие пишется в лог `[security] IDOR blocked`
- ADMIN: `200 { request }` (с `user`) или `404`

#### `PATCH /api/requests/[id]` — только ADMIN

Тело: `{ status: 'IN_REVIEW' | 'APPROVED' | 'REJECTED', adminComment?: string }` (для `REJECTED` комментарий обязателен)

- `200 { request }` — заполняется `reviewedBy`; владельцу создаётся `Notification { category: 'REQUEST' }` («Заявка одобрена/отклонена/взята в работу», для отказа `isCritical`)
- `400` — неверный статус или отказ без комментария · `403` — STUDENT · `404` — нет заявки · `409` — заявка уже `APPROVED`/`REJECTED`

### Уведомления

#### `GET /api/notifications`

`200 { notifications: Notification[], unreadCount }` — последние 100 уведомлений текущего пользователя.

#### `POST /api/notifications/read-all`

`200 { ok: true, updated: number }` — помечает прочитанными только уведомления `session.userId`.

### Администрирование

#### `POST /api/admin/announcements` — только ADMIN

Тело: `{ title, message, targetGroup?, rescheduleSubject?, newRoom?, type?: 'URGENT' }`

- Получатели — все студенты или студенты группы `targetGroup`.
- Если заданы `rescheduleSubject` и `newRoom` — у занятий этой дисциплины (в `targetGroup`, если указана) `oldRoom ← room`, `room ← newRoom`, `isRescheduled = true`; уведомления идут с категорией `SCHEDULE`, иначе `DEAN`. `type: 'URGENT'` → `isCritical`.
- `201 { ok: true, recipients: number, announcement: { id, type, title, message, targetGroup, createdAt }, rescheduled: Lesson[] }`
- `400` — нет заголовка/текста или задан только один из `rescheduleSubject`/`newRoom` · `403` — STUDENT · `404` — группа или занятия не найдены

### ИИ-ассистент

#### `POST /api/ai/chat`

Тело: `{ message: string (≤ 2000), mode: 'tutor' | 'concierge', contextTitle?: string, history?: { role, content }[] (≤ 10 последних) }`

`200 { reply: string (Markdown), suggestions: string[], mode, source: 'llm' | 'rules' }`

- Контекст собирается из БД **только для `session.userId`**: БРС, задания, заявки, расписание группы, материалы факультета. `contextTitle` ищется только среди материалов факультета студента и его заданий.
- `AI_API_KEY` задан → запрос к `${AI_BASE_URL}/chat/completions` (`AI_MODEL`) с системным промптом, регламентами и JSON-контекстом. При ошибке или таймауте (20 с) — rule-based ответ.
- `AI_API_KEY` пуст → детерминированный генератор (`src/lib/ai/rules.ts`): допуск и план добора баллов, стипендия/ПГАС, БРС, дедлайны, справки со сроками, расписание и переносы, разбор материала (суть, формулы, план на 25 минут, вопросы для самопроверки), пошаговый план ДЗ без готового решения.
- ADMIN получает справку по работе деканата без персональных данных студентов.
- `429` — больше 20 запросов в минуту.

## 4. Проверка контракта

Сценарии, прогнанные на собранном приложении (`next build && next start`):

- вход: неверный пароль и неизвестный email дают одинаковый `401`; cookie `HttpOnly; SameSite=Lax`; в ответе нет `passwordHash`
- без cookie, с поддельным токеном и с `alg: none` → `401`
- IDOR: студент → чужая заявка `403`, несуществующая `403` с тем же текстом; чужое задание `403`
- студент не может `PATCH` заявку, создать объявление или увидеть БРС другого; ADMIN не может создать заявку
- изоляция: расписание по группе, материалы по факультету, заявки и уведомления по владельцу
- одобрение заявки создаёт уведомление владельцу; закрытую заявку изменить нельзя (`409`)
- перенос аудитории меняет расписание группы и уведомляет только её студентов
- запрос с чужим `Origin` → `403`
- ИИ без ключа отвечает по реальным данным (42 балла, «не хватает 8 до допуска») и не читает материалы чужого факультета


---

# V2 · API-контракт

> Статус: реализовано · Все эндпоинты и поля V1 сохранены; V2 добавляет поля в ответы (без удаления и переименования) и новые эндпоинты. Правила доступа — `03_DATA_AND_SECURITY.md` §V2.

## V2.1. Изменения общих объектов

```ts
User += {
  role: 'STUDENT' | 'ADMIN' | 'TEACHER';
  department: string | null;            // кафедра преподавателя
  campusHoursWeek: number;              // 22.5 по умолчанию
  campusHoursSemester: number;          // 318 по умолчанию
}

Contact {                               // публичная карточка для мессенджера, без email
  id; fullName; role; groupName: string | null; department: string | null; position: string | null;
}

Assignment += {
  groupName: string; authorName: string;
  taskPrompt: string;                   // Markdown-условие, '' у старых заданий
  starterTemplate: string | null;
  solutionText: string | null;
  gradeAwarded: number | null; teacherFeedback: string | null;
  material: { id; title; category } | null;       // привязанная методичка
  student?: { id; fullName; groupName };          // только в /api/teacher/*
}

DocumentRequest += { payloadJson: string | null; payload: object | null }

Lesson.location = 'Корпус Б, Лаб. 105' | 'Корпус Б, ауд. 2337'   // «ауд.» добавляется только к номеру

Notification.category += 'GRADE'

Booking {
  id?: string;                          // только у своей брони
  roomName; building; date: 'YYYY-MM-DD'; timeSlot: '15:20 – 16:50';
  participantsCount: number; status: 'CONFIRMED' | 'CANCELLED'; isMine: boolean;
  purpose?: string; createdAt?: ISO;    // только у своей брони
}

Message { id; senderId; receiverId; content; isRead: boolean; mine: boolean; createdAt: ISO }
```

Перечисления: `Request.type` += `ACADEMIC_TRANSCRIPT`, `DORMITORY_PASS` (`RETAKE` остаётся).

## V2.2. Роль TEACHER в эндпоинтах V1

`GET /api/dashboard` для TEACHER:

```json
{
  "role": "TEACHER",
  "user": User,
  "nextClass": Lesson | null,
  "nextLesson": Lesson | null,
  "stats": { "toReview": 2, "graded": 1, "assignmentsIssued": 6, "groups": ["И2101", "М3203"], "unreadMessages": 2 },
  "recentSubmissions": Assignment[],
  "unreadCount": 1,
  "announcements": Notification[]
}
```

Остальное — по матрице `03` §V2.2: `/api/grades` → `403`; `/api/study` → все материалы и `assignments: []`; `/api/requests/[id]` → только свои (чужая/несуществующая — `403`); создание заявок, `PATCH` заявок и объявления → `403`.

## V2.3. Расписание с поиском

### `GET /api/schedule?mode=my|group|room&query=…`

| Параметр | Значение |
|----------|----------|
| `mode` | `my` (по умолчанию), `group`, `room` |
| `query` | 1…50 символов; обязателен для `group` и `room` |

- `my` — как в V1: студент — своя группа; TEACHER — его занятия; ADMIN — все.
- `group` — группы, у которых ключ поиска совпадает с запросом (при отсутствии точного совпадения — частичное). Ключ: нижний регистр, `ё → е`, латинские двойники (`M`, `E`, `A`…) → кириллица, без пробелов и точек.
- `room` — занятия, у которых тем же ключом частично совпадает `room` или `building`.

`200`:

```json
{
  "items": Lesson[], "lessons": Lesson[],
  "mode": "room", "query": "Лаб. 105",
  "availableGroups": ["И2101", "М3203", "Э4102"],
  "availableRooms": ["Ауд. 204", "Ауд. 301", "Ауд. 402", "Коворкинг А", "Лаб. 105", "…"]
}
```

`400` — неизвестный `mode` или нет `query`.

## V2.4. Бронирование помещений

### `GET /api/bookings[?date=YYYY-MM-DD]`

```json
{
  "date": "2026-11-20", "today": "2026-11-20",
  "timeSlots": ["08:20 – 09:50", "10:00 – 11:30", "11:40 – 13:10", "13:30 – 15:00", "15:20 – 16:50", "17:00 – 18:30"],
  "myBookings": Booking[],
  "allBookingsToday": Booking[],
  "roomsCatalog": [{
    "roomName": "Переговорная Б-12", "building": "Корпус Б, 1 этаж", "capacity": 8,
    "equipment": ["ТВ-панель 65\"", "ВКС", "Флипчарт"], "description": "…",
    "slots": [{ "timeSlot": "15:20 – 16:50", "available": false, "taken": true }]
  }]
}
```

- `myBookings` — все свои брони (в т.ч. отменённые), новые сверху.
- `allBookingsToday` — все `CONFIRMED` на сегодня (МСК); чужие без `id`, `purpose`, владельца.
- `slots` — сетка на `date` (по умолчанию сегодня): `taken` — занято, `available` — свободно и ещё не началось.

### `POST /api/bookings`

Тело: `{ roomName, building?, date: 'YYYY-MM-DD', timeSlot, purpose, participantsCount }`. `building` игнорируется (берётся из каталога); `timeSlot` принимает и `13:30-15:00`.

| Ответ | Когда |
|-------|-------|
| `201 { booking }` | создано от `session.userId` |
| `400` | помещения нет в каталоге, слот не из списка, дата вне «сегодня…+14 дн.», участников больше вместимости, `purpose` < 3 символов |
| `409 { error: "Помещение «…» уже занято 22.11.2026 в слот 13:30 – 15:00. Выберите другое время или помещение." }` | слот занят (в т.ч. при гонке параллельных запросов) |
| `409` | слот уже начался; у пользователя уже 3 активные будущие брони |

### `DELETE /api/bookings/[id]`

- `200 { ok: true, booking }` — `status: 'CANCELLED'`, слот освобождён.
- `403 { error: "Доступ запрещён: бронь принадлежит другому пользователю (IDOR protection)" }` — чужая или несуществующая (для всех ролей, включая ADMIN).
- `409` — уже отменена или слот начался.

## V2.5. Мессенджер

### `GET /api/messages`

```json
{
  "contacts": [{
    "id": "…", "fullName": "Волков Игорь Сергеевич", "role": "TEACHER",
    "groupName": null, "department": "Кафедра программной инженерии", "position": "Доцент …",
    "lastMessage": Message | null, "unreadCount": 1
  }],
  "unreadTotal": 2
}
```

Контакты: для STUDENT — одногруппники, все TEACHER и ADMIN, плюс те, кто уже написал первым; для TEACHER/ADMIN — все пользователи. Сортировка: по `lastMessage.createdAt` (новые сверху), затем преподаватели → студенты → деканат, затем по ФИО.

### `GET /api/messages/[peerId]`

`200 { peer: Contact, messages: Message[] }` — до 200 последних сообщений **только** между `session.userId` и `peerId`, по возрастанию времени. Входящие от `peerId` помечаются прочитанными.

`400` — `peerId` = свой id · `403 { error: "Доступ запрещён: этот пользователь не входит в ваши контакты" }` — не контакт или не существует.

### `POST /api/messages/[peerId]`

Тело: `{ content }` (1…2000 после `trim`). `201 { message }`, `senderId` = `session.userId`. Ошибки: `400` (пустой/длинный текст), `403` (как у GET), `429` (30 сообщений/мин).

## V2.6. Сдача решения (расширение V1)

### `POST /api/study/assignments/[id]/submit`

Тело: `{ solutionText?: string (≤ 20 000), submissionUrl?: 'https://…', studentComment?: string }` — нужно хотя бы одно из `solutionText` / `submissionUrl` (алиасы V1 `link`, `comment` работают).

- `200 { assignment, late }` — статус `SUBMITTED`; при повторной сдаче непереданное поле сохраняет прежнее значение. Автору задания (`authorId`) уходит уведомление «Новое решение на проверке».
- `400` — нет ни решения, ни ссылки; ссылка не `https://` · `403` — чужое/несуществующее · `409` — уже `GRADED`.

## V2.7. Кабинет преподавателя

Все `/api/teacher/*` — только `TEACHER` и `ADMIN`, иначе `403`.

### `GET /api/teacher/assignments`

```json
{
  "assignments": Assignment[],          // со student, solutionText, submissionUrl
  "summary": { "total": 6, "TODO": 2, "SUBMITTED": 2, "GRADED": 1, "OVERDUE": 1 },
  "toReview": 2,
  "groups": ["И2101", "М3203"],          // группы преподавателя по расписанию
  "subjects": ["Алгоритмы и структуры данных", "Основы программирования"]
}
```

TEACHER — только `authorId = session.userId`; ADMIN — все задания с автором.

### `POST /api/teacher/assignments`

Тело:

```json
{
  "groupName": "М3203", "subject": "Алгоритмы и структуры данных",
  "title": "Онлайн-задача: бинарный поиск", "description": "…",
  "taskPrompt": "## Условие …", "starterTemplate": "def lower_bound(a, x): …",
  "deadline": "2026-11-25T20:59:00.000Z", "brsWeight": 5, "materialId": "…"
}
```

- `201 { ok: true, groupName, recipients, assignments: Assignment[] }` — по строке на каждого студента группы (`status: TODO`, `authorId` = `session.userId`, `authorName` = «Доц. Волков И. С.»), каждому — уведомление `DEADLINE`.
- `400` — валидация (`deadline` в прошлом или дальше 180 дней, `brsWeight` вне 1…40, пустое условие, методичка не найдена) · `403` — TEACHER не ведёт эту группу · `404` — в группе нет студентов.

### `PATCH /api/teacher/assignments/[id]/grade`

Тело: `{ gradeAwarded: 0…brsWeight, teacherFeedback?: string }`

- `200 { assignment, brs: { subject, labsScore, currentTotal } | null }` — статус `GRADED`, `score = gradeAwarded`; балл (разница при переоценке) добавлен к `labsScore` дисциплины студента (не выше `labsMax`), `currentTotal` пересчитан; студенту — уведомление `GRADE`.
- `400` — балл больше веса · `403` — TEACHER и задание чужое или не существует (IDOR) · `404` — ADMIN, задания нет · `409` — решение ещё не сдано.

## V2.8. Заявки со структурированными полями

### `POST /api/requests` (расширение V1)

Тело: `{ type, comment?, payload?: object }` или `{ …, payloadJson: object | string }`.

```json
{ "type": "PGAS", "payload": { "achievements": [{ "type": "Научная", "title": "Статья в сборнике конференции", "date": "2026-05" }] } }
```

Схема `payload` зависит от `type` (`01` §V2.7). Неизвестные ключи отбрасываются, нарушения → `400` с путём `payload.<поле>`, сериализованный результат ≤ 4000 символов. В ответе — `payloadJson` (строка) и `payload` (объект). Без `payload` заявка создаётся как в V1.

## V2.9. Статистика

### `GET /api/stats`

```json
{
  "role": "STUDENT",
  "campusHoursWeek": 27.5, "campusHoursSemester": 346, "classHoursWeek": 18,
  "attendancePercent": 91, "avgBrs": 90.8, "rankInGroup": 1, "groupSize": 2,
  "weeklyActivity": [{ "day": "Пн", "dayOfWeek": 1, "campusHours": 7, "studyHours": 4.5 }],
  "timeBreakdown": [{ "category": "Лекции", "hours": 6, "percent": 22 }]
}
```

- `studyHours` = число пар дня × 1,5; `campusHours` — занятия плюс остаток `campusHoursWeek`, распределённый пропорционально нагрузке дня; сумма за неделю = `campusHoursWeek`.
- `timeBreakdown`: лекции, практики, лабораторные, бронирования помещений (подтверждённые брони ±3 дня × 1,5 ч), самостоятельная работа в кампусе, перерывы и питание; сумма `percent` = 100, нулевые категории не выводятся.
- `rankInGroup` — 1 + число одногруппников с большим средним баллом.
- TEACHER: расчёт по его занятиям, `attendancePercent`, `avgBrs`, `rankInGroup`, `groupSize` = `null`. ADMIN: без расписания.

## V2.10. Проверка контракта V2

Прогнано на собранном приложении (`next build && next start`), после сида:

- регресс V1 — все 58 сценариев зелёные (с поправкой на новые демо-данные: 4 задания у Алексея, 3 группы);
- 97 сценариев V2, в том числе:
  - **IDOR**: чужая бронь при `DELETE` → `403` (несуществующая — тот же `403`, деканат тоже `403`); переписка чужого контакта → `403`; оценка чужого задания преподавателем → `403`; сдача чужого задания → `403`; заявка по id для TEACHER → `403`;
  - подмена `senderId`, `userId`, `authorId` в теле игнорируется;
  - двойная бронь: последовательная → `409`, две параллельные → ровно один `201` и один `409`;
  - поиск расписания: `и2101`, латинское `M3203`, `лаб. 105`, `корпус г`;
  - оценка добавляет балл в БРС, переоценка учитывает только разницу;
  - сумма часов по дням = `campusHoursWeek`, сумма процентов = 100, рейтинг в группе.
