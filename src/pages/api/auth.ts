import type { NextApiRequest, NextApiResponse } from 'next';
import { kv } from '@vercel/kv';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Проверяем метод
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Метод не разрешен' });
  }

  const { key, telegramId } = req.body;

  // Проверка Telegram ID
  if (!telegramId) {
    return res.status(400).json({ error: 'Telegram ID не найден' });
  }

  const tgIdStr = String(telegramId);

  try {
    // 1. Проверяем, есть ли пользователь в базе (бесшовный вход)
    const existingUser = await kv.get(`user_id:${tgIdStr}`);
    
    if (existingUser) {
      return res.status(200).json({ success: true, message: 'Welcome back' });
    }

    // 2. Если пользователя нет, проверяем ключ
    if (!key || key.trim() === '') {
      return res.status(401).json({ error: 'Введите ключ активации' });
    }

    // Проверка ключа в базе
    const isKeyValid = await kv.sismember('valid_keys', key.trim());
    
    if (!isKeyValid) {
      return res.status(401).json({ error: 'Неверный или использованный ключ' });
    }

    // 3. Активация: привязываем ID к ключу
    await kv.set(`user_id:${tgIdStr}`, { 
      activatedKey: key.trim(), 
      date: new Date().toISOString() 
    });

    // Удаляем ключ из списка доступных
    await kv.srem('valid_keys', key.trim());

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('Auth Error:', error);
    return res.status(500).json({ error: 'Ошибка базы данных' });
  }
}