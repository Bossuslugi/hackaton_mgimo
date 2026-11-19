/**
 * Детерминированный «ИИ без ключа»: структурированные персональные ответы на основе
 * реальных баллов, дедлайнов, заявок и регламентов (PRD §3.4–3.7). Ничего не выдумывает.
 */
import {
  BRS,
  REQUEST_SLA_DAYS,
  REQUEST_TYPE_LABELS,
  WEEKDAY_NAMES,
  type RequestType,
} from '../domain';
import type { AssignmentView, GradeView, MaterialView, StudentContext } from './context';

export interface Reply {
  reply: string;
  suggestions: string[];
}

const has = (text: string, ...words: string[]) => words.some((w) => text.includes(w));
const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е');

function firstName(full: string): string {
  return full.split(/\s+/)[1] ?? full;
}

function when(a: AssignmentView): string {
  const h = a.hoursLeft;
  if (a.status === 'OVERDUE' || h < 0) {
    const days = Math.max(1, Math.round(-h / 24));
    return `просрочено на ${days} ${plural(days, 'день', 'дня', 'дней')}`;
  }
  if (h < 1) return 'меньше часа';
  if (h < 48) return `через ${h} ${plural(h, 'час', 'часа', 'часов')}`;
  const d = Math.round(h / 24);
  return `через ${d} ${plural(d, 'день', 'дня', 'дней')}`;
}

function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

const open = (ctx: StudentContext) => ctx.assignments.filter((a) => a.status === 'TODO' || a.status === 'OVERDUE');

function gradeLine(g: GradeView): string {
  const tail = g.hasDebt
    ? `⚠️ до допуска не хватает **${g.pointsToAdmission}**`
    : g.pointsToExcellent > 0
      ? `до «отлично» — ${g.pointsToExcellent}`
      : '✅ уровень «отлично»';
  return `- **${g.subject}** (${g.controlType.toLowerCase()}): **${g.currentTotal}**/100 — ЛР ${g.labsScore}/${g.labsMax}, РК ${g.midtermScore}/${g.midtermMax}, посещаемость ${g.attendanceScore}/${g.attendanceMax}; ${tail}`;
}

/** Где быстрее всего добрать баллы по дисциплине. */
function recoveryPlan(g: GradeView, ctx: StudentContext): string[] {
  const steps: string[] = [];
  const related = open(ctx).filter((a) => a.subject === g.subject);
  for (const a of related) {
    steps.push(`Сдать «${a.title}» — до **${a.brsWeight}** баллов (${when(a)}${a.status === 'OVERDUE' ? ', поздняя сдача ещё принимается' : ''}).`);
  }
  const labsGap = g.labsMax - g.labsScore;
  const rkGap = g.midtermMax - g.midtermScore;
  const attGap = g.attendanceMax - g.attendanceScore;
  if (rkGap >= 8) steps.push(`Пересдать рубежный контроль: резерв **${rkGap}** баллов. Направление на пересдачу оформляется в разделе «Справки» (срок — ${REQUEST_SLA_DAYS.RETAKE} раб. дня).`);
  if (labsGap >= 6) steps.push(`Закрыть долги по лабораторным: резерв **${labsGap}** баллов.`);
  if (attGap >= 4) steps.push(`Не пропускать занятия до конца семестра: посещаемость даст ещё до **${attGap}** баллов.`);
  steps.push(`Записаться на консультацию к преподавателю (${g.teacher}) и уточнить, какие работы засчитываются в первую очередь.`);
  return steps;
}

// ───────────────────────── concierge

