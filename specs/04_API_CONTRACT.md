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
