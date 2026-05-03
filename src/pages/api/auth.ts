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
//  Проверяет, что initData пришла от настоящего Telegram.
// ═══════════════════════════════════════════════════════════════════════════
function verifyTelegramInitData(
  initData: string,
  botToken: string
): { id: number; username?: string; first_name?: string; last_name?: string; [key: string]: any } | null {
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

// ── Валидация Telegram ID ──
const isValidTelegramId = (id: string): boolean => {
  if (!/^\d{5,12}$/.test(id)) return false;
  const n = Number(id);
  return n >= 10000 && n <= 9_999_999_999;
};

// ── Валидация формата ключа ──
const isValidKeyFormat = (key: string): boolean => {
  const k = key.trim();
  if (!/^\d{8}$/.test(k)) return false;
  const d = k.split('').map(Number);
  const sumCheck = d[0] + d[1] + d[7] === 15;
  const modCheck = parseInt(k, 10) % 7 === 3;
  return sumCheck && modCheck;
};

// ── Проверка подписки ──
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

// ── Rate Limiting ──
const MAX_ATTEMPTS      = 3;
const BASE_BLOCK_SEC    = 2  * 60 * 60;
const EXTRA_BLOCK_SEC   = 10 * 60 * 60;

async function checkRateLimit(ip: string, tgId: string) {
  const rateKey  = `rate:${ip}:${tgId}`;
  const blockKey = `block:${ip}:${tgId}`;
  const violKey  = `viol:${ip}:${tgId}`;

  const blocked = await redis.exists(blockKey);
  if (blocked) {
    const viols = await redis.incr(violKey);
    const newBlock = BASE_BLOCK_SEC + (viols - 1) * EXTRA_BLOCK_SEC;
    await redis.set(blockKey, viols, { ex: newBlock });
    return { blocked: true };
  }

  const attempts = await redis.incr(rateKey);
  if (attempts === 1) await redis.expire(rateKey, 3600);

  if (attempts >= MAX_ATTEMPTS) {
    const viols = await redis.incr(violKey);
    await redis.expire(violKey, 30 * 24 * 3600);
    const blockSec = BASE_BLOCK_SEC + (viols - 1) * EXTRA_BLOCK_SEC;
    await redis.set(blockKey, viols, { ex: blockSec });
    await redis.del(rateKey);
    return { blocked: true };
  }
  return { blocked: false };
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
//  MAIN HANDLER
// ════════════════════════════════════════════════════════════════════════════
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { key, telegramId, mode, initData } = req.body;

  // СТРОГАЯ ЗАЩИТА: Без initData работа невозможна
  if (!initData) {
    return res.status(403).json({ error: 'Доступ разрешен только через Telegram.' });
  }

  const tgIdStr = String(telegramId || '').trim();
  if (!isValidTelegramId(tgIdStr)) {
    return res.status(400).json({ error: 'Некорректный Telegram ID.' });
  }

  // ВЕРИФИКАЦИЯ ДАННЫХ TELEGRAM
  let username: string | null = null;
  let firstName: string | null = null;
  let lastName: string | null = null;

  const tgUser = verifyTelegramInitData(initData, BOT_TOKEN || '');
  if (!tgUser || String(tgUser.id) !== tgIdStr) {
    return res.status(401).json({ error: 'Ошибка верификации данных.' });
  }

  username = tgUser.username || null;
  firstName = tgUser.first_name || null;
  lastName = tgUser.last_name || null;

  const ip = getIp(req);

  try {
    // ── ДЕМО-РЕЖИМ ──
    if (mode === 'check_demo') {
      const { blocked } = await checkRateLimit(ip, `demo_${tgIdStr}`);
      if (blocked) return res.status(429).json({ error: 'Слишком много попыток.' });

      const alreadyUsed = await redis.sismember('used_demo_ids', tgIdStr);
      if (alreadyUsed) return res.status(403).json({ error: 'Демо-период уже использован.' });

      await redis.sadd('used_demo_ids', tgIdStr);
      await resetRateLimit(ip, `demo_${tgIdStr}`);
      return res.status(200).json({ success: true });
    }

    // ── ПРОВЕРКА МИКРОБИОЛОГИИ ──
    if (mode === 'check_micro') {
      const user: any = await redis.get(`user_id:${tgIdStr}`);
      return res.status(200).json({ hasMicro: !!(user && user.micro === true) });
    }

    // ── ОБЩАЯ АВТОРИЗАЦИЯ ──
    if (key) {
      const { blocked } = await checkRateLimit(ip, tgIdStr);
      if (blocked) return res.status(429).json({ error: 'Доступ временно заблокирован.' });
    }

    let user: any = await redis.get(`user_id:${tgIdStr}`);
    if (typeof user === 'string') {
      try { user = JSON.parse(user); } catch { user = null; }
    }

    if (user?.blocked === true) {
      return res.status(403).json({ error: 'Твой аккаунт заблокирован. Сяжись с администратором.', blocked: true });
    }

    const subscribed = await isSubscribed(Number(tgIdStr));
    if (!subscribed) {
      return res.status(403).json({
        error: `Подпишитесь на @${CHANNEL_USERNAME} для доступа.`,
        needSubscription: true,
      });
    }

    // Существующий пользователь: вход + обновление профиля
    if (user && !user.trial_until) {
      if (username !== user.username || firstName !== user.firstName || lastName !== user.lastName) {
        await redis.set(`user_id:${tgIdStr}`, { ...user, username, firstName, lastName });
      }
      await resetRateLimit(ip, tgIdStr);
      return res.status(200).json({ success: true, hasMicro: !!user.micro });
    }

    // Триал-период
    if (TRIAL_DAYS > 0) {
      const now = new Date();
      if (!user && !key) {
        const trialUntil = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
        const newUser = { activatedKey: 'trial', date: now.toISOString(), trial_until: trialUntil.toISOString(), username, firstName, lastName };
        await redis.set(`user_id:${tgIdStr}`, newUser);
        return res.status(200).json({ success: true, trial: true, trialUntil, hasMicro: false });
      }
      if (user?.trial_until) {
        const trialEnd = new Date(user.trial_until);
        if (now < trialEnd) {
          if (username !== user.username) await redis.set(`user_id:${tgIdStr}`, { ...user, username, firstName, lastName });
          return res.status(200).json({ success: true, trial: true, trialUntil: trialEnd, hasMicro: !!user.micro });
        }
        if (!key) return res.status(401).json({ error: 'Пробный период истёк. Введите ключ.' });
      }
    }

    // Активация ключа
    if (!key) return res.status(401).json({ error: 'Введите ключ активации.' });
    if (!isValidKeyFormat(key)) return res.status(401).json({ error: 'Неверный формат ключа.' });

    const isKeyValid = await redis.sismember('valid_keys', key.trim());
    if (!isKeyValid) return res.status(401).json({ error: 'Неверный ключ.' });

    const activatedUser = { 
      activatedKey: key.trim(), 
      date: new Date().toISOString(), 
      username, firstName, lastName,
      micro: user?.micro || false 
    };
    
    await redis.set(`user_id:${tgIdStr}`, activatedUser);
    await redis.srem('valid_keys', key.trim());
    await resetRateLimit(ip, tgIdStr);

    return res.status(200).json({ success: true, hasMicro: !!user?.micro });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Ошибка сервера.' });
  }
}