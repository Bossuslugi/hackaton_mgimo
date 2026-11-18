/**
 * Демо-данные для режима NEXT_PUBLIC_API_MOCK=1. Все персональные данные вымышленные.
 * Формы объектов совпадают с ожидаемым API-контрактом (specs/02_DESIGN_SYSTEM.md, прил. A).
 */

export interface MockUser {
  id: string;
  email: string;
  password: string;
  fullName: string;
  role: 'STUDENT' | 'ADMIN';
  group?: string;
  faculty?: string;
  program?: string;
  course?: number;
  studyForm?: string;
  funding?: string;
  studentCardNumber?: string;
  enrolledAt?: string;
  validUntil?: string;
  position?: string;
}

export const USERS: MockUser[] = [
  {
    id: 'u-alexey',
    email: 'alexey.sokolov@edu.orbita.ru',
    password: 'Student2026!',
    fullName: 'Соколов Алексей Игоревич',
    role: 'STUDENT',
    group: 'ИУ7-31Б',
    faculty: 'Информатика и системы управления',
    program: '09.03.04 Программная инженерия',
    course: 2,
    studyForm: 'Очная',
    funding: 'Бюджетная',
    studentCardNumber: '25-ИУ7-04817',
    enrolledAt: '2025-09-01',
    validUntil: '2029-08-31',
  },
  {
    id: 'u-maria',
    email: 'maria.kuznetsova@edu.orbita.ru',
    password: 'Student2026!',
    fullName: 'Кузнецова Мария Андреевна',
    role: 'STUDENT',
    group: 'ИУ7-32Б',
    faculty: 'Информатика и системы управления',
    program: '09.03.04 Программная инженерия',
    course: 2,
    studyForm: 'Очная',
    funding: 'Платная',
    studentCardNumber: '25-ИУ7-05132',
    enrolledAt: '2025-09-01',
    validUntil: '2029-08-31',
  },
  {
    id: 'u-dekanat',
    email: 'dekanat@edu.orbita.ru',
    password: 'Admin2026!',
    fullName: 'Белова Ольга Викторовна',
    role: 'ADMIN',
    faculty: 'Деканат ИУ',
    position: 'Специалист по учебной работе',
  },
];

export const OTHER_STUDENTS = [
  { id: 'u-ivanov', fullName: 'Иванов Дмитрий Сергеевич', group: 'ИУ7-31Б', email: 'd.ivanov@edu.orbita.ru' },
  { id: 'u-petrova', fullName: 'Петрова Анна Михайловна', group: 'ИУ7-33Б', email: 'a.petrova@edu.orbita.ru' },
  { id: 'u-gromov', fullName: 'Громов Кирилл Олегович', group: 'ИУ7-31Б', email: 'k.gromov@edu.orbita.ru' },
];

// ───────────────────────── расписание

const SLOTS = [
  ['08:30', '10:05'],
  ['10:15', '11:50'],
  ['12:00', '13:35'],
  ['13:50', '15:25'],
  ['15:40', '17:15'],
  ['17:25', '19:00'],
] as const;

type L = [day: number, slot: number, subject: string, type: string, teacher: string, room: string, oldRoom?: string, note?: string];

const WEEK: L[] = [
  [1, 0, 'Математический анализ', 'LECTURE', 'Ершов А. В.', '501ю'],
  [1, 1, 'Математический анализ', 'SEMINAR', 'Ершов А. В.', '345'],
  [1, 2, 'Английский язык', 'SEMINAR', 'Хохлова Е. Н.', '1016л'],
  [2, 1, 'Алгоритмы и структуры данных', 'LECTURE', 'Волкова И. А.', '395'],
  [2, 2, 'Алгоритмы и структуры данных', 'LAB', 'Ремизов П. С.', '518ю'],
  [2, 3, 'Физика', 'LECTURE', 'Орлов Н. Д.', 'Б. Физ.'],
  [3, 1, 'Базы данных', 'LECTURE', 'Тимофеев В. К.', '218л', '345', 'Перенос: аудитория 345 закрыта на ремонт'],
  [3, 2, 'Базы данных', 'LAB', 'Тимофеев В. К.', '510ю'],
  [3, 3, 'Дискретная математика', 'SEMINAR', 'Лаптева М. Ю.', '433'],
  [3, 4, 'Физика', 'LAB', 'Сергеев Р. А.', '230ф'],
  [4, 0, 'Архитектура ЭВМ', 'LECTURE', 'Попов Г. Е.', '501ю'],
  [4, 1, 'Архитектура ЭВМ', 'LAB', 'Попов Г. Е.', '515ю', '518ю', 'Лаборатория перенесена этажом ниже'],
  [4, 2, 'Дискретная математика', 'LECTURE', 'Лаптева М. Ю.', '395'],
  [5, 1, 'Алгоритмы и структуры данных', 'SEMINAR', 'Ремизов П. С.', '306э'],
  [5, 2, 'Физика', 'SEMINAR', 'Орлов Н. Д.', '427'],
  [5, 3, 'Английский язык', 'SEMINAR', 'Хохлова Е. Н.', '1016л'],
  [6, 0, 'Базы данных', 'SEMINAR', 'Тимофеев В. К.', '510ю'],
  [6, 1, 'Математический анализ', 'SEMINAR', 'Ершов А. В.', '345'],
];

