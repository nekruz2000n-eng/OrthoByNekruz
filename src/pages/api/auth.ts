import type { NextApiRequest, NextApiResponse } from 'next';
import { Redis } from '@upstash/redis';
import {
  SUBJECTS,
  getSubject,
  getUserAvailableSubjects,
  createDefaultSubjects,
  migrateUserSubjects,
} from '@/lib/subjects';
import {
  buildSelectingPreviewUser,
  buildSelectingPreviewUserFromExisting,
  buildActivePreviewUser,
  recordFacultyChoiceOnly,
  isEstablishedAccount,
  userAlreadyHasSubjectAccess,
  getAllPickableSubjectIds,
  getEffectiveUserSubjects,
  maybeExpirePreviewUser,
  previewEndsAt,
  isPreviewTrialLocked,
  normalizePreviewModules,
} from '@/lib/preview';
import { resolveFacultyPromoCode, facultyFieldsFromUser, getFacultyPromoById } from '@/lib/facultyCodes';
import { normalizeStudyGroup, buildStudyGroupFromDigits } from '@/lib/studyGroup';
import { buildSubjectCatalog } from '@/lib/subjectCatalog';
import { buildPreviewSubjectCatalog } from '@/lib/previewCatalogSettings';
import type { FacultyPromo } from '@/lib/facultyCodes';
import { verifyInitDataUser } from '@/lib/verifyInitData';
import { registerUserId } from '@/lib/userIndex';
import { clearAuthRateLimitsForTgId, checkCatalogBrowseLimit } from '@/lib/authRateLimit';
import {
  buildCatalogSelectingUser,
  getCatalogGrantedSubjects,
  restartCatalogBrowseSelecting,
} from '@/lib/catalogBrowse';

const redis = Redis.fromEnv();

const BOT_TOKEN        = process.env.BOT_TOKEN;
const CHANNEL_USERNAME = process.env.CHANNEL_USERNAME || 'nzsdental';
const TRIAL_DAYS       = Number(process.env.TRIAL_DAYS) || 0;
const ADMIN_TG_ID      = process.env.ADMIN_TG_ID || '';

type Profile = { username: string | null; firstName: string | null; lastName: string | null };

/** Просмотр каталога из статистики: код → группа → витрина → просмотр другого предмета. */
async function handleCatalogBrowseStart(
  res: NextApiResponse,
  tgIdStr: string,
  user: any,
  profile: Profile,
  promo: FacultyPromo,
) {
  const catalog = await buildPreviewSubjectCatalog(redis);
  user = user ? await maybeExpirePreviewUser(redis, tgIdStr, user) : user;

  if (user?.previewStatus === 'active') {
    return res.status(200).json({
      success: true,
      resumed: true,
      catalogBrowse: true,
      ...(await subjectsResponse(user, tgIdStr)),
    });
  }

  if (user?.previewStatus === 'expired' && user._catalogBrowse) {
    const merged = restartCatalogBrowseSelecting(user, profile, promo);
    await saveUser(tgIdStr, merged);
    await clearAuthRateLimitsForTgId(redis, tgIdStr);
    return res.status(200).json({
      success: true,
      catalogBrowse: true,
      subjects: [],
      ...previewPayload(merged, catalog, tgIdStr),
    });
  }

  if (user?.previewStatus === 'selecting' && user._catalogBrowse) {
    if (promo) {
      const merged = buildCatalogSelectingUser(user, profile, promo);
      await saveUser(tgIdStr, merged);
      return res.status(200).json({
        success: true,
        catalogBrowse: true,
        subjects: [],
        ...previewPayload(merged, catalog, tgIdStr),
      });
    }
    return res.status(200).json({
      success: true,
      resumed: true,
      catalogBrowse: true,
      subjects: [],
      ...previewPayload(user, catalog, tgIdStr),
    });
  }

  const merged = buildCatalogSelectingUser(user, profile, promo);
  await saveUser(tgIdStr, merged);
  await clearAuthRateLimitsForTgId(redis, tgIdStr);
  return res.status(200).json({
    success: true,
    catalogBrowse: true,
    subjects: [],
    ...previewPayload(merged, catalog, tgIdStr),
  });
}

