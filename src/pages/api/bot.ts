import { NextApiRequest, NextApiResponse } from 'next';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_USERNAME = 'nzsdental'; // без @

// Проверка подписки через Telegram API (без библиотек)
async function isSubscribed(userId: number): Promise<boolean> {
  if (!BOT_TOKEN) return false; // если токена нет, пропускаем проверку (но лучше его добавить)
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=@${CHANNEL_USERNAME}&user_id=${userId}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.ok) return false;
    const status = data.result.status;
    return ['member', 'administrator', 'creator'].includes(status);
  } catch {
    return false;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { key, telegramId } = req.body;
  if (!key || !telegramId) {
    return res.status(400).json({ error: 'Key and Telegram ID required' });
  }

  // 1. Проверяем ключ
  const keyExists = await redis.sismember('valid_keys', key);
  if (!keyExists) {
    return res.status(401).json({ error: 'Неверный или уже использованный ключ' });
  }

  // 2. Проверяем подписку
  const subscribed = await isSubscribed(Number(telegramId));
  if (!subscribed) {
    return res.status(403).json({ 
      error: `Ты не подписан на канал. Подпишись: https://t.me/${CHANNEL_USERNAME} и повтори ввод ключа.`,
      needSubscription: true
    });
  }

  // 3. Всё ок — удаляем ключ
  await redis.srem('valid_keys', key);

  return res.status(200).json({ success: true });
}