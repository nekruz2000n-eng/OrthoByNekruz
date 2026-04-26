import type { NextApiRequest, NextApiResponse } from 'next';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_USERNAME = process.env.CHANNEL_USERNAME || 'nzsdental';
const TRIAL_DAYS = Number(process.env.TRIAL_DAYS) || 0;

// Проверка подписки на канал (как раньше)
async function isSubscribed(userId: number): Promise<boolean> {
  if (!BOT_TOKEN) return false;
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
    return res.status(405).json({ error: 'Метод не разрешен' });
  }

  const { key, telegramId, mode } = req.body; // добавили поле mode
  if (!telegramId) {
    return res.status(400).json({ error: 'Telegram ID не найден' });
  }

  const tgIdStr = String(telegramId);

  try {
    // ----- РЕЖИМ ПРОВЕРКИ ДЕМО-ДОСТУПА (новый) -----
    if (mode === 'check_demo') {
      const alreadyUsed = await redis.sismember('used_demo_ids', tgIdStr);
      if (alreadyUsed) {
        return res.status(403).json({
          success: false,
          message: 'Вы уже использовали пробный период. Приобретите ключ для продолжения.'
        });
      }
      await redis.sadd('used_demo_ids', tgIdStr);
      return res.status(200).json({ success: true });
    }

    // ----- ОБЫЧНАЯ АВТОРИЗАЦИЯ (твой текущий код) -----
    // 1. Проверяем подписку на канал
    const subscribed = await isSubscribed(Number(telegramId));
    if (!subscribed) {
      return res.status(403).json({
        error: `Для доступа необходимо подписаться на канал https://t.me/${CHANNEL_USERNAME}`,
        needSubscription: true,
      });
    }

    // 2. Ищем существующего пользователя
    const existingUser: any = await redis.get(`user_id:${tgIdStr}`);

    if (existingUser && !existingUser.trial_until) {
      return res.status(200).json({ success: true });
    }

    // 3. Обработка триал-периода (если TRIAL_DAYS > 0)
    if (TRIAL_DAYS > 0) {
      const now = new Date();
      if (!existingUser && !key) {
        const trialUntil = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
        await redis.set(`user_id:${tgIdStr}`, {
          activatedKey: 'trial',
          date: now.toISOString(),
          trial_until: trialUntil.toISOString(),
        });
        return res.status(200).json({ success: true, trial: true, trialUntil });
      }
      if (existingUser?.trial_until) {
        const trialEnd = new Date(existingUser.trial_until);
        if (now < trialEnd) {
          return res.status(200).json({ success: true, trial: true, trialUntil: trialEnd });
        }
        if (!key) {
          return res.status(401).json({ error: 'Пробный период закончился. Приобретите ключ для продолжения.' });
        }
      }
    }

    // 4. Обычная активация по ключу
    if (!key) {
      return res.status(401).json({ error: 'Введите ключ активации' });
    }

    const isKeyValid = await redis.sismember('valid_keys', key);
    if (!isKeyValid) {
      return res.status(401).json({ error: 'Неверный или уже использованный ключ' });
    }

    await redis.set(`user_id:${tgIdStr}`, {
      activatedKey: key,
      date: new Date().toISOString(),
    });
    await redis.srem('valid_keys', key);

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Auth Error:', error);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
}