function scholarship(ctx: StudentContext): Reply {
  const { user, grades } = ctx;
  const below = grades.filter((g) => g.currentTotal < BRS.EXCELLENT);
  const lines: string[] = [`### Стипендия`, `Текущий статус: **${user.scholarshipStatus ?? 'не указан'}**.`, ''];
  if (user.studyForm === 'Договор') {
    lines.push(
      'Вы обучаетесь по договору, поэтому государственная академическая стипендия (в т.ч. ПГАС) не назначается.',
      'Что доступно: **материальная помощь** (по заявлению, срок рассмотрения — 10 раб. дн.) и перевод на бюджет при наличии вакантных мест и отсутствии долгов.',
    );
  } else if (!below.length) {
    lines.push(
      `✅ Все дисциплины на уровне «отлично» (≥ ${BRS.EXCELLENT}). Рейтинговое условие ПГАС выполнено.`,
      'Главный риск — не потерять баллы на финише: следите за дедлайнами, особенно с большим весом.',
    );
  } else {
    lines.push(`Для рейтинговой части ПГАС нужно ≥ ${BRS.EXCELLENT} по **всем** дисциплинам. Сейчас ниже порога:`, ...below.map(gradeLine));
  }
  const pgas = ctx.requests.find((r) => r.type === 'PGAS');
  if (pgas) lines.push('', `Заявка на ПГАС **${pgas.registryNumber}** — статус «${pgas.statusLabel}».`);
  const risky = open(ctx).filter((a) => a.hoursLeft < 72);
  if (risky.length) lines.push('', '**Ближайшие риски:**', ...risky.map((a) => `- ${a.subject}: «${a.title}» — ${when(a)}, ${a.brsWeight} б.`));
  return { reply: lines.join('\n'), suggestions: ['Покажи мои дедлайны', 'Какие у меня баллы?', 'Как оформить справку?'] };
}

function admissionRisk(ctx: StudentContext): Reply {
  const debts = ctx.grades.filter((g) => g.hasDebt);
  if (!debts.length) {
    const weakest = ctx.grades[0];
    return {
      reply: [
        '### Допуск к сессии',
        `✅ Рисков недопуска нет: по всем дисциплинам ≥ ${BRS.ADMISSION} баллов (порог допуска).`,
        weakest ? `Самая низкая дисциплина — **${weakest.subject}**: ${weakest.currentTotal} баллов.` : '',
      ].join('\n'),
      suggestions: ['Какие у меня баллы?', 'Хватает ли на повышенную стипендию?', 'Покажи мои дедлайны'],
    };
  }
  const blocks = debts.map((g) =>
    [`#### ${g.subject}: ${g.currentTotal} из ${BRS.ADMISSION} для допуска (не хватает ${g.pointsToAdmission})`, ...recoveryPlan(g, ctx).map((s, i) => `${i + 1}. ${s}`)].join('\n'),
  );
  return {
    reply: [
      '### ⚠️ Риск недопуска к промежуточной аттестации',
      `Допуск к экзамену/зачёту — от **${BRS.ADMISSION}** баллов семестрового рейтинга.`,
      '',
      ...blocks,
      '',
      ctx.user.curatorName ? `Куратор группы: **${ctx.user.curatorName}** — можно обратиться за помощью с планом.` : '',
    ].join('\n'),
    suggestions: ['Оформить направление на пересдачу', 'Покажи мои дедлайны', 'Объясни тему по эконометрике'],
  };
}

function gradesOverview(ctx: StudentContext): Reply {
  if (!ctx.grades.length) return { reply: 'В системе пока нет ваших баллов БРС.', suggestions: [] };
  return {
    reply: [
      '### Ваши баллы БРС',
      `Средний балл: **${ctx.average}**.`,
      '',
      ...ctx.grades.map(gradeLine),
      '',
      `_Шкала: допуск ≥ ${BRS.ADMISSION}, «3» — ${BRS.SATISFACTORY}–70, «4» — ${BRS.GOOD}–84, «5» — ≥ ${BRS.EXCELLENT}._`,
    ].join('\n'),
    suggestions: ctx.grades.some((g) => g.hasDebt)
      ? ['Как избежать недопуска?', 'Покажи мои дедлайны']
      : ['Хватает ли на повышенную стипендию?', 'Покажи мои дедлайны'],
  };
}

