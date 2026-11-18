/**
 * Встроенный мок-бэкенд (NEXT_PUBLIC_API_MOCK=1). Нужен, чтобы фронтенд можно было
 * показать и проверить без сервера. Состояние (сессия, заявки, сдачи, объявления)
 * живёт в localStorage — одобрение заявки деканатом видно студенту после переключения аккаунта.
 */
import {
  assignmentsFor,
  gradesFor,
  lessons,
  MATERIALS,
  seedAnnouncements,
  seedRequests,
  USERS,
  type MockUser,
} from './data';

interface Reply {
  ok: boolean;
  status: number;
  statusText: string;
  body: unknown;
}

type Store = {
  session: string | null;
  requests: ReturnType<typeof seedRequests>;
  submissions: Record<string, { link: string; comment: string; submittedAt: string }>;
  announcements: ReturnType<typeof seedAnnouncements>;
  seq: number;
};

const KEY = 'orbita-mock-v1';
let mem: Store | null = null;

function load(): Store {
  if (mem) return mem;
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    if (raw) mem = JSON.parse(raw) as Store;
  } catch {
    /* приватный режим и т.п. */
  }
  mem ??= { session: null, requests: seedRequests(), submissions: {}, announcements: seedAnnouncements(), seq: 1300 };
  return mem;
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(mem));
  } catch {
    /* ignore */
  }
}

const res = (status: number, body: unknown): Reply => ({
  ok: status >= 200 && status < 300,
  status,
  statusText:
    { 200: 'OK', 201: 'Created', 204: 'No Content', 400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found' }[
      status
    ] ?? '',
  body,
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const publicUser = (u: MockUser) => {
  const { password: _pw, ...rest } = u;
  void _pw;
  return rest;
};

const isoDow = (d = new Date()) => (d.getDay() === 0 ? 7 : d.getDay());

/** Сдвигаем демо-неделю так, чтобы «день с переносом» всегда был сегодня. */
function weekLessons() {
  const today = Math.min(isoDow(), 6);
  return lessons().map((l) => ({ ...l, dayOfWeek: ((l.dayOfWeek - 3 + today - 1 + 12) % 6) + 1 }));
}

function nextLesson() {
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const all = weekLessons().sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime));
  const today = isoDow();
  return (
    all.find((l) => l.dayOfWeek === today && l.endTime > hhmm) ??
    all.find((l) => l.dayOfWeek > today) ??
    all[0] ??
    null
  );
}

function assignments(userId: string) {
  const s = load();
  return assignmentsFor(userId).map((a) => {
    const sub = s.submissions[`${userId}:${a.id}`];
    return sub ? { ...a, status: 'SUBMITTED', submittedAt: sub.submittedAt, submissionLink: sub.link } : a;
  });
}

// ───────────────────────── ИИ

