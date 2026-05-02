// app/api/micro-data/route.ts
//
// Серверный API для данных микробиологии.
// Данные НЕ импортируются в клиентский бандл — только через этот endpoint.
// Каждый запрос проверяет что пользователь купил микробиологию.
//
// Использование в компонентах:
//   const data = await fetch('/api/micro-data?type=questions', ...)
//
import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { createHmac } from 'crypto';

const redis = Redis.fromEnv();
const BOT_TOKEN = process.env.BOT_TOKEN || '';

function verifyInitData(initData: string): number | null {
  try {
    const params = new URLSearchParams(initData);
    const hash   = params.get('hash');
    if (!hash) return null;
    params.delete('hash');
    const str = [...params.entries()]
      .sort(([a],[b]) => a.localeCompare(b))
      .map(([k,v]) => `${k}=${v}`).join('\n');
    const secret   = createHmac('sha256','WebAppData').update(BOT_TOKEN).digest();
    const expected = createHmac('sha256', secret).update(str).digest('hex');
    if (expected !== hash) return null;
    const authDate = Number(params.get('auth_date') || '0');
    if (Math.floor(Date.now()/1000) - authDate > 86400) return null;
    const user = JSON.parse(params.get('user') || '{}');
    return user.id || null;
  } catch { return null; }
}

export async function POST(req: NextRequest) {
  try {
    const { type, telegramId, initData } = await req.json();

    // 1. Проверяем initData подпись
    if (!initData || !BOT_TOKEN) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = verifyInitData(initData);
    if (!userId || String(userId) !== String(telegramId)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Проверяем что пользователь купил микробиологию
    const user: any = await redis.get(`user_id:${telegramId}`);
    if (!user || user.micro !== true) {
      return NextResponse.json({ error: 'No micro access' }, { status: 403 });
    }

    // 3. Отдаём данные (импортируем здесь — не в клиенте)
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

  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
