/**
 * V3: проверочные вопросы по методичке.
 * Порядок источников: LLM (если задан AI_API_KEY и ответ валиден) → банк вопросов из БД (quizJson)
 * → автоматические вопросы «заполните пропуск» по ключевым терминам текста.
 */
import { randomInt } from 'node:crypto';
import { z } from 'zod';
import type { StudyMaterial } from '@prisma/client';
import { callLlm, isLlmConfigured } from './llm';

export const quizQuestionSchema = z.object({
  question: z.string().trim().min(5).max(500),
  options: z.array(z.string().trim().min(1).max(300)).length(4),
  correctIndex: z.number().int().min(0).max(3),
  explanation: z.string().trim().min(1).max(800),
});
export type QuizQuestion = z.infer<typeof quizQuestionSchema>;

const QUIZ_SIZE = 3;

function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Перемешивает варианты, сохраняя правильный ответ. */
function shuffleOptions(q: QuizQuestion): QuizQuestion {
  const order = shuffle([0, 1, 2, 3]);
  return { ...q, options: order.map((i) => q.options[i]), correctIndex: order.indexOf(q.correctIndex) };
}

export function parseBank(json: string | null): QuizQuestion[] {
  if (!json) return [];
  try {
    const parsed = z.array(quizQuestionSchema).safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

// ───────────────────────── автоматические вопросы по тексту

interface Fact {
  term: string;
  sentence: string;
}

const stripMd = (s: string) =>
  s
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

/** Служебные слова, которые выделяют жирным, но которые не являются терминами. */
const GENERIC_TERM = /^(пример|как |совет|типичн|итог|вывод|важно|замечани|задача|ответ|решение|шаг|случай)/i;

/** Термины, выделенные **жирным**, и предложения, в которых они встречаются. */
function extractFacts(markdown: string): Fact[] {
  const facts: Fact[] = [];
  const paragraphs = markdown.split(/\n\s*\n/).filter((p) => !p.trim().startsWith('#') && !p.trim().startsWith('|'));
  for (const p of paragraphs) {
    for (const sentence of p.split(/(?<=[.!?])\s+(?=[А-ЯA-Z*])/)) {
      for (const m of sentence.matchAll(/\*\*([^*]{2,40}?)\*\*/g)) {
        // «**Вставка.**», «**1. Цель работы.**» — подзаголовки, а не термины.
        if (/[.:]\s*$/.test(m[1])) continue;
        const term = m[1].replace(/[,;]+$/, '').trim();
        if (term.length < 4 || /\d/.test(term) || term.split(' ').length > 4 || GENERIC_TERM.test(term)) continue;
        const clean = stripMd(sentence.replace(/\*\*/g, '').replace(/^>\s*/, ''));
        if (clean.length < 40 || clean.length > 320) continue;
        facts.push({ term, sentence: clean });
      }
    }
  }
  const seen = new Set<string>();
  return facts.filter((f) => (seen.has(f.term.toLowerCase()) ? false : (seen.add(f.term.toLowerCase()), true)));
}

function clozeQuestions(material: StudyMaterial, pool: StudyMaterial[]): QuizQuestion[] {
  const facts = extractFacts(material.contentMarkdown);
  const allTerms = [...new Set(pool.flatMap((m) => extractFacts(m.contentMarkdown).map((f) => f.term)))];
  const out: QuizQuestion[] = [];
  for (const f of shuffle(facts)) {
    const distractors = shuffle(allTerms.filter((t) => t.toLowerCase() !== f.term.toLowerCase() && !f.sentence.toLowerCase().includes(t.toLowerCase()))).slice(0, 3);
    if (distractors.length < 3) continue;
    const re = new RegExp(f.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    out.push({
      question: `Заполните пропуск (${material.subject}): «${f.sentence.replace(re, '_____')}»`,
      options: [f.term, ...distractors],
      correctIndex: 0,
      explanation: `Верно: «${f.term}». Из методички «${material.title}»: ${f.sentence}`,
    });
    if (out.length === QUIZ_SIZE) break;
  }
  return out;
}

// ───────────────────────── LLM

async function llmQuestions(material: StudyMaterial): Promise<QuizQuestion[] | null> {
  if (!isLlmConfigured()) return null;
  const text = await callLlm([
    {
      role: 'system',
      content:
        'Ты составляешь проверочные вопросы для студентов по учебному тексту. Отвечай ТОЛЬКО JSON-массивом из 3 объектов ' +
        '{"question": string, "options": [4 строки], "correctIndex": 0..3, "explanation": string} на русском языке. ' +
        'Вопросы — по содержанию текста, один правильный вариант, правдоподобные неверные варианты, пояснение 1–2 предложения. Без markdown-обёртки.',
    },
    { role: 'user', content: `Методичка «${material.title}» (${material.subject}):\n\n${material.contentMarkdown.slice(0, 6000)}` },
  ]);
  if (!text) return null;
  try {
    const json = text.replace(/^```(?:json)?\s*|\s*```$/g, '');
    const parsed = z.array(quizQuestionSchema).min(QUIZ_SIZE).safeParse(JSON.parse(json));
    return parsed.success ? parsed.data.slice(0, QUIZ_SIZE) : null;
  } catch {
    return null;
  }
}

export async function generateQuiz(
  material: StudyMaterial,
  pool: StudyMaterial[],
): Promise<{ questions: QuizQuestion[]; source: 'llm' | 'bank' | 'rules' }> {
  const fromLlm = await llmQuestions(material);
  if (fromLlm) return { questions: fromLlm, source: 'llm' };

  const bank = parseBank(material.quizJson);
  if (bank.length >= QUIZ_SIZE) {
    return { questions: shuffle(bank).slice(0, QUIZ_SIZE).map(shuffleOptions), source: 'bank' };
  }

  const auto = clozeQuestions(material, pool);
  const merged = [...bank, ...auto].slice(0, QUIZ_SIZE);
  return { questions: merged.map(shuffleOptions), source: 'rules' };
}