export function lessons() {
  return WEEK.map(([day, slot, subject, type, teacher, room, oldRoom, note], i) => ({
    id: `les-${i + 1}`,
    dayOfWeek: day,
    startTime: SLOTS[slot][0],
    endTime: SLOTS[slot][1],
    subject,
    type,
    teacher,
    room,
    oldRoom: oldRoom ?? null,
    isRescheduled: Boolean(oldRoom),
    note: note ?? null,
  }));
}

// ───────────────────────── задания

const H = 3_600_000;
const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();

export function assignmentsFor(userId: string) {
  const base = [
    {
      id: 'as-1',
      subject: 'Алгоритмы и структуры данных',
      title: 'ЛР №4. АВЛ-деревья: вставка и балансировка',
      description:
        'Реализовать АВЛ-дерево с операциями вставки, удаления и поиска. Сравнить высоту с несбалансированным BST на 10⁴ случайных ключей, построить график.',
      deadline: iso(19 * H + 23 * 60_000),
      points: 8,
      status: 'ACTIVE',
    },
    {
      id: 'as-2',
      subject: 'Математический анализ',
      title: 'ДЗ №3. Ряды Фурье',
      description: 'Разложить функции из варианта в ряд Фурье на [−π, π], исследовать сходимость, оформить решение в LaTeX.',
      deadline: iso(2 * 24 * H + 5 * H),
      points: 6,
      status: 'ACTIVE',
    },
    {
      id: 'as-3',
      subject: 'Базы данных',
      title: 'ЛР №2. Нормализация до 3НФ',
      description: 'Спроектировать схему «Библиотека», привести к 3НФ, написать DDL для PostgreSQL и 5 запросов с JOIN.',
      deadline: iso(4 * 24 * H + 2 * H),
      points: 8,
      status: 'ACTIVE',
    },
    {
      id: 'as-4',
      subject: 'Английский язык',
      title: 'Essay: Technology in Education',
      description: '250–300 слов, структура opinion essay, минимум 5 слов из Unit 6.',
      deadline: iso(6 * 24 * H),
      points: 4,
      status: 'ACTIVE',
    },
    {
      id: 'as-5',
      subject: 'Физика',
      title: 'Отчёт по ЛР «Маятник Обербека»',
      description: 'Расчёт момента инерции, оценка погрешностей.',
      deadline: iso(-2 * 24 * H),
      points: 5,
      status: 'GRADED',
      score: 5,
      submittedAt: iso(-3 * 24 * H),
      submissionLink: 'https://disk.example/oberbeck-report.pdf',
    },
  ];
  if (userId === 'u-maria') {
    return [
      {
        id: 'as-m0',
        subject: 'Дискретная математика',
        title: 'РК №1 (пересдача). Графы и отношения',
        description: 'Пересдача рубежного контроля: 6 задач по теории графов и бинарным отношениям.',
        deadline: iso(7 * H + 40 * 60_000),
        points: 10,
        status: 'ACTIVE',
      },
      ...base.map((a) => (a.id === 'as-5' ? { ...a, status: 'ACTIVE', deadline: iso(-26 * H), score: undefined, submittedAt: undefined, submissionLink: undefined } : a)),
    ];
  }
  return base;
}

// ───────────────────────── материалы

