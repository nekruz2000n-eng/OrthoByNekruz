'use server';

/**
 * Server Action for Groq API integration.
 */

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

export async function analyzeClinicalCase(text: string) {
  if (!text) throw new Error('Текст для анализа пуст');
  if (!GROQ_API_KEY) throw new Error('API ключ Groq не настроен в переменных окружения');

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { 
            role: "system", 
            content: `Ты — ведущий эксперт в области ортопедической стоматологии и биомеханики. Твоя задача — не пересказывать текст, а проводить его критический и инженерный анализ.

АЛГОРИТМ ТВОЕГО ОТВЕТА:

1. ИНЖЕНЕРНАЯ СУТЬ: Объясни физику процесса (распределение нагрузки, точки опоры, векторы сил), описанную в тексте.
2. КЛИНИЧЕСКИЙ СМЫСЛ: Зачем это нужно врачу на практике? Что будет, если этого не сделать?
3. ПРОСТАЯ АНАЛОГИЯ: Приведи аналогию из архитектуры, строительства или механики (например, сравнение мостовидного протеза с настоящим мостом).
4. СЛОЖНЫЙ ТЕРМИН ПРОСТЫМИ СЛОВАМИ: Выбери 1-2 сложных термина из текста и дай им расшифровку.

Стиль: Говори как инженер-дизайнер, который учит медика. Используй логику, а не просто сухие факты. Используй Markdown для оформления.` 
          },
          { 
            role: "user", 
            content: `Проведи инженерный анализ этой задачи и ответа:\n\n${text}` 
          }
        ],
        temperature: 0.7,
        max_tokens: 1500
      }),
      cache: 'no-store'
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Groq API Error Details:', errorData);
      throw new Error(errorData.error?.message || `Ошибка API: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error: any) {
    console.error('Server Action Error:', error);
    throw new Error(error.message || 'Не удалось связаться с сервером AI (Groq)');
  }
}
