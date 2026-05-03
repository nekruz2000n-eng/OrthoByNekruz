import type { NextApiRequest, NextApiResponse } from 'next';
import { Redis } from '@upstash/redis';
import { createHmac } from 'crypto';

const redis = Redis.fromEnv();

const BOT_TOKEN        = process.env.BOT_TOKEN;
const CHANNEL_USERNAME = process.env.CHANNEL_USERNAME || 'nzsdental';
const TRIAL_DAYS       = Number(process.env.TRIAL_DAYS) || 0;

// ═══════════════════════════════════════════════════════════════════════════
//  verifyTelegramInitData
//
//  Проверяет что initData пришла от настоящего Telegram, а не подделана.
//  Возвращает объект пользователя если подпись верна, null если нет.
// ═══════════════════════════════════════════════════════════════════════════
function verifyTelegramInitData(
  initData: string,
  botToken: string
): { id: number; username?: string; [key: string]: any } | null {
  try {
    const params = new URLSearchParams(initData);
    const hash   = params.get('hash');
    if (!hash) return null;

    params.delete('hash');
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    const secretKey = createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    const expectedHash = createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (expectedHash !== hash) return null;

    const authDate = Number(params.get('auth_date') || '0');
    const now      = Math.floor(Date.now() / 1000);
    if (now - authDate > 86400) return null;

    const userStr = params.get('user');
    if (!userStr) return null;
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

// ── Telegram IDs ─────────────────────────────────────────────────────────────
const isValidTelegramId = (id: string): boolean => {
  if (!/^\d{5,12}$/.test(id)) return false;
  const n = Number(id);
  return n >= 10000 && n <= 9_999_999_999;
};

// ── Ключ: формат + математические условия ───────────────────────────────────
const isValidKeyFormat = (key: string): boolean => {
  const k = key.trim();
  if (!/^\d{8}$/.test(k)) return false;
  const d = k.split('').map(Number);
  const sumCheck = d[0] + d[1] + d[7] === 15;
  const modCheck = parseInt(k, 10) % 7 === 3;
  return sumCheck && modCheck;
};

// ── Подписка на канал ────────────────────────────────────────────────────────
async function isSubscribed(userId: number): Promise<boolean> {
  if (!BOT_TOKEN) return false;
  try {
    const url  = `https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=@${CHANNEL_USERNAME}&user_id=${userId}`;
    const res  = await fetch(url);
    const data = await res.json();
    if (!data.ok) return false;
    return ['member', 'administrator', 'creator'].includes(data.result.status);
  } catch {
    return false;
  }
}

// ── Rate limiting ────────────────────────────────────────────────────────────
const MAX_ATTEMPTS      = 3;
const BASE_BLOCK_SEC    = 2  * 60 * 60;   // 2 часа
const EXTRA_BLOCK_SEC   = 10 * 60 * 60;   // +10 часов

async function checkRateLimit(ip: string, tgId: string) {
  const rateKey  = `rate:${ip}:${tgId}`;
  const blockKey = `block:${ip}:${tgId}`;
  const violKey  = `viol:${ip}:${tgId}`;

  const blocked = await redis.exists(blockKey);
  if (blocked) {
    const viols = await redis.incr(violKey);
    const newBlock = BASE_BLOCK_SEC + (viols - 1) * EXTRA_BLOCK_SEC;
    await redis.set(blockKey, viols, { ex: newBlock });
    const hours = Math.ceil(newBlock / 3600);
    return { blocked: true, remaining: 0, blockHours: hours };
  }

  const attempts = await redis.incr(rateKey);
  if (attempts === 1) await redis.expire(rateKey, 3600);

  if (attempts >= MAX_ATTEMPTS) {
    const viols = await redis.incr(violKey);
    await redis.expire(violKey, 30 * 24 * 3600);
    const blockSec = BASE_BLOCK_SEC + (viols - 1) * EXTRA_BLOCK_SEC;
    await redis.set(blockKey, viols, { ex: blockSec });
    await redis.del(rateKey);
    const hours = Math.ceil(blockSec / 3600);
    return { blocked: true, remaining: 0, blockHours: hours };
  }

  return { blocked: false, remaining: MAX_ATTEMPTS - attempts };
}

async function resetRateLimit(ip: string, tgId: string) {
  await redis.del(`rate:${ip}:${tgId}`);
  await redis.del(`block:${ip}:${tgId}`);
}

function getIp(req: NextApiRequest): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string') return fwd.split(',')[0].trim();
  return req.socket?.remoteAddress ?? 'unknown';
}

// ════════════════════════════════════════════════════════════════════════════
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Метод не разрешен' });
  }

  const { key, telegramId, mode, initData } = req.body;

  if (!telegramId) {
    return res.status(400).json({ error: 'Telegram ID не найден' });
  }

  const tgIdStr = String(telegramId).trim();
  if (!isValidTelegramId(tgIdStr)) {
    return res.status(400).json({ error: 'Неверный запрос' });
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  ВЕРИФИКАЦИЯ initData
  // ══════════════════════════════════════════════════════════════════════════
  let initDataVerified = false;
  let username: string | null = null; 

  if (initData && BOT_TOKEN) {
    const tgUser = verifyTelegramInitData(initData, BOT_TOKEN);

    if (!tgUser || String(tgUser.id) !== tgIdStr) {
      return res.status(401).json({ error: 'Неверный запрос' });
    }

    initDataVerified = true;
    username = tgUser.username || null; 
  }

  const ip = getIp(req);
  const rateLimitKey = initDataVerified ? tgIdStr : `manual:${ip}`;

  try {
    // ── ДЕМО-РЕЖИМ ────────────────────────────────────────────────────────
    if (mode === 'check_demo') {
      if (!initDataVerified) {
        return res.status(401).json({
          success: false,
          message: 'Не удалось подтвердить личность. Откройте приложение через Telegram.',
        });
      }

      const { blocked } = await checkRateLimit(ip, `demo_${tgIdStr}`);
      if (blocked) {
        return res.status(429).json({ success: false, message: 'Слишком много попыток. Попробуйте позже.' });
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

    // ── ПРОВЕРКА ДОСТУПА К МИКРОБИОЛОГИИ ────────────────────────────────────
    if (mode === 'check_micro') {
      if (!initDataVerified) {
        return res.status(200).json({ hasMicro: false });
      }
      const user: any = await redis.get(`user_id:${tgIdStr}`);
      const hasMicro = !!(user && user.micro === true);
      return res.status(200).json({ hasMicro });
    }

    // ── ОБЫЧНАЯ АВТОРИЗАЦИЯ И АКТИВАЦИЯ КЛЮЧА ─────────────────────────────
    
    // Защита от спама (Rate Limit) ПЕРЕД тяжелыми проверками
    if (key || !initDataVerified) {
        const { blocked } = await checkRateLimit(ip, rateLimitKey);
        if (blocked) {
            return res.status(429).json({ error: 'Слишком много попыток. Доступ временно заблокирован.' });
        }
    }

    // Безопасное чтение пользователя
    let existingUser: any = await redis.get(`user_id:${tgIdStr}`);
    if (typeof existingUser === 'string') {
        try { existingUser = JSON.parse(existingUser); } catch { existingUser = null; }
    }

    // Проверка блокировки
    if (existingUser?.blocked === true) {
      return res.status(403).json({
        error: 'Ваш аккаунт заблокирован. Свяжитесь с администратором.',
        blocked: true,
      });
    }

    // Дергаем Telegram API
    const subscribed = await isSubscribed(Number(tgIdStr));
    if (!subscribed) {
      return res.status(403).json({
        error: `Для доступа необходимо подписаться на канал https://t.me/${CHANNEL_USERNAME}`,
        needSubscription: true,
      });
    }

    // Существующий пользователь (не триал)
    if (existingUser && !existingUser.trial_until) {
      if (!initDataVerified) {
        return res.status(401).json({ error: 'Откройте приложение через Telegram для входа.' });
      }
      
      if (username && existingUser.username !== username) {
         await redis.set(`user_id:${tgIdStr}`, { ...existingUser, username });
      }

      await resetRateLimit(ip, tgIdStr);
      const hasMicro = !!(existingUser?.micro === true);
      return res.status(200).json({ success: true, hasMicro });
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
          username: username
        });
        return res.status(200).json({ success: true, trial: true, trialUntil, hasMicro: false });
      }
      if (existingUser?.trial_until) {
        const trialEnd = new Date(existingUser.trial_until);
        if (now < trialEnd) {
           if (username && existingUser.username !== username) {
             await redis.set(`user_id:${tgIdStr}`, { ...existingUser, username });
           }
           const hasMicro = !!(existingUser?.micro === true);
           return res.status(200).json({ success: true, trial: true, trialUntil: trialEnd, hasMicro });
        }
        if (!key) return res.status(401).json({ error: 'Пробный период закончился. Приобретите ключ.' });
      }
    }

    // ── АКТИВАЦИЯ КЛЮЧА ──────────────────────────────────────────────────
    if (!key) return res.status(401).json({ error: 'Введите ключ активации' });
    if (!isValidKeyFormat(key)) return res.status(401).json({ error: 'Неверный формат ключа' });

    const isKeyValid = await redis.sismember('valid_keys', key.trim());
    if (!isKeyValid) {
      return res.status(401).json({ error: 'Неверный или уже использованный ключ' });
    }

    // Активация ключа: сохраняем пользователя
    await redis.set(`user_id:${tgIdStr}`, { 
      activatedKey: key.trim(), 
      date: new Date().toISOString(),
      username: username || existingUser?.username,
      micro: existingUser?.micro || false 
    });
    
    await redis.srem('valid_keys', key.trim());
    await resetRateLimit(ip, rateLimitKey);

    return res.status(200).json({ success: true, hasMicro: !!(existingUser?.micro) });

  } catch (error: any) {
    console.error('Auth Error:', error);
    const msg = process.env.NODE_ENV === 'development'
      ? (error?.message || String(error))
      : 'Ошибка сервера';
    return res.status(500).json({ error: msg });
  }
}