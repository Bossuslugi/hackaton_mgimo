/**
 * Схемы входных данных API (zod). Принимают как имена полей из specs/04_API_CONTRACT.md,
 * так и алиасы, которые шлёт текущий фронтенд (link/comment, body/group и т.д.).
 * Поля userId/role в телах не объявлены и потому игнорируются.
 */
import { z } from 'zod';
import { REQUEST_TYPES } from './domain';

const trimmed = (max: number, label: string) =>
  z.string({ invalid_type_error: `${label}: ожидается строка` }).trim().max(max, `${label}: не длиннее ${max} символов`);

const optionalText = (max: number, label: string) =>
  z
    .union([trimmed(max, label), z.null()])
    .optional()
    .transform((v) => (v ? v : undefined));

export const loginSchema = z.object({
  email: z.string({ required_error: 'Укажите email' }).trim().toLowerCase().email('Некорректный email').max(254),
  password: z.string({ required_error: 'Укажите пароль' }).min(1, 'Укажите пароль').max(128),
});

const httpsUrl = z
  .string()
  .trim()
  .max(2048, 'Ссылка слишком длинная')
  .url('Некорректная ссылка')
  .refine((v) => v.startsWith('https://'), 'Ссылка должна начинаться с https://');

const optionalUrl = z.preprocess((v) => (v === '' || v === null ? undefined : v), httpsUrl.optional());

/** V1: ссылка; V2: ещё и решение, написанное на сайте. Достаточно одного из двух. */
export const submitAssignmentSchema = z
  .object({
    solutionText: z
      .union([z.string().max(20_000, 'Решение: не длиннее 20 000 символов'), z.null()])
      .optional()
      .transform((v) => (v && v.trim() ? v.replace(/\s+$/, '') : undefined)),
    submissionUrl: optionalUrl,
    link: optionalUrl,
    studentComment: optionalText(1000, 'Комментарий'),
    comment: optionalText(1000, 'Комментарий'),
  })
  .transform((b) => ({
    solutionText: b.solutionText,
    submissionUrl: b.submissionUrl ?? b.link,
    studentComment: b.studentComment ?? b.comment,
  }))
  .refine((b) => !!b.submissionUrl || !!b.solutionText, {
    message: 'Напишите решение в редакторе или укажите ссылку на работу (https://…)',
    path: ['solutionText'],
  });

// ───────────────────────── заявки: структурированные поля формы (V2)

const shortStr = (max: number, label: string) => trimmed(max, label).min(1, `${label}: не может быть пустым`).optional();
const copies = (max: number) => z.number().int().min(1, 'Копий: от 1').max(max, `Копий: не больше ${max}`).optional();

export const REQUEST_PAYLOAD_SCHEMAS = {
  STUDY_CERTIFICATE: z.object({ destination: shortStr(200, 'Место требования'), copies: copies(5) }),
  MILITARY_CERTIFICATE: z.object({ militaryOffice: shortStr(200, 'Военкомат'), copies: copies(3) }),
  FINANCIAL_AID: z.object({
    category: z
      .enum(['Малоимущая семья', 'Сирота', 'Инвалидность', 'Сложная жизненная ситуация', 'Рождение ребёнка', 'Другое'], {
        errorMap: () => ({ message: 'Категория материальной помощи не из списка' }),
      })
      .optional(),
    amountRequested: z.number().int().min(0).max(1_000_000).optional(),
    reason: shortStr(1000, 'Обоснование'),
  }),
  PGAS: z.object({
    achievements: z
      .array(
        z.object({
          type: z.enum(['Учебная', 'Научная', 'Общественная', 'Культурная', 'Спортивная'], {
            errorMap: () => ({ message: 'Тип достижения не из списка' }),
          }),
          title: trimmed(300, 'Достижение').min(1, 'Опишите достижение'),
          date: z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/, 'Дата достижения: YYYY-MM или YYYY-MM-DD').optional(),
        }),
      )
      .max(10, 'Не больше 10 достижений')
      .optional(),
  }),
  RETAKE: z.object({ subject: shortStr(200, 'Дисциплина'), controlPoint: shortStr(100, 'Контрольная точка'), reason: shortStr(1000, 'Причина') }),
  ACADEMIC_TRANSCRIPT: z.object({
    destination: shortStr(200, 'Место требования'),
    copies: copies(5),
    language: z.enum(['ru', 'en']).optional(),
  }),
  DORMITORY_PASS: z.object({
    dormitory: shortStr(100, 'Общежитие'),
    room: shortStr(20, 'Комната'),
    guestName: shortStr(200, 'ФИО гостя'),
    period: shortStr(100, 'Период'),
  }),
} as const;

