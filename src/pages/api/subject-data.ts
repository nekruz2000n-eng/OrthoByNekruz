// ════════════════════════════════════════════════════════════════════════════
//  /api/subject-data
//
//  Универсальный endpoint для отдачи контента ЛЮБОЙ дисциплины из SUBJECTS.
//  Не требует правок при добавлении новых предметов — берёт имя файла из
//  конфига и грузит соответствующий JSON.
//
//  Тело запроса (JSON):
//    {
//      subject:    'micro' | 'bio' | 'fizo' | ...   (id из SUBJECTS)
//      type:       'questions' | 'tests' | 'tasks' | 'glossary'
//      telegramId: <id пользователя>
//      initData:   <window.Telegram.WebApp.initData>
//    }
//
//  Защита:
//    1. Криптографическая проверка initData (HMAC-SHA256 по BOT_TOKEN)
//    2. Сверка tgUser.id с telegramId из тела
//    3. Проверка user.subjects[subjectId] === true в Redis
//    4. Whitelist имён файлов через getAllDataFileNames() — защита от
//       path traversal даже теоретически
// ════════════════════════════════════════════════════════════════════════════

import type { NextApiRequest, NextApiResponse } from 'next';
import { Redis }                from '@upstash/redis';
import { getSubject, getAllDataFileNames } from '@/lib/subjects';
import { verifyInitDataId }     from '@/lib/verifyInitData';

const redis     = Redis.fromEnv();
const BOT_TOKEN = process.env.BOT_TOKEN || '';

function userHasSubject(user: any, subjectId: string): boolean {
  if (!user) return false;
  if (user.subjects && typeof user.subjects === 'object') {
    return user.subjects[subjectId] === true;
  }
  // Legacy
  if (subjectId === 'ortho') return !!user.activatedKey;
  if (subjectId === 'micro') return user.micro === true;
  return false;
}

// ─── Динамическая загрузка JSON по имени файла ─────────────────────────────
// Имя строго whitelist'ится через getAllDataFileNames(), так что в require
// попадает только зарегистрированный в SUBJECTS файл. Если JSON ещё не
// создан — отдаём null, и хендлер вернёт 404 с осмысленным сообщением.
function loadDataFile(fileName: string): unknown | null {
  const allowed = getAllDataFileNames();
  if (!allowed.includes(fileName)) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require(`../../data/${fileName}`);
  } catch {
    return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { subject, type, telegramId, initData } = req.body ?? {};

    if (!BOT_TOKEN || !telegramId || !subject || !type) {
      return res.status(400).json({ error: 'Bad request' });
    }

    const subjectCfg = getSubject(String(subject));
    if (!subjectCfg) {
      return res.status(400).json({ error: 'Unknown subject' });
    }

    // 1. Верификация: либо через initData, либо через белый список
    if (!initData) {
      // Нет initData (неофициальный клиент) — проверяем белый список
      const inWL = await redis.sismember('sub_whitelist', String(telegramId));
      if (!inWL) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    } else {
      const userId = verifyInitDataId(String(initData), BOT_TOKEN);
      if (!userId || String(userId) !== String(telegramId)) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }

    // 2. Проверка доступа к дисциплине
    const user: any = await redis.get(`user_id:${telegramId}`);
    if (!userHasSubject(user, subjectCfg.id)) {
      return res.status(403).json({ error: 'No access to subject' });
    }

    // 3. Выбор файла по type
    let fileName: string | null = null;
    switch (type) {
      case 'questions': fileName = subjectCfg.questionsFile; break;
      case 'tasks':     fileName = subjectCfg.tasksFile;     break;
      case 'tests':     fileName = subjectCfg.testsFile;     break;
      case 'glossary':  fileName = subjectCfg.glossaryFile;  break;
      default:          return res.status(400).json({ error: 'Unknown type' });
    }

    const data = loadDataFile(fileName);
    if (data === null) {
      return res.status(404).json({
        error: `Data file not found: ${fileName}`,
        hint:  'Положите JSON в src/data/ и пересоберите приложение.',
      });
    }

    // Мёрж кастомных записей глоссария из Redis
    if (type === 'glossary' && Array.isArray(data)) {
      try {
        const customRaw = await redis.get(`glossary_custom:${subjectCfg.id}`);
        const custom: any[] = Array.isArray(customRaw) ? customRaw : [];
        if (custom.length > 0) {
          // Кастомные записи имеют приоритет: убираем из JSON те термины, что есть в Redis
          const customTermsLower = new Set(custom.map((e: any) => String(e.term).toLowerCase()));
          const base = (data as any[]).filter(e => !customTermsLower.has(String(e.term).toLowerCase()));
          return res.status(200).json({ data: [...custom, ...base] });
        }
      } catch { /* Redis недоступен — отдаём только JSON */ }
    }

    // Мёрж Redis-оверрайдов relatedTerms для questions/tests/tasks
    if (type !== 'glossary' && Array.isArray(data)) {
      try {
        const overridesRaw = await redis.get(`relatedTerms:${subjectCfg.id}:${type}`);
        if (overridesRaw && typeof overridesRaw === 'object' && !Array.isArray(overridesRaw)) {
          const overrides = overridesRaw as Record<string, string[]>;
          const merged = (data as any[]).map(item => {
            const id = String(item.id);
            if (id in overrides) return { ...item, relatedTerms: overrides[id] };
            return item;
          });
          return res.status(200).json({ data: merged });
        }
      } catch { /* Redis недоступен — отдаём JSON без оверрайдов */ }
    }

    return res.status(200).json({ data });

  } catch (err) {
    console.error('[subject-data] error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
