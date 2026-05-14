import type { NextApiRequest, NextApiResponse } from 'next';
import { Redis } from '@upstash/redis';
import { createHmac } from 'crypto';
import { SUBJECTS, getSubject, getUserAvailableSubjects } from '@/lib/subjects';

const redis        = Redis.fromEnv();
const ADMIN_SECRET = process.env.ADMIN_SECRET || '';
const ADMIN_TG_ID  = '978243325';
const BOT_TOKEN    = process.env.BOT_TOKEN    || '';

// ── Криптографическая проверка initData от Telegram ─────────────────────────
function verifyTelegramInitData(
  initData: string,
  botToken: string,
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

// ── Security middleware: initData валидна + ID совпадает + secret верный ─────
function verifyAdmin(initData: string, secret: string): boolean {
  if (!ADMIN_SECRET || secret !== ADMIN_SECRET) return false;
  if (!BOT_TOKEN) return false;

  const tgUser = verifyTelegramInitData(initData, BOT_TOKEN);
  if (!tgUser || String(tgUser.id) !== ADMIN_TG_ID) return false;

  return true;
}

// ── Конвертация старого формата пользователя в новый ────────────────────────
function ensureSubjects(user: any): any {
  if (!user) return user;
  if (user.subjects && typeof user.subjects === 'object') return user;

  const subjects: { [k: string]: boolean } = {};
  for (const s of SUBJECTS) subjects[s.id] = false;
  if (user.activatedKey) subjects.ortho = true;
  if (user.micro === true) subjects.micro = true;

  return { ...user, subjects };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { initData, secret, action, tgId, subject, enable, reason } = req.body ?? {};

  // ── Двойная защита: initData + ADMIN_TG_ID + ADMIN_SECRET ───────────────
  if (!initData || !secret || !verifyAdmin(String(initData), String(secret))) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    // ── Действия с конкретным пользователем ─────────────────────────────────
    if (action && tgId) {
      let user: any = await redis.get(`user_id:${tgId}`);
      if (!user && action !== 'reset_demo') {
        return res.status(404).json({ error: 'User not found' });
      }
      user = ensureSubjects(user);

      if (action === 'block') {
        // Причина — свободный текст до 200 символов; пусто → дефолт 'manual'
        const cleanReason = String(reason ?? '').trim().slice(0, 200) || 'manual';
        await redis.set(`user_id:${tgId}`, {
          ...user,
          blocked:       true,
          blockedReason: cleanReason,
          blockedAt:     new Date().toISOString(),
        });
        return res.status(200).json({ ok: true });
      }

      if (action === 'unblock') {
        const updated: Record<string, any> = { ...user };
        delete updated.blocked;
        delete updated.blockedReason;
        delete updated.blockedAt;
        await redis.set(`user_id:${tgId}`, updated);
        const today = new Date().toISOString().slice(0, 10);
        await redis.del(`opens:${tgId}:${today}`);
        await redis.del(`opens_notified:${tgId}:${today}`);
        return res.status(200).json({ ok: true });
      }

      if (action === 'toggle_subject') {
        const subjectId = String(subject || '').trim();
        const enabled   = enable === true || enable === 'true' || enable === '1';

        const cfg = getSubject(subjectId);
        if (!cfg) {
          return res.status(400).json({ error: `Unknown subject: ${subjectId}` });
        }

        const subjects = { ...(user.subjects || {}) };
        for (const s of SUBJECTS) {
          if (!(s.id in subjects)) subjects[s.id] = false;
        }
        subjects[subjectId] = enabled;

        const updated: any = { ...user, subjects, _migrated_subjects: true };

        if (enabled) {
          updated[`${subjectId}_grantedAt`] = new Date().toISOString();
        } else {
          delete updated[`${subjectId}_grantedAt`];
        }

        if (subjectId === 'micro') {
          if (enabled) {
            updated.micro          = true;
            updated.microGrantedAt = new Date().toISOString();
          } else {
            delete updated.micro;
            delete updated.microGrantedAt;
            delete updated.microKey;
            delete updated.microDate;
          }
        }

        await redis.set(`user_id:${tgId}`, updated);
        return res.status(200).json({
          ok: true,
          subjects: getUserAvailableSubjects(updated),
        });
      }

      // Legacy: give_micro / revoke_micro
      if (action === 'give_micro') {
        const subjects = { ...(user.subjects || {}) };
        for (const s of SUBJECTS) if (!(s.id in subjects)) subjects[s.id] = false;
        subjects.micro = true;
        await redis.set(`user_id:${tgId}`, {
          ...user,
          subjects,
          micro:              true,
          microGrantedAt:     new Date().toISOString(),
          _migrated_subjects: true,
        });
        return res.status(200).json({ ok: true });
      }

      if (action === 'revoke_micro') {
        const subjects = { ...(user.subjects || {}) };
        for (const s of SUBJECTS) if (!(s.id in subjects)) subjects[s.id] = false;
        subjects.micro = false;
        const u: Record<string, any> = { ...user, subjects, _migrated_subjects: true };
        delete u.micro;
        delete u.microGrantedAt;
        delete u.microKey;
        delete u.microDate;
        await redis.set(`user_id:${tgId}`, u);
        return res.status(200).json({ ok: true });
      }

      if (action === 'reset_demo') {
        await redis.srem('used_demo_ids', tgId as string);
        return res.status(200).json({ ok: true });
      }

      return res.status(400).json({ error: 'Unknown action' });
    }

    // ── Получить список всех пользователей ──────────────────────────────────
    const keys = await redis.keys('user_id:*');
    if (!keys.length) {
      return res.status(200).json({
        users: [],
        total: 0,
        demoCount: 0,
        availableSubjects: SUBJECTS.map(s => ({
          id:         s.id,
          label:      s.label,
          shortLabel: s.shortLabel,
          color:      s.color,
        })),
      });
    }

    const today = new Date().toISOString().slice(0, 10);

    const pipeline1 = redis.pipeline();
    for (const key of keys) pipeline1.get(key);
    const rawUsers = await pipeline1.exec();

    const pipeline2 = redis.pipeline();
    for (const key of keys) {
      const id = key.replace('user_id:', '');
      pipeline2.get(`opens:${id}:${today}`);
      pipeline2.get(`fingerprint_changes:${id}`);
    }
    const extraData = await pipeline2.exec();

    const pipeline3 = redis.pipeline();
    for (const key of keys) {
      const id = key.replace('user_id:', '');
      pipeline3.sismember('used_demo_ids', id);
    }
    const demoData = await pipeline3.exec();

    const users = keys.map((key, i) => {
      const id        = key.replace('user_id:', '');
      let   user      = (rawUsers[i] as any) ?? {};
      const opens     = Number(extraData[i * 2])     || 0;
      const fpChanges = Number(extraData[i * 2 + 1]) || 0;
      const usedDemo  = Boolean(demoData[i]);

      user = ensureSubjects(user);
      const userSubjects = getUserAvailableSubjects(user);

      const suspicious = opens >= 5 || fpChanges >= 2;

      return {
        tgId:          id,
        username:      user.username      ?? null,
        firstName:     user.firstName     ?? null,
        lastName:      user.lastName      ?? null,
        blocked:       user.blocked === true,
        blockedReason: user.blockedReason ?? null,
        blockedAt:     user.blockedAt     ?? null,
        subjects:      userSubjects,
        hasMicro:      userSubjects.includes('micro'),
        usedDemo,
        activatedKey:  user.activatedKey  ?? null,
        registeredAt:  user.date          ?? null,
        opensToday:    opens,
        fpChanges,
        suspicious,
      };
    });

    users.sort((a, b) => {
      const scoreA = (a.blocked ? 2 : 0) + (a.suspicious ? 1 : 0);
      const scoreB = (b.blocked ? 2 : 0) + (b.suspicious ? 1 : 0);
      return scoreB - scoreA;
    });

    const demoCount = users.filter(u => u.usedDemo).length;

    return res.status(200).json({
      users,
      total: users.length,
      demoCount,
      availableSubjects: SUBJECTS.map(s => ({
        id:         s.id,
        label:      s.label,
        shortLabel: s.shortLabel,
        color:      s.color,
      })),
    });

  } catch (err) {
    console.error('[admin-users] error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
