import type { NextApiRequest, NextApiResponse } from 'next';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

const BOT_TOKEN        = process.env.BOT_TOKEN;
const CHANNEL_USERNAME = process.env.CHANNEL_USERNAME || 'nzsdental';
const TRIAL_DAYS       = Number(process.env.TRIAL_DAYS) || 0;

// ── Telegram IDs: реальные ID от ~100000 до ~9999999999 ─────────────────────
const isValidTelegramId = (id: string): boolean => {
  if (!/^\d{5,12}$/.test(id)) return false;
  const n = Number(id);
  return n >= 10000 && n <= 9_999_999_999;
};

// ── Ключ: только цифры, 4-8 символов ────────────────────────────────────────
const isValidKeyFormat = (key: string): boolean =>
  typeof key === 'string' && /^\d{4,8}$/.test(key.trim());

// ── Подписка на канал ────────────────────────────────────────────────────────
async function isSubscribed(userId: number): Promise<boolean> {
  if (!BOT_TOKEN) return false;
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=@${CHANNEL_USERNAME}&user_id=${userId}`;
    const res  = await fetch(url);
    const data = await res.json();
    if (!data.ok) return false;
    return ['member', 'administrator', 'creator'].includes(data.result.status);
  } catch {
    return false;
  }
}

// ── Server-side rate limiting ────────────────────────────────────────────────
// Считаем неудачные попытки в Redis по ключу ip:telegramId.
// После MAX_ATTEMPTS блокируем на BLOCK_SECONDS секунд.
const MAX_ATTEMPTS   = 5;
const BLOCK_SECONDS  = 300; // 5 минут

async function checkRateLimit(
  ip: string,
  tgId: string
): Promise<{ blocked: boolean; remaining: number }> {
  const rateKey = `rate:${ip}:${tgId}`;
  const blockKey = `block:${ip}:${tgId}`;

  // Уже заблокирован?
  const blocked = await redis.exists(blockKey);
  if (blocked) return { blocked: true, remaining: 0 };

  const attempts = await redis.incr(rateKey);
  if (attempts === 1) {
    // Первая попытка — ставим TTL 10 минут
    await redis.expire(rateKey, 600);
  }
  if (attempts >= MAX_ATTEMPTS) {
    // Блокируем и сбрасываем счётчик
    await redis.set(blockKey, 1, { ex: BLOCK_SECONDS });
    await redis.del(rateKey);
    return { blocked: true, remaining: 0 };
  }
  return { blocked: false, remaining: MAX_ATTEMPTS - attempts };
}

async function resetRateLimit(ip: string, tgId: string) {
  await redis.del(`rate:${ip}:${tgId}`);
  await redis.del(`block:${ip}:${tgId}`);
}

// ── Вспомогательная функция: получить IP ────────────────────────────────────
function getIp(req: NextApiRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress ?? 'unknown';
}

// ════════════════════════════════════════════════════════════════════════════
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Метод не разрешен' });
  }

  const { key, telegramId, mode } = req.body;

  // ── 1. Обязательная валидация telegramId ─────────────────────────────────
  if (!telegramId) {
    return res.status(400).json({ error: 'Telegram ID не найден' });
  }
  const tgIdStr = String(telegramId).trim();
  if (!isValidTelegramId(tgIdStr)) {
    // Не раскрываем детали — просто отказываем
    return res.status(400).json({ error: 'Неверный запрос' });
  }

  const ip = getIp(req);

  try {
    // ── 2. ДЕМО-РЕЖИМ ───────────────────────────────────────────────────────
    if (mode === 'check_demo') {
      // Rate limit для демо-запросов
      const { blocked } = await checkRateLimit(ip, `demo_${tgIdStr}`);
      if (blocked) {
        return res.status(429).json({
          success: false,
          message: 'Слишком много попыток. Попробуйте позже.',
        });
      }

      const alreadyUsed = await redis.sismember('used_demo_ids', tgIdStr);
      if (alreadyUsed) {
        return res.status(403).json({
          success: false,
          message: 'Вы уже использовали пробный период. Приобретите ключ для продолжения.',
        });
      }
      await redis.sadd('used_demo_ids', tgIdStr);
      await resetRateLimit(ip, `demo_${tgIdStr}`);
      return res.status(200).json({ success: true });
    }

    // ── 3. ОБЫЧНАЯ АВТОРИЗАЦИЯ ──────────────────────────────────────────────

    // Подписка на канал
    const subscribed = await isSubscribed(Number(tgIdStr));
    if (!subscribed) {
      return res.status(403).json({
        error: `Для доступа необходимо подписаться на канал https://t.me/${CHANNEL_USERNAME}`,
        needSubscription: true,
      });
    }

    // Существующий пользователь
    const existingUser: any = await redis.get(`user_id:${tgIdStr}`);
    if (existingUser && !existingUser.trial_until) {
      await resetRateLimit(ip, tgIdStr);
      return res.status(200).json({ success: true });
    }

    // Триал-период
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

    // ── 4. АКТИВАЦИЯ КЛЮЧА ──────────────────────────────────────────────────
    if (!key) {
      return res.status(401).json({ error: 'Введите ключ активации' });
    }

    // Валидация формата ключа ДО обращения к Redis
    if (!isValidKeyFormat(key)) {
      return res.status(401).json({ error: 'Неверный формат ключа' });
    }

    // Rate limiting для попыток ввода ключа
    const { blocked, remaining } = await checkRateLimit(ip, tgIdStr);
    if (blocked) {
      return res.status(429).json({
        error: `Слишком много неверных попыток. Подождите ${BLOCK_SECONDS / 60} мин.`,
      });
    }

    const isKeyValid = await redis.sismember('valid_keys', key.trim());
    if (!isKeyValid) {
      // Неверный ключ — счётчик уже увеличен в checkRateLimit
      return res.status(401).json({
        error: `Неверный или уже использованный ключ${remaining > 0 ? ` (осталось попыток: ${remaining})` : ''}`,
      });
    }

    // Ключ верный — активируем и сбрасываем rate limit
    await redis.set(`user_id:${tgIdStr}`, {
      activatedKey: key.trim(),
      date: new Date().toISOString(),
    });
    await redis.srem('valid_keys', key.trim());
    await resetRateLimit(ip, tgIdStr);

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('Auth Error:', error);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
}
