import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

export async function POST(request: Request) {
  try {
    const { key, telegramId } = await request.json();

    if (!telegramId) {
      return NextResponse.json(
        { error: 'ID пользователя не найден. Откройте через Telegram.' },
        { status: 400 }
      );
    }

    const tgIdStr = String(telegramId);

    // 1. Проверка существующего пользователя
    const existingUser = await kv.get(`user_id:${tgIdStr}`);
    
    if (existingUser) {
      return NextResponse.json({ success: true, message: 'С возвращением!' });
    }

    // 2. Регистрация нового (нужен ключ)
    if (!key || key.trim() === '') {
      return NextResponse.json(
        { error: 'Для первого входа введите ключ' },
        { status: 401 }
      );
    }

    const isKeyValid = await kv.sismember('valid_keys', key.trim());
    
    if (!isKeyValid) {
      return NextResponse.json(
        { error: 'Неверный или уже использованный ключ' },
        { status: 401 }
      );
    }

    // 3. Привязка
    await kv.set(`user_id:${tgIdStr}`, { 
      activatedKey: key.trim(), 
      date: new Date().toISOString() 
    });
    
    // Сжигаем ключ
    await kv.srem('valid_keys', key.trim());

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Auth Error:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}