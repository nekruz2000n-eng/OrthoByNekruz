// ════════════════════════════════════════════════════════════════════════════
//  /api/subject-data
//
//  Универсальный endpoint для отдачи контента дисциплин (вопросы / тесты /
//  задачи / глоссарий) после проверки доступа.
//
//  Тело запроса (JSON):
//    {
//      subject:    'micro' | 'pharma' | ...      (id из SUBJECTS)
//      type:       'questions' | 'tests' | 'tasks' | 'glossary'
//      telegramId: <id пользователя>
//      initData:   <window.Telegram.WebApp.initData>
//    }
//
//  Защита:
//    1. Криптографическая проверка initData (HMAC-SHA256 по BOT_TOKEN)
//    2. Сверка tgUser.id с telegramId из тела
//    3. Проверка user.subjects[subjectId] === true в Redis
// ════════════════════════════════════════════════════════════════════════════

import type { NextApiRequest, NextApiResponse } from 'next';
import { Redis }      from '@upstash/redis';
import { createHmac } from 'crypto';
import { getSubject } from '@/lib/subjects';

const redis     = Redis.fromEnv();
const BOT_TOKEN = process.env.BOT_TOKEN || '';

function verifyInitData(initData: string): number | null {
  try {
    const params = new URLSearchParams(initData);
    const hash   = params.get('hash');
    if (!hash) return null;
    params.delete('hash');
    const str    = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`).join('\n');
    const secret   = createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
    const expected = createHmac('sha256', secret).update(str).digest('hex');
    if (expected !== hash) return null;
    const authDate = Number(params.get('auth_date') || '0');
    if (Math.floor(Date.now() / 1000) - authDate > 86400) return null;
    const user = JSON.parse(params.get('user') || '{}');
    return user.id || null;
  } catch { return null; }
}

function userHasSubject(user: any, subjectId: string): boolean {
  if (!user) return false;
  // Новый формат
  if (user.subjects && typeof user.subjects === 'object') {
    return user.subjects[subjectId] === true;
  }
  // Legacy
  if (subjectId === 'ortho') return !!user.activatedKey;
  if (subjectId === 'micro') return user.micro === true;
  return false;
}

// ─── Жёсткая таблица соответствия имени файла → импорт ─────────────────────
// Выбран явный switch вместо `require(\`../../data/${name}\`)` чтобы избежать
// проблем со сборкой webpack на Vercel (динамические require иногда ломают
// бандл и приводят к 500 в проде).
function loadDataFile(fileName: string): unknown | null {
  switch (fileName) {
    case 'questions.json':       return require('../../data/questions.json');
    case 'tasks.json':           return require('../../data/tasks.json');
    case 'tests.json':           return require('../../data/tests.json');
    case 'glossary.json':        return require('../../data/glossary.json');
    case 'micro_questions.json': return require('../../data/micro_questions.json');
    case 'micro_tasks.json':     return require('../../data/micro_tasks.json');
    case 'micro_tests.json':     return require('../../data/micro_tests.json');
    case 'micro_glossary.json':  return require('../../data/micro_glossary.json');
    default: return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { subject, type, telegramId, initData } = req.body ?? {};

    if (!initData || !BOT_TOKEN || !telegramId || !subject || !type) {
      return res.status(400).json({ error: 'Bad request' });
    }

    const subjectCfg = getSubject(String(subject));
    if (!subjectCfg) {
      return res.status(400).json({ error: 'Unknown subject' });
    }

    // 1. Криптопроверка initData + сверка id
    const userId = verifyInitData(String(initData));
    if (!userId || String(userId) !== String(telegramId)) {
      return res.status(401).json({ error: 'Unauthorized' });
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
      return res.status(404).json({ error: `Data file not found: ${fileName}` });
    }

    return res.status(200).json({ data });

  } catch (err) {
    console.error('[subject-data] error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