export const MATERIALS = [
  {
    id: 'mat-1',
    subject: 'Алгоритмы и структуры данных',
    category: 'NOTES',
    title: 'АВЛ-деревья и повороты',
    description: 'Инвариант баланса, четыре случая поворотов, сложность операций.',
    updatedAt: iso(-3 * 24 * H),
    contentMarkdown: `# АВЛ-деревья

**АВЛ-дерево** — двоичное дерево поиска, в котором для каждой вершины высоты левого и правого поддеревьев отличаются не более чем на 1.

## Фактор баланса

\`balance(v) = h(left) − h(right)\`, допустимые значения: −1, 0, 1.

## Повороты

| Случай | Условие | Действие |
|---|---|---|
| LL | balance = +2, вставка в левое-левое | малый правый поворот |
| RR | balance = −2, вставка в правое-правое | малый левый поворот |
| LR | balance = +2, вставка в левое-правое | левый, затем правый |
| RL | balance = −2, вставка в правое-левое | правый, затем левый |

> Высота АВЛ-дерева из n вершин не превышает 1,44·log₂(n + 2), поэтому поиск, вставка и удаление — O(log n).

## Псевдокод вставки

\`\`\`
insert(v, key):
  if v == null: return Node(key)
  if key < v.key: v.left = insert(v.left, key)
  else:           v.right = insert(v.right, key)
  update_height(v)
  return rebalance(v)
\`\`\`

## Частые ошибки

- забыть обновить высоту после поворота;
- обновлять высоты сверху вниз, а не снизу вверх;
- путать знак фактора баланса в случаях LR и RL.`,
  },
  {
    id: 'mat-2',
    subject: 'Математический анализ',
    category: 'CHEATSHEET',
    title: 'Шпаргалка к РК-2: ряды',
    description: 'Признаки сходимости и стандартные разложения на одной странице.',
    updatedAt: iso(-1 * 24 * H),
    contentMarkdown: `# Ряды — шпаргалка к РК-2

## Признаки сходимости знакоположительных рядов

1. **Сравнения**: если 0 ≤ aₙ ≤ bₙ и Σbₙ сходится, то Σaₙ сходится.
2. **Даламбера**: lim aₙ₊₁/aₙ = q; q < 1 — сходится, q > 1 — расходится.
3. **Коши (радикальный)**: lim ⁿ√aₙ = q, выводы те же.
4. **Интегральный**: Σf(n) и ∫f(x)dx ведут себя одинаково.

## Эталонные ряды

- Σ 1/nᵖ сходится при p > 1;
- Σ qⁿ сходится при |q| < 1.

## Ряд Фурье на [−π, π]

\`a₀ = (1/π)∫f(x)dx\`, \`aₙ = (1/π)∫f(x)cos(nx)dx\`, \`bₙ = (1/π)∫f(x)sin(nx)dx\`.

> Для чётной функции все bₙ = 0, для нечётной — все aₙ = 0. Это экономит половину вычислений на РК.`,
  },
  {
    id: 'mat-3',
    subject: 'Базы данных',
    category: 'LAB_TEMPLATE',
    title: 'Шаблон отчёта по ЛР №2',
    description: 'Структура отчёта, требования к ER-диаграмме и оформлению SQL.',
    updatedAt: iso(-6 * 24 * H),
    contentMarkdown: `# Отчёт по лабораторной работе №2

## 1. Постановка задачи
Кратко опишите предметную область и требования к данным.

## 2. Исходное отношение
Приведите универсальное отношение и функциональные зависимости.

## 3. Нормализация
- 1НФ — атомарность значений;
- 2НФ — устранение частичных зависимостей от ключа;
- 3НФ — устранение транзитивных зависимостей.

## 4. DDL

\`\`\`
CREATE TABLE book (
  id        serial PRIMARY KEY,
  title     text NOT NULL,
  author_id int  NOT NULL REFERENCES author(id)
);
\`\`\`

## 5. Запросы
Не менее пяти запросов, минимум два — с JOIN, один — с агрегатом и GROUP BY.

## 6. Выводы`,
  },
  {
    id: 'mat-4',
    subject: 'Физика',
    category: 'TICKETS',
    title: 'Билеты к экзамену: механика',
    description: '30 вопросов с пометкой самых частых на экзамене.',
    updatedAt: iso(-10 * 24 * H),
    contentMarkdown: `# Экзаменационные вопросы: механика

1. Кинематика материальной точки. Скорость и ускорение.
2. **Законы Ньютона.** Инерциальные системы отсчёта.
3. Импульс. Закон сохранения импульса.
4. Работа и мощность. Кинетическая энергия.
5. **Потенциальная энергия. Закон сохранения механической энергии.**
6. Момент инерции. Теорема Штейнера.
7. **Основное уравнение динамики вращательного движения.**
8. Момент импульса, закон его сохранения.
9. Гармонические колебания. Математический и физический маятники.
10. Затухающие и вынужденные колебания. Резонанс.

> Жирным выделены вопросы, которые попадались в 80% билетов за последние три года.`,
  },
  {
    id: 'mat-5',
    subject: 'Дискретная математика',
    category: 'CHEATSHEET',
    title: 'Графы: определения для РК-1',
    description: 'Связность, деревья, эйлеровы и гамильтоновы циклы.',
    updatedAt: iso(-2 * 24 * H),
    contentMarkdown: `# Графы — минимум для РК-1

- **Дерево** — связный граф без циклов; у дерева с n вершинами ровно n − 1 рёбер.
- **Эйлеров цикл** существует ⇔ граф связен и степени всех вершин чётны.
- **Двудольный граф** ⇔ нет циклов нечётной длины.
- Сумма степеней вершин = 2·|E| (лемма о рукопожатиях).

## Отношения

| Свойство | Определение |
|---|---|
| Рефлексивность | ∀a: aRa |
| Симметричность | aRb ⇒ bRa |
| Транзитивность | aRb ∧ bRc ⇒ aRc |`,
  },
  {
    id: 'mat-6',
    subject: 'Базы данных',
    category: 'NOTES',
    title: 'Индексы в PostgreSQL',
    description: 'B-tree, Hash, GIN — когда что применять и как читать EXPLAIN.',
    updatedAt: iso(-4 * 24 * H),
    contentMarkdown: `# Индексы в PostgreSQL

## B-tree
Индекс по умолчанию. Подходит для =, <, >, BETWEEN, ORDER BY.

## GIN
Для массивов, jsonb и полнотекстового поиска.

## Как проверить, что индекс используется

\`\`\`
EXPLAIN ANALYZE
SELECT * FROM book WHERE author_id = 42;
\`\`\`

Ищите в плане \`Index Scan\` вместо \`Seq Scan\`.

> Индекс ускоряет чтение, но замедляет запись: не индексируйте всё подряд.`,
  },
  {
    id: 'mat-7',
    subject: 'Алгоритмы и структуры данных',
    category: 'LAB_TEMPLATE',
    title: 'Шаблон ЛР: замер производительности',
    description: 'Как оформить таблицу замеров и график сложности.',
    updatedAt: iso(-8 * 24 * H),
    contentMarkdown: `# Шаблон: экспериментальная часть

1. Опишите стенд: процессор, ОЗУ, компилятор и флаги.
2. Для каждого n проведите не менее 10 замеров, возьмите медиану.
3. Оформите таблицу:

| n | BST, мс | АВЛ, мс |
|---|---|---|
| 1 000 | 0,8 | 0,9 |
| 10 000 | 14,2 | 9,7 |
| 100 000 | 310,5 | 118,3 |

4. Постройте график в логарифмическом масштабе и сделайте вывод о сложности.`,
  },
  {
    id: 'mat-8',
    subject: 'Английский язык',
    category: 'NOTES',
    title: 'Opinion essay: структура',
    description: 'Пять абзацев, linking words и типичные ошибки.',
    updatedAt: iso(-5 * 24 * H),
    contentMarkdown: `# Opinion essay

1. **Introduction** — перефразируйте тему и выскажите позицию.
2. **Body 1** — первый аргумент + пример.
3. **Body 2** — второй аргумент + пример.
4. **Body 3** — контраргумент и его опровержение.
5. **Conclusion** — повторите позицию другими словами.

Linking words: *firstly, moreover, on the other hand, nevertheless, to sum up*.`,
  },
];

