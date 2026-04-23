import type { NextApiRequest, NextApiResponse } from 'next';
import { kv } from '@vercel/kv';

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_USERNAME = process.env.CHANNEL_USERNAME || 'nzsdental'; // можно вынести в env

// Проверка подписки через Telegram Bot API
async function isSubscribed(userId: number): Promise<boolean> {
  if (!BOT_TOKEN) {
    console.error('BOT_TOKEN is not set');
    return false;
  }
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=@${CHANNEL_USERNAME}&user_id=${userId}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.ok) return false;
    const status = data.result.status;
    return ['member', 'administrator', 'creator'].includes(status);
  } catch (err) {
    console.error('Error checking subscription:', err);
    return false;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Метод не разрешен' });
  }

  const { key, telegramId } = req.body;

  // 1. Telegram ID обязателен
  if (!telegramId) {
    return res.status(400).json({ error: 'Telegram ID не найден' });
  }

  const tgIdStr = String(telegramId);

  try {
    // 2. Всегда проверяем подписку на канал
    const subscribed = await isSubscribed(Number(telegramId));
    if (!subscribed) {
      return res.status(403).json({
        error: `Для доступа необходимо подписаться на канал https://t.me/${CHANNEL_USERNAME}`,
        needSubscription: true,
      });
    }

    // 3. Проверяем, существует ли пользователь (повторный вход)
    const existingUser = await kv.get(`user_id:${tgIdStr}`);
    if (existingUser) {
      // Пользователь уже активирован, просто впускаем
      return res.status(200).json({ success: true });
    }

    // 4. Новый пользователь – требуется ключ активации
    if (!key || key.trim() === '') {
      return res.status(401).json({ error: 'Введите ключ активации' });
    }

    // 5. Проверяем ключ в Redis
    const isKeyValid = await kv.sismember('valid_keys', key.trim());
    if (!isKeyValid) {
      return res.status(401).json({ error: 'Неверный или уже использованный ключ' });
    }

    // 6. Активация: сохраняем пользователя и удаляем ключ
    await kv.set(`user_id:${tgIdStr}`, {
      activatedKey: key.trim(),
      date: new Date().toISOString(),
    });
    await kv.srem('valid_keys', key.trim());

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Auth Error:', error);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
}