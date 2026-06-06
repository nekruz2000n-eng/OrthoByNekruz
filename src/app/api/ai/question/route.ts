import { NextResponse } from 'next/server';

// Gemini 2.0 Flash — бесплатно: 1500 запросов/день, 15 запросов/мин
const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

export async function POST(req: Request) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    return NextResponse.json({ error: 'GEMINI_API_KEY не настроен в Vercel' }, { status: 500 });
  }

  let body: { mode?: string; question?: string; answer?: string; userQuestion?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Неверный запрос' }, { status: 400 });
  }

  const { mode, question, answer, userQuestion } = body;

  if (!question || !answer) {
    return NextResponse.json({ error: 'Нет данных вопроса' }, { status: 400 });
  }

  if (mode === 'ask' && !String(userQuestion || '').trim()) {
    return NextResponse.json({ error: 'Введи вопрос' }, { status: 400 });
  }

  const systemInstruction = `Ты — ассистент-преподаватель по ортопедической стоматологии и микробиологии.
Помогаешь студентам понять материал. Отвечай ТОЛЬКО на русском языке.
Пиши кратко и понятно. Используй простые аналогии из жизни.
Форматируй через Markdown: **жирный** для ключевых слов, - для списков.
Не повторяй вопрос. Максимум 250 слов.`;

  const userPrompt = mode === 'explain'
    ? `Объясни этот материал ПРОЩЕ, как будто объясняешь первокурснику. Используй аналогии из повседневной жизни.

Тема: ${question.replace(/\*\*/g, '').trim()}

Материал из учебника:
${answer.replace(/\*\*/g, '').trim()}

Дай краткое, понятное объяснение сути.`
    : `Контекст (тема): ${question.replace(/\*\*/g, '').trim()}

Материал из учебника:
${answer.replace(/\*\*/g, '').trim()}

Вопрос студента: ${String(userQuestion || '').trim()}

Ответь чётко и по делу.`;

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
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
        || `Ошибка Gemini API: ${response.status}`;
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    const data = await response.json();
    const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!text) {
      return NextResponse.json({ error: 'Gemini вернул пустой ответ' }, { status: 500 });
    }

    return NextResponse.json({ result: text });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Сервер недоступен';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