export const createRequestSchema = z
  .object({
    type: z.enum(REQUEST_TYPES, { errorMap: () => ({ message: `Тип заявки: одно из ${REQUEST_TYPES.join(', ')}` }) }),
    comment: optionalText(1000, 'Комментарий'),
    payload: z.unknown().optional(),
    payloadJson: z.unknown().optional(),
  })
  .transform((b, ctx) => {
    let raw: unknown = b.payload ?? b.payloadJson;
    if (typeof raw === 'string') {
      try {
        raw = raw.trim() ? JSON.parse(raw) : undefined;
      } catch {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['payloadJson'], message: 'payloadJson: некорректный JSON' });
        return z.NEVER;
      }
    }
    let payloadJson: string | undefined;
    if (raw !== undefined && raw !== null) {
      const parsed = REQUEST_PAYLOAD_SCHEMAS[b.type].safeParse(raw);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) ctx.addIssue({ ...issue, path: ['payload', ...issue.path] });
        return z.NEVER;
      }
      const clean = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== undefined));
      if (Object.keys(clean).length) payloadJson = JSON.stringify(clean);
      if (payloadJson && payloadJson.length > 4000) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['payload'], message: 'Слишком много данных в форме заявки' });
        return z.NEVER;
      }
    }
    return { type: b.type, comment: b.comment, payloadJson };
  });

export const updateRequestSchema = z
  .object({
    status: z.enum(['IN_REVIEW', 'APPROVED', 'REJECTED'], {
      errorMap: () => ({ message: 'Статус: IN_REVIEW, APPROVED или REJECTED' }),
    }),
    adminComment: optionalText(1000, 'Комментарий деканата'),
    comment: optionalText(1000, 'Комментарий деканата'),
  })
  .transform((b) => ({ status: b.status, adminComment: b.adminComment ?? b.comment }))
  .refine((b) => b.status !== 'REJECTED' || !!b.adminComment, {
    message: 'При отказе укажите причину в комментарии',
    path: ['adminComment'],
  });

export const announcementSchema = z
  .object({
    title: trimmed(200, 'Заголовок').min(1, 'Укажите заголовок'),
    message: optionalText(2000, 'Текст'),
    body: optionalText(2000, 'Текст'),
    targetGroup: optionalText(20, 'Группа'),
    group: optionalText(20, 'Группа'),
    rescheduleSubject: optionalText(200, 'Дисциплина'),
    subject: optionalText(200, 'Дисциплина'),
    newRoom: optionalText(20, 'Аудитория'),
    type: z.string().optional(),
  })
  .transform((b) => ({
    title: b.title,
    message: b.message ?? b.body,
    targetGroup: b.targetGroup ?? b.group,
    rescheduleSubject: b.rescheduleSubject ?? b.subject,
    newRoom: b.newRoom,
    urgent: b.type === 'URGENT',
  }))
  .refine((b) => !!b.message, { message: 'Укажите текст объявления', path: ['message'] })
  .refine((b) => !b.rescheduleSubject === !b.newRoom, {
    message: 'Для переноса укажите и дисциплину, и новую аудиторию',
    path: ['newRoom'],
  });

