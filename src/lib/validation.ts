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

export const submitAssignmentSchema = z
  .object({
    submissionUrl: httpsUrl.optional(),
    link: httpsUrl.optional(),
    studentComment: optionalText(1000, 'Комментарий'),
    comment: optionalText(1000, 'Комментарий'),
  })
  .transform((b) => ({ submissionUrl: b.submissionUrl ?? b.link, studentComment: b.studentComment ?? b.comment }))
  .refine((b) => !!b.submissionUrl, { message: 'Укажите ссылку на работу (https://…)', path: ['submissionUrl'] });

export const createRequestSchema = z.object({
  type: z.enum(REQUEST_TYPES, { errorMap: () => ({ message: `Тип заявки: одно из ${REQUEST_TYPES.join(', ')}` }) }),
  comment: optionalText(1000, 'Комментарий'),
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
