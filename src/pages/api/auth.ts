import type { NextApiRequest, NextApiResponse } from 'next';
import { Redis } from '@upstash/redis';
import {
  SUBJECTS,
  getUserAvailableSubjects,
  createDefaultSubjects,
  createDemoSubjects,
  getDemoSubjectId,
} from '@/lib/subjects';
import { verifyInitDataUser } from '@/lib/verifyInitData';

const redis = Redis.fromEnv();

const BOT_TOKEN        = process.env.BOT_TOKEN;
const CHANNEL_USERNAME = process.env.CHANNEL_USERNAME || 'nzsdental';
const TRIAL_DAYS       = Number(process.env.TRIAL_DAYS) || 0;
const ADMIN_TG_ID      = process.env.ADMIN_TG_ID || '';


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
    if (!data.ok) {
      console.error(`[isSubscribed] getChatMember failed for ${userId}:`, JSON.stringify(data));
      return false;
    }
    return ['member', 'administrator', 'creator'].includes(data.result.status);
  } catch (e) {
    console.error(`[isSubscribed] fetch error for ${userId}:`, e);
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
//  Хелпер: миграция старого формата в новый на лету
//  Старые пользователи имеют user.micro: true вместо user.subjects: {...}
// ════════════════════════════════════════════════════════════════════════════
function ensureSubjectsField(user: any): any {
  if (!user) return user;

  // Уже новый формат — ничего не делаем
  if (user.subjects && typeof user.subjects === 'object') {
    return user;
  }

  // Старый формат: конвертируем налету (НЕ записываем в Redis — просто отдаём)
  const subjects: { [k: string]: boolean } = {};
  for (const s of SUBJECTS) {
    subjects[s.id] = false;
  }
  // Все старые пользователи (с активированным ключом) имели ортопедию
  if (user.activatedKey) {
    subjects.ortho = true;
  }
  // Если был флаг micro: true — открываем микробиологию
  if (user.micro === true) {
    subjects.micro = true;
  }

  return { ...user, subjects };
}

// ════════════════════════════════════════════════════════════════════════════
//  MAIN HANDLER
// ════════════════════════════════════════════════════════════════════════════
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { key, telegramId, mode, initData } = req.body;

  const tgIdStr = String(telegramId || '').trim();
  if (!isValidTelegramId(tgIdStr)) {
    return res.status(400).json({ error: 'Некорректный Telegram ID.' });
  }

  let username: string | null = null;
  let firstName: string | null = null;
  let lastName: string | null = null;
  let skipSubscriptionCheck = false;

  if (!initData) {
    // Нет initData (неофициальный клиент) — пропускаем только тех, кто в белом списке
    const inWL = await redis.sismember('sub_whitelist', tgIdStr);
    if (!inWL) {
      return res.status(403).json({ error: 'Открой приложение через бота в Telegram.', noInitData: true });
    }
    skipSubscriptionCheck = true;
  } else {
    // Обычный путь: верифицируем данные от Telegram
    const tgUser = verifyInitDataUser(initData, BOT_TOKEN || '');
    if (!tgUser || String(tgUser.id) !== tgIdStr) {
      return res.status(401).json({ error: 'Ошибка верификации данных.' });
    }
    username = tgUser.username || null;
    firstName = tgUser.first_name || null;
    lastName = tgUser.last_name || null;
  }

  const ip = getIp(req);

  try {
    // ── Сначала ищем юзера в базе ──
    let user: any = await redis.get(`user_id:${tgIdStr}`);
    if (typeof user === 'string') {
      try { user = JSON.parse(user); } catch { user = null; }
    }
    // Конвертируем старый формат в новый (на лету)
    user = ensureSubjectsField(user);

    // 1. ПРОВЕРКА БЛОКИРОВКИ (Самый высокий приоритет)
    // Создатель приложения никогда не блокируется
    const isOwner = ADMIN_TG_ID && tgIdStr === ADMIN_TG_ID;
    if (!isOwner && user?.blocked === true) {
      return res.status(403).json({ error: 'Твой аккаунт заблокирован. Свяжись с администратором.', blocked: true });
    }

    // 2. ЖЕСТКАЯ ПРОВЕРКА ПОДПИСКИ (белый список и bypass обходят проверку)
    if (!skipSubscriptionCheck) {
      const inWhitelist = await redis.sismember('sub_whitelist', tgIdStr);
      if (!inWhitelist) {
        const subscribed = await isSubscribed(Number(tgIdStr));
        if (!subscribed) {
          return res.status(403).json({
            error: `Подпишись на @${CHANNEL_USERNAME} для доступа.`,
            needSubscription: true,
          });
        }
      }
    }

    // --- ПОСЛЕ ЭТОЙ ТОЧКИ ПОЛЬЗОВАТЕЛЬ ТОЧНО НЕ ЗАБАНЕН И ТОЧНО ПОДПИСАН ---

    // ── ДЕМО-РЕЖИМ ──
    if (mode === 'check_demo') {
      const { blocked } = await checkRateLimit(ip, `demo_${tgIdStr}`);
      if (blocked) return res.status(429).json({ error: 'Слишком много попыток.' });

      const alreadyUsed = await redis.sismember('used_demo_ids', tgIdStr);
      if (alreadyUsed) return res.status(403).json({ error: 'Демо-период уже использован.' });

      await redis.sadd('used_demo_ids', tgIdStr);
      await resetRateLimit(ip, `demo_${tgIdStr}`);
      return res.status(200).json({
        success: true,
        // В демо открыта только основная дисциплина (ортопедия)
        subjects: [getDemoSubjectId()],
      });
    }

    // ── ПРОВЕРКА МИКРОБИОЛОГИИ (legacy, для совместимости) ──
    if (mode === 'check_micro') {
      const userSubjects = getUserAvailableSubjects(user);
      return res.status(200).json({ hasMicro: userSubjects.includes('micro') });
    }

    // ── ПРОВЕРКА ДОСТУПНЫХ ДИСЦИПЛИН (новый режим) ──
    if (mode === 'check_subjects') {
      const userSubjects = getUserAvailableSubjects(user);
      // navHidden: { [subjectId]: ['stats', 'tasks', ...] } — какие табы скрыты для этого юзера
      const navHidden = (user && (user as any).navHidden && typeof (user as any).navHidden === 'object')
        ? (user as any).navHidden as Record<string, string[]>
        : {};
      return res.status(200).json({ subjects: userSubjects, navHidden, registered: !!user });
    }

    // ── ОБЩАЯ АВТОРИЗАЦИЯ ──
    if (key) {
      const { blocked } = await checkRateLimit(ip, tgIdStr);
      if (blocked) return res.status(429).json({ error: 'Доступ временно заблокирован.' });
    }

    // Существующий пользователь: вход + обновление профиля
    if (user && !user.trial_until) {
      // Обновляем username/имя если изменились в TG
      const profileChanged =
        username !== user.username ||
        firstName !== user.firstName ||
        lastName !== user.lastName;

      // Если у старого юзера не было поля subjects — нужна миграция
      const needsSubjectsMigration = !user._migrated_subjects;

      if (profileChanged || needsSubjectsMigration) {
        await redis.set(`user_id:${tgIdStr}`, {
          ...user,
          username,
          firstName,
          lastName,
          _migrated_subjects: true,
        });
      }
      await resetRateLimit(ip, tgIdStr);

      const userSubjects = getUserAvailableSubjects(user);
      return res.status(200).json({
        success:  true,
        subjects: userSubjects,                    // список ID открытых дисциплин
        hasMicro: userSubjects.includes('micro'),  // legacy для старого UI
      });
    }

    // Триал-период
    if (TRIAL_DAYS > 0) {
      const now = new Date();
      if (!user && !key) {
        const trialUntil = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
        const newUser = {
          activatedKey: 'trial',
          date:         now.toISOString(),
          trial_until:  trialUntil.toISOString(),
          username, firstName, lastName,
          // В триале открыта только демо-дисциплина (ортопедия)
          subjects:     createDemoSubjects(),
          _migrated_subjects: true,
        };
        await redis.set(`user_id:${tgIdStr}`, newUser);

        const userSubjects = getUserAvailableSubjects(newUser);
        return res.status(200).json({
          success:  true,
          trial:    true,
          trialUntil,
          subjects: userSubjects,
          hasMicro: false,
        });
      }
      if (user?.trial_until) {
        const trialEnd = new Date(user.trial_until);
        if (now < trialEnd) {
          if (username !== user.username) {
            await redis.set(`user_id:${tgIdStr}`, { ...user, username, firstName, lastName });
          }
          const userSubjects = getUserAvailableSubjects(user);
          return res.status(200).json({
            success:  true,
            trial:    true,
            trialUntil: trialEnd,
            subjects: userSubjects,
            hasMicro: userSubjects.includes('micro'),
          });
        }
        if (!key) return res.status(401).json({ error: 'Пробный период истёк. Введи ключ.' });
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  АКТИВАЦИЯ КЛЮЧА — ПОДХОД А: КЛЮЧ = ПУСТОЙ ПРОПУСК
    //
    //  После активации ключа у пользователя НЕТ доступа ни к одной дисциплине.
    //  Админ должен открыть нужные предметы через админ-панель.
    //
    //  Если пользователь уже был (например, в триале) — сохраняем его старые
    //  доступы (subjects), чтобы не потерять выданные ранее права.
    // ═══════════════════════════════════════════════════════════════════════
    if (!key) return res.status(401).json({ error: 'Введи ключ активации.' });
    if (!isValidKeyFormat(key)) return res.status(401).json({ error: 'Неверный формат ключа.' });

    const isKeyValid = await redis.sismember('valid_keys', key.trim());
    if (!isKeyValid) return res.status(401).json({ error: 'Неверный ключ.' });

    // Сохраняем существующие subjects (если были) или создаём пустые
    const existingSubjects = user?.subjects && typeof user.subjects === 'object'
      ? user.subjects
      : createDefaultSubjects();

    const activatedUser = {
      activatedKey: key.trim(),
      date:         new Date().toISOString(),
      username, firstName, lastName,
      subjects:     existingSubjects,
      _migrated_subjects: true,
    };

    await redis.set(`user_id:${tgIdStr}`, activatedUser);
    await redis.srem('valid_keys', key.trim());
    await resetRateLimit(ip, tgIdStr);

    const userSubjects = getUserAvailableSubjects(activatedUser);
    return res.status(200).json({
      success:  true,
      subjects: userSubjects,
      hasMicro: userSubjects.includes('micro'),
    });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Ошибка сервера.' });
  }
}