// ───────────────────────── БРС

export function gradesFor(userId: string) {
  const g = (id: string, name: string, teacher: string, labs: number, rk: number, att: number, hasDebt = false) => ({
    id,
    name,
    teacher,
    labs,
    labsMax: 40,
    rk,
    rkMax: 40,
    attendance: att,
    attendanceMax: 20,
    total: labs + rk + att,
    hasDebt,
  });
  if (userId === 'u-maria') {
    return [
      g('s-1', 'Математический анализ', 'Ершов А. В.', 24, 18, 12),
      g('s-2', 'Алгоритмы и структуры данных', 'Волкова И. А.', 30, 26, 14),
      g('s-3', 'Базы данных', 'Тимофеев В. К.', 28, 24, 16),
      g('s-4', 'Физика', 'Орлов Н. Д.', 16, 20, 11, true),
      g('s-5', 'Дискретная математика', 'Лаптева М. Ю.', 22, 12, 13, true),
      g('s-6', 'Английский язык', 'Хохлова Е. Н.', 32, 28, 17),
    ];
  }
  return [
    g('s-1', 'Математический анализ', 'Ершов А. В.', 36, 34, 19),
    g('s-2', 'Алгоритмы и структуры данных', 'Волкова И. А.', 38, 36, 20),
    g('s-3', 'Базы данных', 'Тимофеев В. К.', 34, 31, 18),
    g('s-4', 'Физика', 'Орлов Н. Д.', 33, 32, 18),
    g('s-5', 'Дискретная математика', 'Лаптева М. Ю.', 37, 35, 19),
    g('s-6', 'Английский язык', 'Хохлова Е. Н.', 38, 37, 20),
  ];
}

