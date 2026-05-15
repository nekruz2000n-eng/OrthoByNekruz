// ════════════════════════════════════════════════════════════════════════════
//  Загрузка данных предмета с кэшированием на клиенте.
//
//  Зачем: /api/subject-data отдаёт весь массив тестов/вопросов (сотни КБ).
//  Без кэша каждое повторное открытие предмета — лишний вызов функции Vercel
//  и лишний трафик. Кэш в Cache API (как для аудио) убирает повторные запросы.
//
//  Прохождение тестов/вопросов на расход не влияет вообще — оно полностью
//  локальное. Запрос идёт только при первой загрузке предмета.
// ════════════════════════════════════════════════════════════════════════════

const CACHE_NAME = 'subject-data-v1';
const TTL_MS     = 6 * 60 * 60 * 1000; // 6 часов — данные обновятся максимум через 6 ч после деплоя

export type SubjectDataType = 'questions' | 'tasks' | 'tests' | 'glossary';

type Cached = { ts: number; data: unknown[] };

function cacheKey(subject: string, type: SubjectDataType): string {
  return `https://cache.local/subject-data/${subject}/${type}`;
}

/**
 * Возвращает массив данных предмета. Сначала пробует свежий кэш,
 * иначе грузит с сервера и кэширует. При любой ошибке вернёт [].
 */
export async function loadSubjectData(
  subject: string,
  type: SubjectDataType,
): Promise<unknown[]> {
  const key = cacheKey(subject, type);

  // 1. свежий кэш
  try {
    if (typeof caches !== 'undefined') {
      const cache = await caches.open(CACHE_NAME);
      const hit   = await cache.match(key);
      if (hit) {
        const cached = (await hit.json()) as Cached;
        if (cached && Array.isArray(cached.data) && Date.now() - cached.ts < TTL_MS) {
          return cached.data;
        }
      }
    }
  } catch { /* кэш недоступен (приватный режим и т.п.) — просто грузим с сервера */ }

  // 2. загрузка с сервера
  let data: unknown[] = [];
  try {
    const tgId    = localStorage.getItem('user_tg_id') || '';
    const initDat = (typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.initData) || '';
    const r = await fetch('/api/subject-data', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ subject, type, telegramId: tgId, initData: initDat }),
    });
    if (r.ok) {
      const j = await r.json();
      if (Array.isArray(j.data)) data = j.data;
    }
  } catch { /* сеть недоступна — вернём пустой массив */ }

  // 3. сохраняем в кэш (только непустой ответ)
  try {
    if (typeof caches !== 'undefined' && data.length) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(key, new Response(JSON.stringify({ ts: Date.now(), data } as Cached)));
    }
  } catch { /* запись в кэш не критична */ }

  return data;
}