function deadlines(ctx: StudentContext): Reply {
  const list = open(ctx);
  const submitted = ctx.assignments.filter((a) => a.status === 'SUBMITTED');
  if (!list.length && !submitted.length) {
    return { reply: '🎉 Открытых заданий нет. Можно заняться подготовкой к РК — загляните в раздел «Материалы».', suggestions: ['Какие у меня баллы?'] };
  }
  const lines = ['### Дедлайны'];
  if (list.length) {
    lines.push(
      ...list.map((a) => `- ${a.status === 'OVERDUE' ? '🔴' : a.hoursLeft < 24 ? '🟠' : '🟢'} **${a.subject}** — «${a.title}»: ${when(a)}, вес **${a.brsWeight}** б.`),
    );
    const top = list[0];
    lines.push('', `**Что делать первым:** «${top.title}» — ${top.status === 'OVERDUE' ? 'сдайте как можно скорее, поздняя сдача ещё принимается' : 'ближайший срок'}.`);
  }
  if (submitted.length) lines.push('', '**На проверке:**', ...submitted.map((a) => `- ${a.subject} — «${a.title}»`));
  return { reply: lines.join('\n'), suggestions: ['Помоги составить план на сегодня', 'Какие у меня баллы?'] };
}

function requestsInfo(ctx: StudentContext, text: string): Reply {
  const guess: RequestType | null = has(text, 'военкомат', 'армия')
    ? 'MILITARY_CERTIFICATE'
    : has(text, 'пересдач', 'направлен')
      ? 'RETAKE'
      : has(text, 'материальн', 'матпомощ')
        ? 'FINANCIAL_AID'
        : has(text, 'пгас', 'повышенн')
          ? 'PGAS'
          : has(text, 'справк', 'об обучении')
            ? 'STUDY_CERTIFICATE'
            : null;
  const lines = ['### Справки и заявки'];
  if (guess) {
    lines.push(
      `**${REQUEST_TYPE_LABELS[guess]}** — оформляется онлайн в разделе «Справки»: выберите тип и нажмите «Заказать». Нормативный срок — **${REQUEST_SLA_DAYS[guess]} раб. ${plural(REQUEST_SLA_DAYS[guess], 'день', 'дня', 'дней')}**, реестровый номер присваивается сразу.`,
    );
    if (guess === 'PGAS' && ctx.user.studyForm === 'Договор') lines.push('⚠️ ПГАС назначается только студентам бюджетной формы.');
  } else {
    lines.push(
      'Онлайн можно оформить:',
      ...(Object.keys(REQUEST_TYPE_LABELS) as RequestType[]).map((t) => `- ${REQUEST_TYPE_LABELS[t]} — ${REQUEST_SLA_DAYS[t]} раб. дн.`),
    );
  }
  if (ctx.requests.length) {
    lines.push('', '**Ваши заявки:**', ...ctx.requests.map((r) => `- ${r.registryNumber} · ${r.typeLabel} — «${r.statusLabel}»${r.adminComment ? ` (${r.adminComment})` : ''}`));
  }
  return { reply: lines.join('\n'), suggestions: ['Сколько ждать справку?', 'Какие у меня баллы?'] };
}

function scheduleInfo(ctx: StudentContext): Reply {
  const lines = ['### Расписание'];
  const n = ctx.nextClass;
  if (n) {
    lines.push(`Ближайшая пара: **${n.subject}** (${n.typeLabel.toLowerCase()}), ${WEEKDAY_NAMES[n.dayOfWeek]} ${n.startTime}–${n.endTime}, ${n.location}, ${n.teacher}.`);
  } else lines.push('Расписание вашей группы пока не загружено.');
  if (ctx.rescheduled.length) {
    lines.push('', '**Переносы аудиторий:**', ...ctx.rescheduled.map((l) => `- ${l.subject}, ${WEEKDAY_NAMES[l.dayOfWeek]} ${l.startTime}: ауд. ${l.oldRoom} → **${l.room}** (${l.building})`));
  }
  return { reply: lines.join('\n'), suggestions: ['Покажи мои дедлайны', 'Какие у меня баллы?'] };
}