// ───────────────────────── заявки

export function seedRequests() {
  const s = (u: MockUser | (typeof OTHER_STUDENTS)[number]) => ({
    id: u.id,
    fullName: u.fullName,
    group: 'group' in u ? u.group : undefined,
    email: u.email,
  });
  const [alexey, maria] = USERS;
  const [ivanov, petrova, gromov] = OTHER_STUDENTS;
  return [
    {
      id: 'req-1001',
      ownerId: alexey.id,
      type: 'STUDY_CERTIFICATE',
      status: 'APPROVED',
      createdAt: iso(-3 * 24 * H),
      updatedAt: iso(-2 * 24 * H - 4 * H),
      signedAt: iso(-2 * 24 * H - 4 * H),
      signedBy: 'Белова О. В., деканат ИУ',
      registryNumber: 'ОРБ-2026-001284',
      student: s(alexey),
    },
    {
      id: 'req-1002',
      ownerId: alexey.id,
      type: 'MILITARY_CERTIFICATE',
      status: 'PENDING',
      createdAt: iso(-5 * H),
      updatedAt: iso(-4 * H),
      student: s(alexey),
    },
    {
      id: 'req-1003',
      ownerId: maria.id,
      type: 'RETAKE',
      status: 'PENDING',
      comment: 'Дискретная математика, РК-1',
      createdAt: iso(-26 * H),
      updatedAt: iso(-20 * H),
      student: s(maria),
    },
    {
      id: 'req-1004',
      ownerId: maria.id,
      type: 'FINANCIAL_AID',
      status: 'REJECTED',
      comment: 'Сложная финансовая ситуация в семье',
      adminComment: 'Приложите справку о составе семьи и реквизиты счёта, затем подайте заявление повторно.',
      createdAt: iso(-9 * 24 * H),
      updatedAt: iso(-7 * 24 * H),
      student: s(maria),
    },
    {
      id: 'req-1005',
      ownerId: ivanov.id,
      type: 'STUDY_CERTIFICATE',
      status: 'PENDING',
      createdAt: iso(-2 * H),
      student: s(ivanov),
    },
    {
      id: 'req-1006',
      ownerId: petrova.id,
      type: 'FINANCIAL_AID',
      status: 'PENDING',
      comment: 'Многодетная семья',
      createdAt: iso(-30 * H),
      student: s(petrova),
    },
    {
      id: 'req-1007',
      ownerId: gromov.id,
      type: 'MILITARY_CERTIFICATE',
      status: 'APPROVED',
      createdAt: iso(-4 * 24 * H),
      updatedAt: iso(-3 * 24 * H),
      signedAt: iso(-3 * 24 * H),
      registryNumber: 'ОРБ-2026-001279',
      student: s(gromov),
    },
  ];
}

export function seedAnnouncements() {
  return [
    {
      id: 'ann-1',
      type: 'ROOM_CHANGE',
      title: 'Перенос аудитории: Базы данных',
      body: 'Лекция в среду 10:15 переносится из ауд. 345 в ауд. 218л — в 345 ремонт.',
      createdAt: iso(-14 * H),
    },
  ];
}
