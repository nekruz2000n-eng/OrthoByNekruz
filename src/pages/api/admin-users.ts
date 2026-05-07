// pages/api/admin-users.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { Redis } from '@upstash/redis';
import {
  SUBJECTS,
  getSubject,
  getUserAvailableSubjects,
} from '@/lib/subjects';

const redis        = Redis.fromEnv();
const ADMIN_SECRET = process.env.ADMIN_SECRET || '';

// ════════════════════════════════════════════════════════════════════════════
//  Хелпер: гарантирует что у пользователя есть поле subjects
//  Если был старый формат (user.micro: true) — конвертирует.
// ════════════════════════════════════════════════════════════════════════════
function ensureSubjects(user: any): any {
  if (!user) return user;

  if (user.subjects && typeof user.subjects === 'object') {
    return user;
  }

  // Конвертируем старый формат
  const subjects: { [k: string]: boolean } = {};
  for (const s of SUBJECTS) subjects[s.id] = false;
  if (user.activatedKey) subjects.ortho = true;     // у всех старых была ортопедия
  if (user.micro === true) subjects.micro = true;   // если был флаг micro

  return { ...user, subjects };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();

  const { secret, action, tgId, subject, enable } = req.query;

  // Защита
  if (!ADMIN_SECRET || secret !== ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // ── Действия с пользователем ─────────────────────────────────────────────
    if (action && tgId) {
      let user: any = await redis.get(`user_id:${tgId}`);
      if (!user && action !== 'reset_demo') {
        return res.status(404).json({ error: 'User not found' });
      }
      // Гарантируем новый формат для всех действий
      user = ensureSubjects(user);

      // ─── Блокировка ──────────────────────────────────────────────────────
      if (action === 'block') {
        await redis.set(`user_id:${tgId}`, {
          ...user,
          blocked:       true,
          blockedReason: 'manual',
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

      // ═══════════════════════════════════════════════════════════════════
      //  УНИВЕРСАЛЬНОЕ УПРАВЛЕНИЕ ДОСТУПОМ К ДИСЦИПЛИНАМ
      //
      //  Пример вызова:
      //    /api/admin-users?secret=...&action=toggle_subject
      //                    &tgId=123&subject=micro&enable=true
      //
      //  - subject: ID дисциплины (ortho, micro, pharma...)
      //  - enable:  'true' = открыть, 'false' = закрыть
      // ═══════════════════════════════════════════════════════════════════
      if (action === 'toggle_subject') {
        const subjectId = String(subject || '').trim();
        const enabled   = enable === 'true' || enable === '1';

        // Проверяем что такая дисциплина существует в конфиге
        const cfg = getSubject(subjectId);
        if (!cfg) {
          return res.status(400).json({ error: `Unknown subject: ${subjectId}` });
        }

        const subjects = { ...(user.subjects || {}) };
        // Гарантируем что все дисциплины из конфига есть в subjects
        for (const s of SUBJECTS) {
          if (!(s.id in subjects)) subjects[s.id] = false;
        }
        subjects[subjectId] = enabled;

        const updated: any = {
          ...user,
          subjects,
          _migrated_subjects: true,
        };

        // Записываем мета-инфу о том кто и когда выдал доступ
        if (enabled) {
          updated[`${subjectId}_grantedAt`] = new Date().toISOString();
        } else {
          delete updated[`${subjectId}_grantedAt`];
        }

        // Legacy: для обратной совместимости со старым кодом синхронизируем micro
        if (subjectId === 'micro') {
          if (enabled) {
            updated.micro = true;
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

      // ─── LEGACY: give_micro / revoke_micro (для обратной совместимости) ──
      // Старый код может ещё использовать эти actions, поэтому оставляем.
      if (action === 'give_micro') {
        const subjects = { ...(user.subjects || {}) };
        for (const s of SUBJECTS) if (!(s.id in subjects)) subjects[s.id] = false;
        subjects.micro = true;

        await redis.set(`user_id:${tgId}`, {
          ...user,
          subjects,
          micro:          true,
          microGrantedAt: new Date().toISOString(),
          _migrated_subjects: true,
        });
        return res.status(200).json({ ok: true });
      }

      if (action === 'revoke_micro') {
        const subjects = { ...(user.subjects || {}) };
        for (const s of SUBJECTS) if (!(s.id in subjects)) subjects[s.id] = false;
        subjects.micro = false;

        const u: Record<string, any> = {
          ...user,
          subjects,
          _migrated_subjects: true,
        };
        delete u.micro;
        delete u.microGrantedAt;
        delete u.microKey;
        delete u.microDate;
        await redis.set(`user_id:${tgId}`, u);
        return res.status(200).json({ ok: true });
      }

      // ── Сбросить демо-доступ ─────────────────────────────────────────────
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
        // Список всех дисциплин из конфига — для рендера кнопок в админке
        availableSubjects: SUBJECTS.map(s => ({
          id:         s.id,
          label:      s.label,
          shortLabel: s.shortLabel,
          color:      s.color,
        })),
      });
    }

    const today = new Date().toISOString().slice(0, 10);

    // Pipeline 1: данные пользователей
    const pipeline1 = redis.pipeline();
    for (const key of keys) pipeline1.get(key);
    const rawUsers = await pipeline1.exec();

    // Pipeline 2: opens + fingerprint_changes
    const pipeline2 = redis.pipeline();
    for (const key of keys) {
      const id = key.replace('user_id:', '');
      pipeline2.get(`opens:${id}:${today}`);
      pipeline2.get(`fingerprint_changes:${id}`);
    }
    const extraData = await pipeline2.exec();

    // Pipeline 3: demo status
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

      // Конвертируем старый формат → новый (для отображения)
      user = ensureSubjects(user);

      // Список ID открытых дисциплин у пользователя
      const userSubjects = getUserAvailableSubjects(user);

      // Уровень подозрительности
      let suspicious = false;
      if (opens >= 5)     suspicious = true;
      if (fpChanges >= 2) suspicious = true;

      return {
        tgId:          id,
        username:      user.username      ?? null,
        firstName:     user.firstName     ?? null,
        lastName:      user.lastName      ?? null,
        blocked:       user.blocked === true,
        blockedReason: user.blockedReason ?? null,
        blockedAt:     user.blockedAt     ?? null,

        // Новое: список ID открытых дисциплин — ['ortho', 'micro']
        subjects:      userSubjects,

        // Legacy: для обратной совместимости со старым UI
        hasMicro:      userSubjects.includes('micro'),

        usedDemo,
        activatedKey:  user.activatedKey  ?? null,
        registeredAt:  user.date          ?? null,
        opensToday:    opens,
        fpChanges,
        suspicious,
      };
    });

    // Сортировка: заблокированные и подозрительные — сверху
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
      // Список всех дисциплин из конфига — для рендера кнопок
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