function overview(ctx: StudentContext): Reply {
  const name = firstName(ctx.user.fullName);
  const list = open(ctx);
  const debts = ctx.grades.filter((g) => g.hasDebt);
  const active = ctx.requests.filter((r) => r.status === 'NEW' || r.status === 'IN_REVIEW');
  const lines = [`${name}, вот главное на сегодня:`, ''];
  if (ctx.nextClass) lines.push(`- 📅 Ближайшая пара — **${ctx.nextClass.subject}**, ${WEEKDAY_NAMES[ctx.nextClass.dayOfWeek]} ${ctx.nextClass.startTime}, ${ctx.nextClass.location}.`);
  if (list[0]) lines.push(`- ⏰ Ближайший дедлайн — «${list[0].title}» (${list[0].subject}), ${when(list[0])}.`);
  if (ctx.average !== null) lines.push(`- 📊 Средний балл БРС — **${ctx.average}**.`);
  if (debts.length) lines.push(`- ⚠️ Риск недопуска: ${debts.map((g) => `${g.subject} (${g.currentTotal})`).join(', ')}.`);
  if (active.length) lines.push(`- 📄 Заявки в работе: ${active.map((r) => `${r.typeLabel} — «${r.statusLabel}»`).join('; ')}.`);
  lines.push('', 'Спросите про баллы, стипендию, дедлайны, справки или расписание — отвечу по вашим данным.');
  return {
    reply: lines.join('\n'),
    suggestions: debts.length
      ? ['Как избежать недопуска?', 'Покажи мои дедлайны', 'Оформить направление на пересдачу']
      : ['Хватает ли на повышенную стипендию?', 'Покажи мои дедлайны', 'Как заказать справку?'],
  };
}

export function conciergeReply(ctx: StudentContext, message: string): Reply {
  const t = norm(message);
  if (has(t, 'недопуск', 'допуск', 'долг', 'риск', 'отчисл', 'завал')) return admissionRisk(ctx);
  if (has(t, 'стипенд', 'пгас', 'повышенн')) return scholarship(ctx);
  if (has(t, 'справк', 'заявк', 'военкомат', 'материальн', 'матпомощ', 'пересдач', 'направлен')) return requestsInfo(ctx, t);
  if (has(t, 'дедлайн', 'дз', 'домашн', 'задани', 'сдать', 'срок', 'план на сегодня')) return deadlines(ctx);
  if (has(t, 'балл', 'брс', 'рейтинг', 'оценк', 'успеваем')) return gradesOverview(ctx);
  if (has(t, 'распис', 'пара', 'пары', 'аудитор', 'перенос', 'кабинет')) return scheduleInfo(ctx);
  return overview(ctx);
}

// ───────────────────────── tutor

function stripMd(s: string): string {
  return s
    .replace(/^#+\s*/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/^>\s*/gm, '')
    .trim();
}

function explainMaterial(m: MaterialView, message: string): Reply {
  const paragraphs = m.contentMarkdown
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p && !p.startsWith('#') && !p.startsWith('|'));
  // Сканируем формулы слева направо и оставляем содержательные: без кириллицы и не короче 5 символов.
  const formulas = Array.from(
    new Set(
      (m.contentMarkdown.match(/\$\$[\s\S]+?\$\$|\$[^$\n]+?\$/g) ?? []).filter((f) => f.length >= 7 && !/[а-яё]/i.test(f)),
    ),
  ).slice(0, 4);
  const tip = paragraphs.find((p) => p.startsWith('>'));
  const core = paragraphs.filter((p) => !p.startsWith('>')).slice(0, 2).map(stripMd);
  const wantsExample = has(norm(message), 'пример', 'задач', 'реш');
  const example = paragraphs.find((p) => /пример/i.test(p.slice(0, 40)));
  const lines = [
    `### ${m.title}`,
    `_${m.subject} · ${m.categoryLabel} · ~${m.readTimeMinutes} мин чтения_`,
    '',
    '**Суть в двух абзацах:**',
    ...core.map((p) => `> ${p.replace(/\n/g, ' ')}`),
  ];
  if (formulas.length) lines.push('', '**Ключевые формулы:**', ...formulas.map((f) => `- ${f}`));
  if (wantsExample && example) lines.push('', '**Разобранный пример:**', stripMd(example));
  lines.push(
    '',
    '**План на 25 минут:**',
    '1. 10 мин — прочитать материал целиком и выписать определения своими словами.',
    '2. 10 мин — повторить пример без подсказки, сверить с текстом.',
    '3. 5 мин — ответить на вопросы ниже вслух или письменно.',
    '',
    '**Проверь себя:**',
    `- Сформулируйте главное утверждение темы «${m.title}» в одном предложении.`,
    formulas[0] ? `- Объясните, что означает каждая величина в формуле ${formulas[0]}.` : '- Приведите собственный пример применения.',
    '- Где в задачах РК эта тема встречается чаще всего?',
  );
  if (tip) lines.push('', `💡 ${stripMd(tip)}`);
  return { reply: lines.join('\n'), suggestions: ['Разбери пример', 'Дай задачу для самопроверки', 'Составь план подготовки к РК'] };
}

