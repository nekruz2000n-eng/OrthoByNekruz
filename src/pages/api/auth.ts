import { NextApiRequest, NextApiResponse } from 'next';
import { kv } from '@vercel/kv';

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = '-1003929499461';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { key, telegramId } = req.body;

  if (!key || !telegramId) {
    return res.status(400).json({ error: 'Ключ и Telegram ID обязательны' });
  }

  try {
    // 1. Проверяем, существует ли ключ в Redis
    const isValidKey = await kv.sismember('valid_keys', key);
    
    // Проверяем, не привязан ли этот ключ уже к ЭТОМУ пользователю (повторный вход)
    const existingLink = await kv.get(`link:${key}`);
    
    if (!isValidKey && existingLink !== telegramId) {
      return res.status(401).json({ error: 'Неверный или уже использованный ключ' });
    }

    // 2. Проверяем подписку студента через прямой запрос к Telegram API
    const tgResponse = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=${CHANNEL_ID}&user_id=${telegramId}`
    );
    
    const tgData = await tgResponse.json();

    if (!tgData.ok) {
      return res.status(500).json({ error: 'Ошибка проверки Telegram. Проверьте ваш ID.' });
    }

    const status = tgData.result.status;
    const isSubscribed = ['creator', 'administrator', 'member'].includes(status);

    if (!isSubscribed) {
      return res.status(403).json({ 
        error: 'Для активации нужно подписаться на канал!',
        link: 'https://t.me/+oUvG_y-W6U4zMjVi' // Твоя ссылка на канал
      });
    }

    // 3. Если всё ок — фиксируем активацию
    if (isValidKey) {
      await kv.srem('valid_keys', key); // Удаляем из списка свободных
      await kv.set(`link:${key}`, telegramId); // Привязываем к ID
      await kv.hset('user_registry', { [telegramId]: key }); // Добавляем в общий реестр
    }

    return res.status(200).json({ success: true, message: 'Доступ разрешен!' });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
}