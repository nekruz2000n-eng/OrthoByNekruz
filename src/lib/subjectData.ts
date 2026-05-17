// ════════════════════════════════════════════════════════════════════════════
//  Загрузка данных предмета с кэшированием на клиенте.
//
//  Стратегия: данные хранятся в Cache API браузера с TTL 24 часа.
//  Пока кэш свежий — ни одного запроса к серверу. Раз в сутки (или при
//  новом деплое) данные обновляются автоматически.
//
//  При новом деплое BUILD_ID меняется → имя кэша меняется → старый кэш
//  удаляется и данные сразу подтягиваются с сервера у всех студентов.
// ════════════════════════════════════════════════════════════════════════════

const BUILD_ID     = process.env.NEXT_PUBLIC_BUILD_ID || 'dev';
const CACHE_NAME   = `subject-data-${BUILD_ID}`;
const CACHE_PREFIX = 'subject-data-';

// dev: 5 минут (данные часто меняются при разработке)
// prod: 24 часа — раз в сутки проверяем сервер
const TTL_MS = BUILD_ID === 'dev' ? 5 * 60 * 1000 : 24 * 60 * 60 * 1000;

export type SubjectDataType = 'questions' | 'tasks' | 'tests' | 'glossary';

type Cached = { ts: number; data: unknown[] };

let _purged = false;
async function purgeOldCaches(): Promise<void> {
  if (_purged || typeof caches === 'undefined') return;
  _purged = true;
  try {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(k => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME)
        .map(k => caches.delete(k)),
    );
  } catch { /* не критично */ }
}

function cacheKey(subject: string, type: SubjectDataType): string {
  return `https://cache.local/subject-data/${subject}/${type}`;
}

async function fetchFromServer(subject: string, type: SubjectDataType): Promise<unknown[]> {
  const tgId    = localStorage.getItem('user_tg_id') || '';
  const initDat = (typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.initData) || '';
  const r = await fetch('/api/subject-data', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ subject, type, telegramId: tgId, initData: initDat }),
  });
  if (!r.ok) return [];
  const j = await r.json();
  return Array.isArray(j.data) ? j.data : [];
}

/**
 * Возвращает данные предмета.
 * - Если кэш свежий (< 24ч) → отдаёт сразу, без запроса к серверу.
 * - Если кэш устарел или отсутствует → загружает с сервера и кэширует.
 * - При новом деплое кэш инвалидируется автоматически через BUILD_ID.
 */
export async function loadSubjectData(
  subject: string,
  type: SubjectDataType,
): Promise<unknown[]> {
  void purgeOldCaches();

  const key = cacheKey(subject, type);

  // 1. Проверяем кэш
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
  } catch { /* приватный режим — идём напрямую */ }

  // 2. Загружаем с сервера
  let data: unknown[] = [];
  try {
    data = await fetchFromServer(subject, type);
  } catch { /* нет сети — вернём пустой */ }

  // 3. Кэшируем на 24 часа
  try {
    if (typeof caches !== 'undefined' && data.length) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(key, new Response(JSON.stringify({ ts: Date.now(), data } as Cached)));
    }
  } catch { /* не критично */ }

  return data;
}
