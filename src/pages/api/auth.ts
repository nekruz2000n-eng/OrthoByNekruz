import type { NextApiRequest, NextApiResponse } from 'next';
import { kv } from '@vercel/kv';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Разрешаем только POST запросы
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { key, telegramId } = req.body;

  // Проверка наличия Telegram ID (обязательно для всех)
  if (!telegramId) {
    return res.status(400).json({ error: 'ID пользователя не найден. Откройте приложение через Telegram' });
  }

  // Приводим ID к строке для надежности поиска в базе
  const tgIdStr = String(telegramId);

  try {
    // 1. ПРОВЕРКА СУЩЕСТВУЮЩЕГО ПОЛЬЗОВАТЕЛЯ
    // Ищем в KV ключ вида "user_id:12345678"
    const existingUser = await kv.get(`user_id:${tgIdStr}`);
    
    if (existingUser) {
      // Если запись есть, значит доступ уже был активирован ранее
      return res.status(200).json({ 
        success: true, 
        message: 'С возвращением!' 
      });
    }

    // 2. РЕГИСТРАЦИЯ НОВОГО ПОЛЬЗОВАТЕЛЯ
    // Если записи нет, значит человек зашел впервые и ОБЯЗАН ввести ключ
    if (!key || key.trim() === '') {
      return res.status(401).json({ 
        error: 'Для первого входа необходимо ввести ключ активации' 
      });
    }

    // Проверяем, есть ли такой ключ в наборе 'valid_keys'
    const isKeyValid = await kv.sismember('valid_keys', key.trim());
    
    if (!isKeyValid) {
      return res.status(401).json({ 
        error: 'Неверный, просроченный или уже использованный ключ' 
      });
    }

    // 3. ПРИВЯЗКА И АКТИВАЦИЯ
    // Создаем запись в базе
    await kv.set(`user_id:${tgIdStr}`, { 
      activatedKey: key.trim(), 
      activatedAt: new Date().toISOString() 
    });

    // Удаляем использованный ключ из списка доступных (сжигаем его)
    await kv.srem('valid_keys', key.trim());

    return res.status(200).json({ 
      success: true, 
      message: 'Ключ успешно активирован!' 
    });

  } catch (error) {
    console.error('Auth API Error:', error);
    return res.status(500).json({ 
      error: 'Ошибка базы данных. Попробуйте позже' 
    });
  }
}