function helpAssignment(a: AssignmentView, ctx: StudentContext): Reply {
  const mat = ctx.materials.find((m) => m.subject === a.subject);
  const sentences = a.description.split(/(?<=[.;])\s+/).filter(Boolean);
  return {
    reply: [
      `### ${a.title}`,
      `_${a.subject} · вес ${a.brsWeight} б. · ${when(a)}_`,
      '',
      '**Разбиваем на шаги:**',
      ...sentences.map((s, i) => `${i + 1}. ${s.replace(/[.;]$/, '')}.`),
      `${sentences.length + 1}. Проверить результат по требованиям, оформить и прикрепить ссылку (https://…) в разделе «Учёба».`,
      '',
      mat ? `📚 По теме есть материал: **«${mat.title}»** (${mat.categoryLabel.toLowerCase()}, ~${mat.readTimeMinutes} мин).` : '',
      a.status === 'OVERDUE' ? '⚠️ Срок прошёл, но поздняя сдача ещё принимается — решение о штрафе за преподавателем.' : '',
      '',
      '_Готового решения не дам — но могу объяснить любой шаг подробно._',
    ]
      .filter((l) => l !== '')
      .join('\n'),
    suggestions: ['Объясни первый шаг подробнее', 'С чего начать?', 'Сколько баллов я получу?'],
  };
}

export function tutorReply(ctx: StudentContext, message: string, contextSubject?: string): Reply {
  if (ctx.focusMaterial) return explainMaterial(ctx.focusMaterial, message);
  if (ctx.focusAssignment) return helpAssignment(ctx.focusAssignment, ctx);

  const t = norm(message);
  const bySubject =
    ctx.materials.find((m) => contextSubject && m.subject === contextSubject) ??
    ctx.materials.find((m) => t.includes(norm(m.subject).split(' ')[0]) || norm(m.title).split(' ').some((w) => w.length > 5 && t.includes(w)));
  if (bySubject) return explainMaterial(bySubject, message);

  const list = open(ctx);
  const weakest = ctx.grades[0];
  const lines = ['### План подготовки', ''];
  if (list.length) lines.push('**Сначала дедлайны:**', ...list.slice(0, 3).map((a, i) => `${i + 1}. ${a.subject} — «${a.title}» (${when(a)}, ${a.brsWeight} б.)`), '');
  if (weakest) {
    lines.push(`**Слабое место:** ${weakest.subject} — ${weakest.currentTotal} баллов.`);
    const mat = ctx.materials.find((m) => m.subject === weakest.subject);
    if (mat) lines.push(`Начните с материала «${mat.title}» (~${mat.readTimeMinutes} мин).`);
    lines.push('');
  }
  lines.push(
    '**Метод:** 25 минут работы → 5 минут отдыха; после каждой темы — 3 вопроса для самопроверки без конспекта.',
    '',
    'Доступные материалы вашего факультета:',
    ...ctx.materials.map((m) => `- ${m.subject}: «${m.title}» (${m.categoryLabel})`),
  );
  return {
    reply: lines.join('\n'),
    suggestions: ctx.materials.slice(0, 3).map((m) => `Объясни: ${m.title}`),
  };
}

export function adminReply(message: string): Reply {
  const t = norm(message);
  if (has(t, 'заявк', 'очеред')) {
    return {
      reply:
        'Очередь заявок — в разделе «Заявки». Для каждой заявки доступны «Одобрить» и «Отклонить» (при отказе комментарий обязателен). Студент получает уведомление сразу после решения.',
      suggestions: ['Как сделать объявление о переносе?'],
    };
  }
  return {
    reply:
      'Я ассистент деканата. Персональные учебные данные студентов в чате не раскрываются. Могу подсказать по работе с очередью заявок и рассылке объявлений: для переноса аудитории укажите группу, дисциплину и новую аудиторию — расписание обновится автоматически.',
    suggestions: ['Как обработать заявку?', 'Как сделать объявление о переносе?'],
  };
}
