import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { key, telegramId } = body;

    // 1. Базовая проверка входящих данных
    if (!key || !telegramId) {
      return NextResponse.json(
        { error: 'Ключ и Telegram ID обязательны' }, 
        { status: 400 }
      );
    }

    // 2. Проверяем, привязан ли уже этот ключ к кому-то в базе
    // Мы храним связки в формате "link:ключ" -> "telegramId"
    const linkedTgId = await kv.get(`link:${key}`);

    if (linkedTgId) {
      // Если ключ уже использован, проверяем — тем же самым ли человеком?
      if (String(linkedTgId) === String(telegramId)) {
        return NextResponse.json({ 
          success: true, 
          message: 'Авторизация успешна (сессия возобновлена)' 
        });
      } else {
        // Если ID не совпадает — значит ключ украли или передали
        return NextResponse.json(
          { error: 'Этот ключ уже активирован другим пользователем' }, 
          { status: 403 }
        );
      }
    }

    // 3. Если ключ еще не привязан, проверяем, есть ли он в списке "valid_keys"
    // Команда SREM удаляет ключ из списка и возвращает 1, если он там был
    const wasRemoved = await kv.srem('valid_keys', key);

    if (wasRemoved === 1) {
      // Ключ был свободный! Теперь навсегда привязываем его к этому Telegram ID
      await kv.set(`link:${key}`, telegramId);
      
      // Создаем запись в твоем реестре для контроля (чтобы ты видел список в CLI)
      await kv.hset('user_registry', { [telegramId]: key });

      return NextResponse.json({ 
        success: true, 
        message: 'Доступ успешно активирован' 
      });
    } else {
      // Ключа нет в списке valid_keys (значит он либо поддельный, либо уже использован)
      return NextResponse.json(
        { error: 'Неверный или использованный ключ' }, 
        { status: 401 }
      );
    }

  } catch (error) {
    console.error('Auth Error:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера. Проверьте базу данных.' }, 
      { status: 500 }
    );
  }
}