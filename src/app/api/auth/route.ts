import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { key, telegramId } = body;

    if (!key || !telegramId) {
      return NextResponse.json({ error: 'Ключ и Telegram ID обязательны' }, { status: 400 });
    }

    const linkedTgId = await kv.get(`link:${key}`);

    if (linkedTgId) {
      if (String(linkedTgId) === String(telegramId)) {
        return NextResponse.json({ success: true, message: 'Сессия возобновлена' });
      } else {
        return NextResponse.json({ error: 'Ключ уже активирован другим' }, { status: 403 });
      }
    }

    const wasRemoved = await kv.srem('valid_keys', key);

    if (wasRemoved === 1) {
      await kv.set(`link:${key}`, telegramId);
      await kv.hset('user_registry', { [telegramId]: key });
      return NextResponse.json({ success: true, message: 'Доступ активирован' });
    } else {
      return NextResponse.json({ error: 'Неверный ключ' }, { status: 401 });
    }
  } catch (error) {
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}