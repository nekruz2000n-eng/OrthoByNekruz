// app/api/micro-data/route.ts
//
// ═══════════════════════════════════════════════════════════════════════════
//  Серверный API для данных микробиологии.
//
//  ЗАЧЕМ: если импортировать micro_questions.json в клиентский компонент,
//  данные попадают в JS-бандл и любой может их скачать без ключа.
//  Этот endpoint отдаёт данные ТОЛЬКО после двойной проверки:
//    1. HMAC подпись initData (Telegram)
//    2. user.micro === true в Redis
//
//  Использование в компонентах:
//    const res = await fetch('/api/micro-data', {
//      method: 'POST',
//      body: JSON.stringify({ type: 'questions', telegramId, initData }),
//    });
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { Redis }      from '@upstash/redis';
import { createHmac } from 'crypto';

const redis     = Redis.fromEnv();
const BOT_TOKEN = process.env.BOT_TOKEN || '';

// ── Верификация initData ─────────────────────────────────────────────────────
function verifyInitData(initData: string): number | null {
  try {
    const params = new URLSearchParams(initData);
    const hash   = params.get('hash');
    if (!hash) return null;

    params.delete('hash');
    const str = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    const secret   = createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
    const expected = createHmac('sha256', secret).update(str).digest('hex');
    if (expected !== hash) return null;

    // Проверка срока (24 часа)
    const authDate = Number(params.get('auth_date') || '0');
    if (Math.floor(Date.now() / 1000) - authDate > 86400) return null;

    const user = JSON.parse(params.get('user') || '{}');
    return user.id || null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { type, telegramId, initData } = await req.json();

    // ── 1. Проверяем initData подпись ───────────────────────────────────────
    if (!initData || !BOT_TOKEN || !telegramId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = verifyInitData(initData);
    if (!userId || String(userId) !== String(telegramId)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── 2. Проверяем что пользователь купил микробиологию ──────────────────
    const user: any = await redis.get(`user_id:${telegramId}`);
    if (!user || user.micro !== true) {
      return NextResponse.json({ error: 'No micro access' }, { status: 403 });
    }

    // ── 3. Отдаём данные (импорт только на сервере, не в клиентском бандле) ─
    if (type === 'questions') {
      const data = await import('@/data/micro_questions.json');
      return NextResponse.json({ data: data.default });
    }
    if (type === 'tasks') {
      const data = await import('@/data/micro_tasks.json');
      return NextResponse.json({ data: data.default });
    }
    if (type === 'tests') {
      const data = await import('@/data/micro_tests.json');
      return NextResponse.json({ data: data.default });
    }

    return NextResponse.json({ error: 'Unknown type' }, { status: 400 });

  } catch (err) {
    console.error('micro-data error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
