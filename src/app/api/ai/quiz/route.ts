import { prisma } from '@/lib/prisma';
import { HttpError, json, parseBody, route } from '@/lib/http';
import { requireSession } from '@/lib/session';
import { quizSchema } from '@/lib/validation';
import { hit } from '@/lib/rate-limit';
import { generateQuiz } from '@/lib/ai/quiz';

/**
 * POST /api/ai/quiz — 3 проверочных вопроса по методичке.
 * Студенту доступны только методички своего факультета (чужая/несуществующая → одинаковый 403).
 */
export const POST = route(async (req) => {
  const session = await requireSession();
  const limit = hit(`ai-quiz:${session.userId}`, 20, 60_000);
  if (!limit.ok) throw new HttpError(429, 'Слишком много запросов. Подождите немного.', { retryAfterSec: limit.retryAfterSec });

  const { materialId } = await parseBody(req, quizSchema);
  const material = await prisma.studyMaterial.findUnique({ where: { id: materialId } });

  if (session.role === 'STUDENT' && (!material || material.faculty !== session.user.faculty)) {
    console.warn(`[security] quiz blocked: user=${session.userId} material=${materialId}`);
    throw new HttpError(403, 'Доступ запрещён: методичка недоступна для вашего факультета');
  }
  if (!material) throw new HttpError(404, 'Методичка не найдена');

  const pool = await prisma.studyMaterial.findMany({ where: { faculty: material.faculty } });
  const { questions, source } = await generateQuiz(material, pool);
  if (questions.length === 0) throw new HttpError(422, 'По этой методичке пока не удалось составить вопросы');

  return json({
    materialId: material.id,
    title: material.title,
    subject: material.subject,
    questions,
    source,
  });
});