function aiReply(message: string, mode: string, context?: { title?: string; subject?: string; kind?: string }) {
  const m = message.toLowerCase();
  if (mode === 'DEANERY') {
    if (m.includes('стипенд'))
      return {
        reply:
          '**Повышенная академическая стипендия** назначается по итогам сессии, если по **всем** дисциплинам итог по БРС не ниже **85 баллов** («отлично»).\n\n- Одна «хорошо» (71–84) — стипендия становится базовой.\n- Пересдача на «отлично» не возвращает повышенную за текущий семестр.\n\nПроверить запас по каждому предмету можно в разделе **БРС → Симулятор «Что если?»**.',
        suggestions: ['Открой правила пересдачи', 'Какие документы нужны для матпомощи?', 'Когда начисляется стипендия?'],
      };
    if (m.includes('пересда') || m.includes('рк вовремя') || m.includes('не сдать'))
      return {
        reply:
          'Если рубежный контроль не сдан в срок:\n\n1. Баллы за РК временно равны **0**, дисциплина помечается как задолженность.\n2. Пересдача назначается преподавателем в течение **двух недель** после контрольной точки.\n3. Оформите **«Заявление на пересдачу»** в разделе «Справки» — деканат подпишет направление ЭЦП.\n\n> Задолженность, не закрытая до сессии, блокирует допуск к экзамену по этой дисциплине.',
        suggestions: ['Оформить заявление на пересдачу', 'Сколько баллов нужно для допуска?', 'Можно ли пересдать дважды?'],
      };
    if (m.includes('матпомощ') || m.includes('материальн'))
      return {
        reply:
          'Для **материальной помощи** понадобятся:\n\n- заявление (оформляется в «Справках» в один клик);\n- документ, подтверждающий основание: справка о составе семьи, о доходах, медицинские документы и т.п.;\n- реквизиты счёта для зачисления.\n\nЗаявление рассматривает стипендиальная комиссия, обычно **до 5 рабочих дней**.',
        suggestions: ['Как оформить академический отпуск?', 'Сколько баллов нужно для повышенной стипендии?'],
      };
    if (m.includes('академ'))
      return {
        reply:
          '**Академический отпуск** предоставляется по медицинским показаниям, семейным обстоятельствам или в связи с призывом. Срок — до 2 лет.\n\n1. Подайте заявление в деканат с подтверждающими документами.\n2. Решение принимается в течение 10 рабочих дней.\n3. На время отпуска сохраняется статус студента, стипендия не выплачивается.',
        suggestions: ['Что будет со стипендией после академа?', 'Как записаться на пересдачу?'],
      };
    return {
      reply:
        'Я сверяюсь с положением о БРС и регламентами деканата. Уточните вопрос — например, про **стипендию**, **пересдачи**, **справки** или **академический отпуск**.',
      suggestions: ['Сколько баллов нужно для повышенной стипендии?', 'Как записаться на пересдачу?'],
    };
  }
  if (context?.title) {
    const isMat = context.kind === 'material';
    return {
      reply: isMat
        ? `Главное из материала **«${context.title}»**:\n\n1. Сформулируйте определение своими словами — это первый вопрос на РК.\n2. Разберите таблицу/схему: какие случаи различаются и почему.\n3. Выпишите формулы, которые нужно помнить наизусть.\n\n**Вопросы для самопроверки:**\n\n- Что произойдёт, если нарушить основной инвариант?\n- Какова сложность ключевой операции и почему?\n- Приведите пример, где этот подход не работает.`
        : `Разберём **«${context.title}»** (${context.subject}).\n\n**С чего начать**\n1. Перечитайте условие и выпишите, что именно сдаётся: код, отчёт, график.\n2. Найдите в материалах курса шаблон отчёта — так вы не потеряете баллы за оформление.\n\n**Ключевые шаги**\n1. Минимальная рабочая версия без оптимизаций.\n2. Тесты на граничные случаи: пустой ввод, один элемент, повторы.\n3. Замеры и выводы — за них обычно половина баллов.\n\n**Типичные ошибки**\n- нет сравнения с базовым решением;\n- графики без подписей осей;\n- выводы не опираются на цифры.\n\n> Я не решаю задание за вас, но могу проверить ваш план или кусок решения.`,
      suggestions: isMat
        ? ['Проверь мои ответы', 'Сделай ещё 5 вопросов', 'Объясни на примере']
        : ['Проверь мой план решения', 'Объясни теорию к заданию', 'Как оформить выводы?'],
    };
  }
  if (m.includes('план'))
    return {
      reply:
        '**План на сегодня**\n\n1. **19:00–20:30** — ЛР №4 по АиСД: дедлайн меньше чем через сутки, +8 баллов.\n2. **20:45–21:30** — ДЗ №3 по матанализу: разобрать 2 задачи из варианта.\n3. **21:30–21:45** — повторить шпаргалку к РК-2 по рядам.\n\nНачните с задачи, у которой ближе дедлайн и больше вес в БРС.',
      suggestions: ['Разбей ЛР №4 на шаги', 'Что повторить к РК-2?'],
    };
  return {
    reply:
      'Давайте разберёмся. Сформулируйте, **что именно** непонятно — определение, шаг решения или оформление. Можно вставить фрагмент своего решения, я подскажу, где ошибка.\n\nТакже можно открыть задание в разделе **«Учёба и ДЗ»** и нажать **«Разобрать с ИИ»** — я получу его условие.',
    suggestions: ['Объясни тему простыми словами', 'Сделай 5 вопросов для самопроверки'],
  };
}

// ───────────────────────── роутер

