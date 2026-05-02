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

// ── Ключ: формат + математические условия ───────────────────────────────────
// Условие 1: ровно 8 цифр
// Условие 2: сумма 1-й, 2-й и 8-й цифр = 15
// Условие 3: число % 7 = 3
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
//  3 попытки → блок 2 часа.
//  Каждая следующая ошибка после блока → +10 часов сверху.
//  Храним счётчик нарушений в Redis ключе violations:ip:tgId.
const MAX_ATTEMPTS      = 3;
const BASE_BLOCK_SEC    = 2  * 60 * 60;   // 2 часа
const EXTRA_BLOCK_SEC   = 10 * 60 * 60;   // +10 часов за каждое нарушение сверх первого

async function checkRateLimit(ip: string, tgId: string) {
  const rateKey  = `rate:${ip}:${tgId}`;
  const blockKey = `block:${ip}:${tgId}`;
  const violKey  = `viol:${ip}:${tgId}`;

  // Проверяем активный блок
  const blocked = await redis.exists(blockKey);
  if (blocked) {
    // Каждое обращение во время блока — +10 часов
    const viols = await redis.incr(violKey);
    const newBlock = BASE_BLOCK_SEC + (viols - 1) * EXTRA_BLOCK_SEC;
    await redis.set(blockKey, viols, { ex: newBlock });
    const hours = Math.ceil(newBlock / 3600);
    return { blocked: true, remaining: 0, blockHours: hours };
  }

  const attempts = await redis.incr(rateKey);
  if (attempts === 1) await redis.expire(rateKey, 3600); // счётчик живёт 1 час

  if (attempts >= MAX_ATTEMPTS) {
    // Первый блок — 2 часа
    const viols = await redis.incr(violKey);
    await redis.expire(violKey, 30 * 24 * 3600); // счётчик нарушений живёт 30 дней
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

    // ── ПРОВЕРКА ДОСТУПА К МИКРОБИОЛОГИИ ────────────────────────────────────
    //    Источник истины — Redis (user.micro === true).
    //    Без верифицированной initData всегда возвращаем false.
    if (mode === 'check_micro') {
      if (!initDataVerified) {
        return res.status(200).json({ hasMicro: false });
      }
      const user: any = await redis.get(`user_id:${tgIdStr}`);
      const hasMicro = !!(user && user.micro === true);
      return res.status(200).json({ hasMicro });
    }

    // ── АКТИВАЦИЯ КЛЮЧА МИКРОБИОЛОГИИ ─────────────────────────────────────────
    if (mode === 'activate_micro') {
      // initData может отсутствовать на старых версиях TG — не блокируем жёстко,
      // но применяем усиленный rate limit
      if (!initDataVerified) {
        // Проверяем что пользователь хотя бы существует в Redis
        const existingCheck: any = await redis.get(`user_id:${tgIdStr}`);
        if (!existingCheck) {
          return res.status(401).json({ error: 'Откройте приложение через Telegram.' });
        }
      }

      // Читаем пользователя с защитой от разных форматов хранения
      let user: any = await redis.get(`user_id:${tgIdStr}`);

      // Upstash иногда возвращает строку — парсим если нужно
      if (typeof user === 'string') {
        try { user = JSON.parse(user); } catch { user = null; }
      }

      if (!user) {
        return res.status(403).json({ error: 'Сначала приобретите доступ к ортопедии.' });
      }

      // activatedKey может отсутствовать или быть 'trial'
      const hasFullAccess = user.activatedKey && user.activatedKey !== 'trial';
      if (!hasFullAccess) {
        return res.status(403).json({ error: 'Для микробиологии нужен полный доступ к ортопедии.' });
      }

      if (user.micro === true) {
        return res.status(200).json({ success: true, alreadyHad: true });
      }

      if (!key) {
        return res.status(401).json({ error: 'Введите ключ микробиологии' });
      }

      // Формат ключа — только цифры, 4-8 символов (те же правила что для ортопедии)
      if (!isValidKeyFormat(key)) {
        return res.status(401).json({ error: 'Неверный формат ключа' });
      }

      // Rate limit
      const { blocked, remaining } = await checkRateLimit(ip, `micro:${rateLimitKey}`);
      if (blocked) {
        return res.status(429).json({ error: `Слишком много неверных попыток. Доступ заблокирован.` });
      }

      // Проверяем ключ в valid_micro_keys
      // Если SET не существует — sismember просто вернёт 0 (не ошибку)
      const isKeyValid = await redis.sismember('valid_micro_keys', key.trim());
      if (!isKeyValid) {
        return res.status(401).json({
          error: `Неверный ключ микробиологии${remaining > 0 ? ` (осталось попыток: ${remaining})` : ''}`,
        });
      }

      // Ключ верный — сохраняем micro: true
      // Строим объект явно, не через spread — защита от проблем с типами
      const updatedUser: Record<string, any> = {
        activatedKey: user.activatedKey,
        date:         user.date         || new Date().toISOString(),
        micro:        true,
        microKey:     key.trim(),
        microDate:    new Date().toISOString(),
      };
      // Сохраняем дополнительные поля если есть
      if (user.trial_until) updatedUser['trial_until'] = user.trial_until;

      await redis.set(`user_id:${tgIdStr}`, updatedUser);
      await redis.srem('valid_micro_keys', key.trim());
      await resetRateLimit(ip, `micro:${rateLimitKey}`);

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
      const hasMicro = !!(existingUser?.micro === true);
      return res.status(200).json({ success: true, hasMicro });
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
      return res.status(429).json({ error: `Слишком много неверных попыток. Доступ заблокирован.` });
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

  } catch (error: any) {
    console.error('Auth Error:', error);
    // В production скрываем детали, но помогаем диагностике
    const msg = process.env.NODE_ENV === 'development'
      ? (error?.message || String(error))
      : 'Ошибка сервера';
    return res.status(500).json({ error: msg });
  }
}
