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
//  Алгоритм официальный — из документации Telegram Mini Apps:
//  https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
//
//  Возвращает объект пользователя если подпись верна, null если нет.
// ═══════════════════════════════════════════════════════════════════════════
function verifyTelegramInitData(
  initData: string,
  botToken: string
): { id: number; [key: string]: any } | null {
  try {
    const params = new URLSearchParams(initData);
    const hash   = params.get('hash');
    if (!hash) return null;

    // Собираем строку для проверки: все поля кроме hash, отсортированные по алфавиту
    params.delete('hash');
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    // Секретный ключ = HMAC-SHA256("WebAppData", botToken)
    const secretKey = createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    // Подпись = HMAC-SHA256(secretKey, dataCheckString)
    const expectedHash = createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (expectedHash !== hash) return null;

    // Проверяем срок действия — initData действительна 24 часа
    const authDate = Number(params.get('auth_date') || '0');
    const now      = Math.floor(Date.now() / 1000);
    if (now - authDate > 86400) return null; // старше 24 часов

    // Парсим данные пользователя
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

// ── Ключ: только цифры, 4-8 символов ────────────────────────────────────────
const isValidKeyFormat = (key: string): boolean =>
  typeof key === 'string' && /^\d{4,8}$/.test(key.trim());

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
const MAX_ATTEMPTS  = 5;
const BLOCK_SECONDS = 300;

async function checkRateLimit(ip: string, tgId: string) {
  const rateKey  = `rate:${ip}:${tgId}`;
  const blockKey = `block:${ip}:${tgId}`;
  const blocked  = await redis.exists(blockKey);
  if (blocked) return { blocked: true, remaining: 0 };
  const attempts = await redis.incr(rateKey);
  if (attempts === 1) await redis.expire(rateKey, 600);
  if (attempts >= MAX_ATTEMPTS) {
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
  //
  //  Если initData передана — проверяем HMAC подпись Telegram.
  //  Если подпись верна — telegramId должен совпадать с ID в initData.
  //  Это исключает подделку чужого ID.
  //
  //  Если initData НЕ передана (например ручной ввод ID когда auto-detection
  //  не сработал) — применяем повышенный rate limit вместо полного отказа.
  //  Полный отказ сломал бы легитимных пользователей на десктопе/старых TG.
  // ══════════════════════════════════════════════════════════════════════════
  let initDataVerified = false;

  if (initData && BOT_TOKEN) {
    const tgUser = verifyTelegramInitData(initData, BOT_TOKEN);

    if (!tgUser) {
      // Подпись неверна — явная подделка
      return res.status(401).json({ error: 'Неверный запрос' });
    }

    if (String(tgUser.id) !== tgIdStr) {
      // ID в initData не совпадает с переданным telegramId — попытка чужого
      return res.status(401).json({ error: 'Неверный запрос' });
    }

    initDataVerified = true;
  }

  const ip = getIp(req);

  // Если initData не прошла верификацию (ручной ввод) — жёсткий rate limit
  const rateLimitKey = initDataVerified ? tgIdStr : `manual:${ip}`;

  try {
    // ── ДЕМО-РЕЖИМ ────────────────────────────────────────────────────────
    if (mode === 'check_demo') {
      // Без верифицированного initData — демо недоступен
      // (иначе любой введёт рандомный ID и получит демо)
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

    // ── ОБЫЧНАЯ АВТОРИЗАЦИЯ ──────────────────────────────────────────────
    const subscribed = await isSubscribed(Number(tgIdStr));
    if (!subscribed) {
      return res.status(403).json({
        error: `Для доступа необходимо подписаться на канал https://t.me/${CHANNEL_USERNAME}`,
        needSubscription: true,
      });
    }

    const existingUser: any = await redis.get(`user_id:${tgIdStr}`);

    // Существующий пользователь — пускаем только если initData верифицирована
    if (existingUser && !existingUser.trial_until) {
      if (!initDataVerified) {
        // Без верификации не пускаем даже существующих — защита от кражи ID
        return res.status(401).json({
          error: 'Откройте приложение через Telegram для входа.',
        });
      }
      await resetRateLimit(ip, tgIdStr);
      return res.status(200).json({ success: true });
    }

    // Триал-период
    if (TRIAL_DAYS > 0) {
      const now = new Date();
      if (!existingUser && !key) {
        const trialUntil = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
        await redis.set(`user_id:${tgIdStr}`, {
          activatedKey: 'trial', date: now.toISOString(), trial_until: trialUntil.toISOString(),
        });
        return res.status(200).json({ success: true, trial: true, trialUntil });
      }
      if (existingUser?.trial_until) {
        const trialEnd = new Date(existingUser.trial_until);
        if (now < trialEnd) return res.status(200).json({ success: true, trial: true, trialUntil: trialEnd });
        if (!key) return res.status(401).json({ error: 'Пробный период закончился. Приобретите ключ.' });
      }
    }

    // ── АКТИВАЦИЯ КЛЮЧА ──────────────────────────────────────────────────
    if (!key) return res.status(401).json({ error: 'Введите ключ активации' });
    if (!isValidKeyFormat(key)) return res.status(401).json({ error: 'Неверный формат ключа' });

    const { blocked, remaining } = await checkRateLimit(ip, rateLimitKey);
    if (blocked) {
      return res.status(429).json({ error: `Слишком много попыток. Подождите ${BLOCK_SECONDS / 60} мин.` });
    }

    const isKeyValid = await redis.sismember('valid_keys', key.trim());
    if (!isKeyValid) {
      return res.status(401).json({
        error: `Неверный или уже использованный ключ${remaining > 0 ? ` (осталось попыток: ${remaining})` : ''}`,
      });
    }

    await redis.set(`user_id:${tgIdStr}`, { activatedKey: key.trim(), date: new Date().toISOString() });
    await redis.srem('valid_keys', key.trim());
    await resetRateLimit(ip, rateLimitKey);

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('Auth Error:', error);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
}