export async function mockFetch(path: string, method: string, body?: unknown): Promise<Reply> {
  await sleep(path.startsWith('/api/ai') ? 700 + Math.random() * 500 : 250 + Math.random() * 350);
  const s = load();
  const user = USERS.find((u) => u.email === s.session) ?? null;
  const b = (body ?? {}) as Record<string, string>;
  const url = path.split('?')[0];

  if (url === '/api/auth/login' && method === 'POST') {
    const u = USERS.find((x) => x.email.toLowerCase() === String(b.email ?? '').toLowerCase() && x.password === b.password);
    if (!u) return res(401, { error: 'Неверный email или пароль' });
    s.session = u.email;
    save();
    return res(200, { user: publicUser(u) });
  }
  if (url === '/api/auth/logout' && method === 'POST') {
    s.session = null;
    save();
    return res(200, { ok: true });
  }

  if (!user) return res(401, { error: 'Unauthorized' });

  if (url === '/api/auth/me') return res(200, { user: publicUser(user) });

  if (url === '/api/dashboard') {
    const mine = s.requests.filter((r) => r.ownerId === user.id).sort((a, b2) => +new Date(b2.createdAt) - +new Date(a.createdAt));
    const active = mine.find((r) => r.status === 'PENDING' || r.status === 'CREATED') ?? mine[0] ?? null;
    const grades = gradesFor(user.id);
    const ann = [...s.announcements].filter((a) => !('group' in a) || !a.group || a.group === user.group);
    if (user.id === 'u-maria') {
      ann.unshift({
        id: 'ann-debt',
        type: 'URGENT',
        title: 'Закройте задолженности до 1 декабря',
        body: 'По 2 дисциплинам итог ниже 60 баллов. Без пересдачи вы не будете допущены к экзаменам.',
        createdAt: new Date(Date.now() - 3_600_000).toISOString(),
      });
    }
    return res(200, {
      nextLesson: user.role === 'STUDENT' ? nextLesson() : null,
      deadlines: user.role === 'STUDENT' ? assignments(user.id).filter((a) => a.status === 'ACTIVE') : [],
      activeRequest: active,
      averageScore: grades.length ? Math.round((grades.reduce((x, g) => x + g.total, 0) / grades.length) * 10) / 10 : null,
      announcements: ann,
    });
  }

  if (url === '/api/schedule') return res(200, { lessons: weekLessons() });
  if (url === '/api/study') return res(200, { assignments: assignments(user.id), materials: MATERIALS });
  if (url === '/api/grades') return res(200, { subjects: gradesFor(user.id) });

  const submit = /^\/api\/study\/assignments\/([^/]+)\/submit$/.exec(url);
  if (submit && method === 'POST') {
    const a = assignments(user.id).find((x) => x.id === submit[1]);
    if (!a) return res(404, { error: 'Задание не найдено' });
    if (!b.link) return res(400, { error: 'Нужна ссылка на работу' });
    s.submissions[`${user.id}:${a.id}`] = { link: b.link, comment: b.comment ?? '', submittedAt: new Date().toISOString() };
    save();
    return res(201, { assignment: assignments(user.id).find((x) => x.id === a.id) });
  }

  if (url === '/api/requests' && method === 'GET') {
    return res(200, { requests: user.role === 'ADMIN' ? s.requests : s.requests.filter((r) => r.ownerId === user.id) });
  }
  if (url === '/api/requests' && method === 'POST') {
    const r = {
      id: `req-${++s.seq}`,
      ownerId: user.id,
      type: b.type,
      status: 'PENDING',
      comment: b.comment,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      student: { id: user.id, fullName: user.fullName, group: user.group, email: user.email },
    };
    s.requests.unshift(r as (typeof s.requests)[number]);
    save();
    return res(201, { request: r });
  }

  const one = /^\/api\/requests\/([^/]+)$/.exec(url);
  if (one) {
    const r = s.requests.find((x) => x.id === one[1]);
    if (method === 'GET') {
      if (!r) return res(user.role === 'ADMIN' ? 404 : 403, { error: 'Forbidden', message: 'Доступ запрещён: заявка принадлежит другому пользователю' });
      if (user.role !== 'ADMIN' && r.ownerId !== user.id)
        return res(403, { error: 'Forbidden', message: 'Доступ запрещён: заявка принадлежит другому пользователю' });
      return res(200, { request: r });
    }
    if (method === 'PATCH') {
      if (user.role !== 'ADMIN') return res(403, { error: 'Forbidden', message: 'Только сотрудник деканата' });
      if (!r) return res(404, { error: 'Заявка не найдена' });
      const now = new Date().toISOString();
      Object.assign(r, {
        status: b.status,
        updatedAt: now,
        ...(b.status === 'APPROVED'
          ? { signedAt: now, signedBy: 'Белова О. В., деканат ИУ', registryNumber: `ОРБ-2026-${String(++s.seq).padStart(6, '0')}` }
          : { adminComment: b.comment || 'Заявка отклонена деканатом.' }),
      });
      save();
      return res(200, { request: r });
    }
  }

  if (url === '/api/admin/announcements' && method === 'POST') {
    if (user.role !== 'ADMIN') return res(403, { error: 'Forbidden' });
    const a = { id: `ann-${++s.seq}`, type: b.type, title: b.title, body: b.body, group: b.group, createdAt: new Date().toISOString() };
    s.announcements.unshift(a as (typeof s.announcements)[number]);
    save();
    return res(201, { announcement: a });
  }

  if (url === '/api/ai/chat' && method === 'POST') {
    const ctx = (body as { context?: { title?: string; subject?: string; kind?: string } })?.context;
    return res(200, aiReply(String(b.message ?? ''), String(b.mode ?? 'TUTOR'), ctx));
  }

  return res(404, { error: `Mock: ${method} ${url} не реализован` });
}