async function handlePreviewStart(
  res: NextApiResponse,
  tgIdStr: string,
  ip: string,
  user: any,
  profile: { username: string | null; firstName: string | null; lastName: string | null },
  promo?: FacultyPromo,
  catalogBrowse = false,
) {
  const catalog = await buildPreviewSubjectCatalog(redis);

  if (user?.previewStatus === 'confirmed') {
    if (promo) {
      const merged = buildSelectingPreviewUserFromExisting(user, profile, promo, { forceNewGroup: catalogBrowse });
      await saveUser(tgIdStr, merged);
      return res.status(200).json({ success: true, preview: true, ...previewPayload(merged, catalog, tgIdStr) });
    }
    return res.status(200).json({
      success: true,
      alreadyConfirmed: true,
      subjects: getUserAvailableSubjects(user),
      ...previewPayload(user, catalog, tgIdStr),
    });
  }

  if (user?.previewStatus === 'expired') {
    return res.status(403).json({
      error: 'Ожидайте подтверждения доступа администратором.',
      previewAwaiting: true,
      ...previewPayload(user, catalog, tgIdStr),
    });
  }

  if (user?.previewStatus === 'selecting') {
    if (promo) {
      const merged = buildSelectingPreviewUserFromExisting(user, profile, promo, { forceNewGroup: catalogBrowse });
      await saveUser(tgIdStr, merged);
      return res.status(200).json({ success: true, preview: true, ...previewPayload(merged, catalog, tgIdStr) });
    }
    return res.status(200).json({ success: true, resumed: true, ...previewPayload(user, catalog, tgIdStr) });
  }

  if (user?.previewStatus === 'active') {
    user = await maybeExpirePreviewUser(redis, tgIdStr, user);
    if (user.previewStatus === 'expired') {
      return res.status(403).json({
        error: 'Сессия завершена. Ожидайте подтверждения доступа.',
        previewAwaiting: true,
        ...previewPayload(user, catalog, tgIdStr),
      });
    }
    return res.status(200).json({ success: true, resumed: true, ...(await subjectsResponse(user, tgIdStr)) });
  }

  if (isEstablishedAccount(user)) {
    if (!promo) {
      return res.status(400).json({ error: 'Введи код из канала.' });
    }
    const merged = buildSelectingPreviewUserFromExisting(user, profile, promo, { forceNewGroup: catalogBrowse });
    await saveUser(tgIdStr, merged);
    await clearAuthRateLimitsForTgId(redis, tgIdStr);
    return res.status(200).json({ success: true, preview: true, ...previewPayload(merged, catalog, tgIdStr) });
  }

  const alreadyUsed = await isPreviewTrialLocked(redis, tgIdStr);
  if (alreadyUsed) {
    return res.status(403).json({ error: 'Код из канала уже использован. Свяжись с администратором.' });
  }

  if (!promo) {
    return res.status(400).json({ error: 'Введи код из канала.' });
  }

  const { blocked } = await checkRateLimit(ip, `demo_${tgIdStr}`);
  if (blocked) return res.status(429).json({ error: 'Слишком много попыток.' });

  const newUser = buildSelectingPreviewUser(profile, promo);
  await saveUser(tgIdStr, newUser);
  await redis.sadd('used_demo_ids', tgIdStr);
  await clearAuthRateLimitsForTgId(redis, tgIdStr);

  return res.status(200).json({ success: true, preview: true, ...previewPayload(newUser, catalog, tgIdStr) });
}

const isValidTelegramId = (id: string): boolean => {
  if (!/^\d{5,12}$/.test(id)) return false;
  const n = Number(id);
  return n >= 10000 && n <= 9_999_999_999;
};

const isValidKeyFormat = (key: string): boolean => {
  const k = key.trim();
  if (!/^\d{8}$/.test(k)) return false;
  const d = k.split('').map(Number);
  const sumCheck = d[0] + d[1] + d[7] === 15;
  const modCheck = parseInt(k, 10) % 7 === 3;
  return sumCheck && modCheck;
};

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

function ensureSubjectsField(user: any): any {
  return migrateUserSubjects(user);
}

function previewPayload(
  user: any,
  catalog?: ReturnType<typeof buildSubjectCatalog>,
  tgId?: string,
) {
  const selecting = user?.previewStatus === 'selecting';
  const hasGroup  = !!String(user?.studyGroup || '').trim();
  const navHidden = (user?.navHidden && typeof user.navHidden === 'object')
    ? user.navHidden as Record<string, string[]>
    : {};
  return {
    previewStatus:        user?.previewStatus ?? null,
    previewChosenSubject: user?.previewChosenSubject ?? null,
    previewChosenModules: user?.previewChosenModules ?? null,
    studyGroup:           user?.studyGroup ?? null,
    needsStudyGroup:      selecting && !hasGroup,
    previewEndsAt:        previewEndsAt(user, tgId),
    previewStartedAt:     user?.previewStatus === 'active' ? (user.previewStartedAt ?? null) : null,
    pickSubjects:         selecting && hasGroup ? getAllPickableSubjectIds() : undefined,
    subjectCatalog:       user?.previewStatus && hasGroup ? catalog : undefined,
    navHidden,
    catalogGrantedSubjects: user?._catalogBrowse && hasGroup
      ? getCatalogGrantedSubjects(user)
      : undefined,
    ...facultyFieldsFromUser(user),
  };
}

