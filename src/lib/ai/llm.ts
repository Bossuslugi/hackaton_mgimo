/**
 * Серверный вызов OpenAI-совместимого Chat Completions API.
 * Ключ читается только здесь, на сервере, и никогда не попадает в ответ клиенту.
 */

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export const isLlmConfigured = () => Boolean(process.env.AI_API_KEY?.trim());

export async function callLlm(messages: LlmMessage[], timeoutMs = 20_000): Promise<string | null> {
  const key = process.env.AI_API_KEY?.trim();
  if (!key) return null;
  const base = (process.env.AI_BASE_URL?.trim() || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const model = process.env.AI_MODEL?.trim() || 'gpt-4o-mini';

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, messages, temperature: 0.3, max_tokens: 900 }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      console.error(`[ai] LLM provider responded ${res.status}`); // без ключа и тела запроса
      return null;
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content?.trim();
    return text || null;
  } catch (e) {
    console.error('[ai] LLM request failed:', e instanceof Error ? e.name : 'unknown');
    return null;
  } finally {
    clearTimeout(timer);
  }
}
