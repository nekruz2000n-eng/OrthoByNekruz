const GEMINI_MODELS = [
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash',
  'gemini-1.5-flash-8b',
] as const;

const GROQ_MODEL = 'llama-3.3-70b-versatile';
const MAX_CONTEXT_CHARS = 12_000;

export function buildQuestionAiPrompts(
  mode: string,
  question: string,
  answer: string,
  userQuestion?: string,
) {
  const systemInstruction = `Ты — ассистент-преподаватель по ортопедической стоматологии и микробиологии.
Помогаешь студентам понять материал. Отвечай ТОЛЬКО на русском языке.
Пиши кратко и понятно. Используй простые аналогии из жизни.
Форматируй через Markdown: **жирный** для ключевых слов, - для списков.
Не повторяй вопрос. Максимум 250 слов.`;

  const q = question.replace(/\*\*/g, '').trim().slice(0, MAX_CONTEXT_CHARS);
  const a = answer.replace(/\*\*/g, '').trim().slice(0, MAX_CONTEXT_CHARS);

  const userPrompt = mode === 'explain'
    ? `Объясни этот материал ПРОЩЕ, как будто объясняешь первокурснику. Используй аналогии из повседневной жизни.

Тема: ${q}

Материал из учебника:
${a}

Дай краткое, понятное объяснение сути.`
    : `Контекст (тема): ${q}

Материал из учебника:
${a}

Вопрос студента: ${String(userQuestion || '').trim()}

Ответь чётко и по делу.`;

  return { systemInstruction, userPrompt };
}

export function friendlyAiError(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes('quota') || lower.includes('rate limit') || lower.includes('429')) {
    return 'Лимит ИИ временно исчерпан. Подожди 1–2 минуты и попробуй снова.';
  }
  if (lower.includes('api key') || lower.includes('не настроен')) {
    return 'ИИ сейчас недоступен. Напиши @evoeidos — разберёмся.';
  }
  if (lower.includes('пустой ответ')) {
    return 'ИИ не смог сформировать ответ. Попробуй переформулировать вопрос.';
  }
  return 'Не удалось получить ответ. Попробуй ещё раз чуть позже.';
}

function isQuotaError(msg: string): boolean {
  const lower = msg.toLowerCase();
  return lower.includes('quota') || lower.includes('rate limit') || lower.includes('429');
}

async function callGemini(
  apiKey: string,
  model: string,
  systemInstruction: string,
  userPrompt: string,
): Promise<{ text?: string; error?: string }> {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.6,
        maxOutputTokens: 600,
        topP: 0.9,
      },
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const msg = (err as { error?: { message?: string } }).error?.message
      || `Gemini ${response.status}`;
    return { error: msg };
  }

  const data = await response.json();
  const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  if (!text) return { error: 'Gemini вернул пустой ответ' };
  return { text };
}

async function callGroq(
  apiKey: string,
  systemInstruction: string,
  userPrompt: string,
): Promise<{ text?: string; error?: string }> {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.6,
      max_tokens: 600,
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const msg = (err as { error?: { message?: string } }).error?.message
      || `Groq ${response.status}`;
    return { error: msg };
  }

  const data = await response.json();
  const text: string = data.choices?.[0]?.message?.content || '';
  if (!text) return { error: 'Groq вернул пустой ответ' };
  return { text };
}

/** Groq первым (стабильнее), затем Gemini — несколько моделей. */
export async function generateQuestionAiAnswer(
  systemInstruction: string,
  userPrompt: string,
): Promise<{ result?: string; error?: string }> {
  const groqKey = process.env.GROQ_API_KEY?.trim();
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  const errors: string[] = [];

  if (groqKey) {
    const groq = await callGroq(groqKey, systemInstruction, userPrompt);
    if (groq.text) return { result: groq.text };
    if (groq.error) errors.push(groq.error);
  }

  if (geminiKey) {
    for (const model of GEMINI_MODELS) {
      const gemini = await callGemini(geminiKey, model, systemInstruction, userPrompt);
      if (gemini.text) return { result: gemini.text };
      if (gemini.error) {
        errors.push(`${model}: ${gemini.error}`);
        if (!isQuotaError(gemini.error)) break;
      }
    }
  }

  if (!groqKey && !geminiKey) {
    return { error: 'ИИ не настроен: добавь GROQ_API_KEY или GEMINI_API_KEY в Vercel' };
  }

  const last = errors[errors.length - 1] || 'Все провайдеры недоступны';
  return { error: friendlyAiError(last) };
}