async function saveUser(tgId: string, user: any) {
  await redis.set(`user_id:${tgId}`, user);
  await registerUserId(redis, tgId);
}

async function subjectsResponse(user: any, tgId?: string) {
  const navHidden = (user.navHidden && typeof user.navHidden === 'object')
    ? user.navHidden as Record<string, string[]>
    : {};
  const subjects = getEffectiveUserSubjects(user, tgId);
  const catalog = user?.previewStatus ? await buildPreviewSubjectCatalog(redis) : undefined;
  return {
    subjects,
    navHidden,
    registered: true,
    ...previewPayload(user, catalog, tgId),
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    key, telegramId, mode, initData, subjectId, course, faculty, modules,
    studyGroup: studyGroupRaw, catalogBrowse,
  } = req.body;
  const isCatalogBrowse = catalogBrowse === true || catalogBrowse === 'true';

  const tgIdStr = String(telegramId || '').trim();
  if (!isValidTelegramId(tgIdStr)) {
    return res.status(400).json({ error: 'Некорректный Telegram ID.' });
  }

  let username: string | null = null;
  let firstName: string | null = null;
  let lastName: string | null = null;
  let skipSubscriptionCheck = false;

  if (!initData) {
    const inWL = await redis.sismember('sub_whitelist', tgIdStr);
    if (!inWL) {
      return res.status(403).json({ error: 'Открой приложение через бота в Telegram.', noInitData: true });
    }
    skipSubscriptionCheck = true;
  } else {
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
    let user: any = await redis.get(`user_id:${tgIdStr}`);
    if (typeof user === 'string') {
      try { user = JSON.parse(user); } catch { user = null; }
    }
    user = ensureSubjectsField(user);

    const isOwner = ADMIN_TG_ID && tgIdStr === ADMIN_TG_ID;
    if (!isOwner && user?.blocked === true) {
      return res.status(403).json({ error: 'Твой аккаунт заблокирован. Свяжись с администратором.', blocked: true });
    }

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

    if (mode === 'check_demo') {
      return res.status(400).json({ error: 'Введи код из канала в поле выше.' });
    }

    if (mode === 'start_catalog_browse') {
      if (!user) {
        return res.status(401).json({ error: 'Сначала войди в приложение.' });
      }
      if (!isEstablishedAccount(user)) {
        return res.status(403).json({ error: 'Каталог доступен после регистрации.' });
      }
      const promo = getFacultyPromoById(user.facultyId);
      if (!promo) {
        return res.status(400).json({
          error: 'Код факультета не сохранён. Введи его из канала.',
          needsFacultyCode: true,
        });
      }
      const catalogLimit = await checkCatalogBrowseLimit(redis, ip, tgIdStr, 'success');
      if (catalogLimit.blocked) {
        return res.status(429).json({ error: 'Доступ временно заблокирован. Подожди 30 минут.' });
      }
      const profile = { username, firstName, lastName };
      return handleCatalogBrowseStart(res, tgIdStr, user, profile, promo);
    }

    if (mode === 'set_study_group') {
      if (!user || user.previewStatus !== 'selecting') {
        return res.status(400).json({ error: 'Сейчас нельзя сохранить группу.' });
      }
      const facultyId = String(user.facultyId || '').trim() || null;
      const built = buildStudyGroupFromDigits(String(studyGroupRaw ?? ''), facultyId);
      if (!built) {
        return res.status(400).json({
          error: facultyId
            ? 'Введи номер группы цифрами, например 108'
            : 'Сначала введи код доступа.',
        });
      }
      const updated = {
        ...user,
        studyGroup: normalizeStudyGroup(built),
        username:   username ?? user.username,
        firstName:  firstName ?? user.firstName,
        lastName:   lastName ?? user.lastName,
        lastLogin:  new Date().toISOString(),
        loginCount: Number(user.loginCount || 0) + 1,
      };
      await saveUser(tgIdStr, updated);
      const catalog = await buildPreviewSubjectCatalog(redis);
      return res.status(200).json({
        success: true,
        ...(await subjectsResponse(updated, tgIdStr)),
      });
    }

    if (mode === 'pick_preview_subject') {
      if (!user || user.previewStatus !== 'selecting') {
        return res.status(400).json({ error: 'Выбор предмета недоступен.' });
      }
      if (!String(user.studyGroup || '').trim()) {
        return res.status(400).json({ error: 'Сначала укажи группу.' });
      }
      if (user.previewChosenSubject) {
        return res.status(400).json({ error: 'Предмет уже выбран и изменить его нельзя.' });
      }

      const chosen = String(subjectId || '').trim();
      if (!getSubject(chosen)) {
        return res.status(400).json({ error: 'Неизвестный предмет.' });
      }

      const catalogEntry = (await buildPreviewSubjectCatalog(redis)).find(s => s.id === chosen);
      if (!catalogEntry?.hasAnyModule) {
        return res.status(400).json({ error: 'Для этого предмета материалы ещё не готовы.' });
      }

      const chosenModules = normalizePreviewModules(modules);
      if (chosenModules.length === 0) {
        return res.status(400).json({ error: 'Выбери хотя бы один раздел.' });
      }
      for (const modId of chosenModules) {
        const mod = catalogEntry.modules.find(m => m.id === modId);
        if (!mod?.available) {
          return res.status(400).json({ error: 'Один из разделов недоступен.' });
        }
      }

      if (user._catalogBrowse) {
        if (userAlreadyHasSubjectAccess(user, chosen)) {
          return res.status(400).json({
            error: 'Этот предмет уже открыт. Выбери другой.',
          });
        }
      } else if (userAlreadyHasSubjectAccess(user, chosen)) {
        const updated = recordFacultyChoiceOnly(user, chosen, chosenModules);
        updated.username   = username ?? updated.username;
        updated.firstName  = firstName ?? updated.firstName;
        updated.lastName   = lastName ?? updated.lastName;
        updated.lastLogin  = new Date().toISOString();
        updated.loginCount = Number(updated.loginCount || 0) + 1;
        await saveUser(tgIdStr, updated);
        return res.status(200).json({
          success: true,
          facultyRecorded: true,
          ...(await subjectsResponse(updated, tgIdStr)),
        });
      }

      const updated = buildActivePreviewUser(user, chosen, chosenModules);
      if (user._catalogBrowse) {
        updated._catalogBrowse = true;
      }
      updated.username   = username ?? updated.username;
      updated.firstName  = firstName ?? updated.firstName;
      updated.lastName   = lastName ?? updated.lastName;
      updated.lastLogin  = new Date().toISOString();
      updated.loginCount = Number(updated.loginCount || 0) + 1;

      await saveUser(tgIdStr, updated);

      return res.status(200).json({
        success: true,
        ...(await subjectsResponse(updated, tgIdStr)),
      });
    }

    if (mode === 'check_preview_status') {
      if (!user?.previewStatus) {
        return res.status(404).json({ error: 'Заявка не найдена.' });
      }
      user = await maybeExpirePreviewUser(redis, tgIdStr, user);
      const catalog = await buildPreviewSubjectCatalog(redis);
      if (user.previewStatus === 'confirmed') {
        return res.status(200).json({ success: true, ...(await subjectsResponse(user, tgIdStr)) });
      }
      if (user.previewStatus === 'expired') {
        return res.status(200).json({ success: true, awaitingAdmin: true, ...previewPayload(user, catalog, tgIdStr) });
      }
      if (user.previewStatus === 'selecting') {
        return res.status(200).json({ success: true, needsSubjectPick: true, ...previewPayload(user, catalog, tgIdStr) });
      }
      if (user.previewStatus === 'active') {
        return res.status(200).json({
          success: true,
          ...(await subjectsResponse(user, tgIdStr)),
        });
      }
      return res.status(404).json({ error: 'Статус не определён.' });
    }

    if (mode === 'check_micro') {
      const userSubjects = getEffectiveUserSubjects(user, tgIdStr);
      return res.status(200).json({ hasMicro: userSubjects.includes('micro') });
    }

    if (mode === 'check_subjects') {
      if (!user) {
        return res.status(200).json({ subjects: [], navHidden: {}, registered: false });
      }

      user = await maybeExpirePreviewUser(redis, tgIdStr, user);

      if (user.previewStatus) {
        return res.status(200).json(await subjectsResponse(user, tgIdStr));
      }

      const userSubjects = getUserAvailableSubjects(user);
      const navHidden = (user.navHidden && typeof user.navHidden === 'object')
        ? user.navHidden as Record<string, string[]>
        : {};
      return res.status(200).json({ subjects: userSubjects, navHidden, registered: true });
    }

    if (user && !user.trial_until && !user.previewStatus) {
      await redis.set(`user_id:${tgIdStr}`, {
        ...user,
        username,
        firstName,
        lastName,
        _migrated_subjects: true,
        lastLogin:  new Date().toISOString(),
        loginCount: ((user as any).loginCount || 0) + 1,
      });
      await registerUserId(redis, tgIdStr);
      await resetRateLimit(ip, tgIdStr);

      const userSubjects = getUserAvailableSubjects(user);
      return res.status(200).json({
        success:  true,
        subjects: userSubjects,
        hasMicro: userSubjects.includes('micro'),
      });
    }

    if (TRIAL_DAYS > 0) {
      const now = new Date();
      if (!user && !key) {
        const trialUntil = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
        const newUser = {
          activatedKey: 'trial',
          date:         now.toISOString(),
          trial_until:  trialUntil.toISOString(),
          username, firstName, lastName,
          subjects:     createDefaultSubjects(),
          _migrated_subjects: true,
        };
        await redis.set(`user_id:${tgIdStr}`, newUser);
        await registerUserId(redis, tgIdStr);

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
            await registerUserId(redis, tgIdStr);
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

    if (!key) return res.status(401).json({ error: 'Введи код из канала или ключ доступа.' });

    const promo = resolveFacultyPromoCode(String(key).trim());

    if (isCatalogBrowse) {
      if (promo) {
        const catalogLimit = await checkCatalogBrowseLimit(redis, ip, tgIdStr, 'success');
        if (catalogLimit.blocked) {
          return res.status(429).json({ error: 'Доступ временно заблокирован. Подожди 30 минут.' });
        }
        const profile = { username, firstName, lastName };
        if (user && isEstablishedAccount(user)) {
          return handleCatalogBrowseStart(res, tgIdStr, user, profile, promo);
        }
        if (!user) {
          return res.status(401).json({ error: 'Сначала войди в приложение.' });
        }
        return handlePreviewStart(res, tgIdStr, ip, user, profile, promo, true);
      }
      const catalogLimit = await checkCatalogBrowseLimit(redis, ip, tgIdStr, 'fail');
      if (catalogLimit.blocked) {
        return res.status(429).json({ error: 'Доступ временно заблокирован.' });
      }
      return res.status(401).json({ error: 'Неверный код' });
    }

    if (promo) {
      await clearAuthRateLimitsForTgId(redis, tgIdStr);
      return handlePreviewStart(res, tgIdStr, ip, user, { username, firstName, lastName }, promo, isCatalogBrowse);
    }

    const { blocked } = await checkRateLimit(ip, tgIdStr);
    if (blocked) return res.status(429).json({ error: 'Доступ временно заблокирован.' });

    if (!isValidKeyFormat(key)) return res.status(401).json({ error: 'Неверный код или ключ.' });

    const paidKeysEnabled = await redis.get('settings:is_paid_keys_enabled');
    if (paidKeysEnabled === false) {
      return res.status(401).json({ error: 'Платные ключи временно отключены. Введи код из канала.' });
    }

    const isKeyValid = await redis.sismember('valid_keys', key.trim());
    if (!isKeyValid) return res.status(401).json({ error: 'Неверный ключ.' });

    const existingSubjects = user?.subjects && typeof user.subjects === 'object'
      ? user.subjects
      : createDefaultSubjects();

    const activatedUser = {
      ...(user || {}),
      activatedKey:       key.trim(),
      date:               user?.date ?? new Date().toISOString(),
      username, firstName, lastName,
      subjects:           existingSubjects,
      previewStatus:      null,
      previewChosenSubject:  null,
      previewChosenModules:  null,
      previewStartedAt:      null,
      previewExpiredAt:      null,
      _subjectsBeforePreview:     undefined,
      _previewStatusBeforeCatalog: undefined,
      _migrated_subjects: true,
    };

    await redis.set(`user_id:${tgIdStr}`, activatedUser);
    await registerUserId(redis, tgIdStr);
    await redis.srem('valid_keys', key.trim());
    await clearAuthRateLimitsForTgId(redis, tgIdStr);

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