export const chatSchema = z
  .object({
    message: trimmed(2000, 'Сообщение').min(1, 'Введите сообщение'),
    mode: z.string().optional(),
    contextTitle: optionalText(300, 'Контекст'),
    context: z
      .object({ title: z.string().max(300).optional(), subject: z.string().max(200).optional(), kind: z.string().max(40).optional() })
      .partial()
      .nullable()
      .optional(),
    history: z
      .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(4000) }))
      .max(20)
      .optional(),
  })
  .transform((b) => {
    const m = (b.mode ?? 'concierge').toLowerCase();
    return {
      message: b.message,
      mode: (m === 'tutor' ? 'tutor' : 'concierge') as 'tutor' | 'concierge',
      contextTitle: b.contextTitle ?? b.context?.title?.trim() ?? undefined,
      contextSubject: b.context?.subject?.trim() || undefined,
      history: (b.history ?? []).slice(-10),
    };
  });

// ───────────────────────── V2: расписание, брони, сообщения, кабинет преподавателя

export const scheduleQuerySchema = z
  .object({
    mode: z.enum(['my', 'group', 'room'], { errorMap: () => ({ message: 'mode: my, group или room' }) }).default('my'),
    query: z.string().trim().max(50, 'Запрос: не длиннее 50 символов').optional(),
  })
  .refine((q) => q.mode === 'my' || !!q.query, { message: 'Укажите query для поиска по группе или аудитории', path: ['query'] });

export const createBookingSchema = z.object({
  roomName: trimmed(100, 'Помещение').min(1, 'Укажите помещение'),
  building: z.string().max(100).optional(), // игнорируется: корпус берётся из каталога
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата в формате YYYY-MM-DD'),
  timeSlot: z
    .string()
    .trim()
    .transform((v) => v.replace(/\s*[-–—]\s*/, ' – ')),
  purpose: trimmed(200, 'Цель').min(3, 'Опишите цель бронирования (от 3 символов)'),
  participantsCount: z.coerce.number().int('Число участников — целое').min(1, 'Участников: от 1').max(500),
});

export const sendMessageSchema = z.object({
  content: z
    .string({ required_error: 'Введите текст сообщения', invalid_type_error: 'Текст сообщения — строка' })
    .trim()
    .min(1, 'Сообщение не может быть пустым')
    .max(2000, 'Сообщение: не длиннее 2000 символов'),
});

const MAX_DEADLINE_MS = 180 * 24 * 3600 * 1000;

export const createTeacherAssignmentSchema = z.object({
  groupName: trimmed(20, 'Группа').min(1, 'Укажите группу'),
  subject: trimmed(200, 'Дисциплина').min(1, 'Укажите дисциплину'),
  title: trimmed(200, 'Название').min(3, 'Название: от 3 символов'),
  description: trimmed(2000, 'Описание').default(''),
  taskPrompt: z.string().max(20_000, 'Условие: не длиннее 20 000 символов').refine((v) => v.trim().length > 0, 'Напишите условие задачи'),
  starterTemplate: z
    .union([z.string().max(20_000, 'Шаблон: не длиннее 20 000 символов'), z.null()])
    .optional()
    .transform((v) => (v && v.trim() ? v : undefined)),
  deadline: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), 'Дедлайн — дата в формате ISO-8601')
    .transform((v) => new Date(v).toISOString())
    .refine((v) => Date.parse(v) > Date.now(), 'Дедлайн должен быть в будущем')
    .refine((v) => Date.parse(v) < Date.now() + MAX_DEADLINE_MS, 'Дедлайн — не дальше 180 дней'),
  brsWeight: z.coerce.number().int('Вес — целое число').min(1, 'Вес: от 1').max(40, 'Вес: не больше 40'),
  materialId: optionalText(40, 'Методичка'),
});

export const gradeSchema = z.object({
  gradeAwarded: z.coerce.number({ invalid_type_error: 'Балл — число' }).int('Балл — целое число').min(0, 'Балл не может быть отрицательным'),
  teacherFeedback: optionalText(2000, 'Комментарий'),
});
