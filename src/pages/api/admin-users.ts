// pages/api/admin-users.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { Redis } from '@upstash/redis';

const redis        = Redis.fromEnv();
const ADMIN_SECRET = process.env.ADMIN_SECRET || '';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();

  const { secret, action, tgId } = req.query;

  // Защита
  if (!ADMIN_SECRET || secret !== ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // ── Действие: block / unblock ────────────────────────────────────────────
    if (action && tgId) {
      let user: any = await redis.get(`user_id:${tgId}`);
      if (!user) return res.status(404).json({ error: 'User not found' });

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
        // Сбрасываем счётчик — чистый старт
        const today = new Date().toISOString().slice(0, 10);
        await redis.del(`opens:${tgId}:${today}`);
        await redis.del(`opens_notified:${tgId}:${today}`);
        return res.status(200).json({ ok: true });
      }

      return res.status(400).json({ error: 'Unknown action' });
    }

    // ── Получить список всех пользователей ──────────────────────────────────
    const keys = await redis.keys('user_id:*');
    if (!keys.length) return res.status(200).json({ users: [] });

    const today = new Date().toISOString().slice(0, 10);

    // Читаем всех за одну multi-get операцию
    const pipeline = redis.pipeline();
    for (const key of keys) pipeline.get(key);
    const rawUsers = await pipeline.exec();

    // Читаем opens + fingerprint_changes параллельно
    const pipeline2 = redis.pipeline();
    for (const key of keys) {
      const id = key.replace('user_id:', '');
      pipeline2.get(`opens:${id}:${today}`);
      pipeline2.get(`fingerprint_changes:${id}`);
    }
    const extraData = await pipeline2.exec();

    const users = keys.map((key, i) => {
      const id   = key.replace('user_id:', '');
      const user = (rawUsers[i] as any) ?? {};
      const opens          = Number(extraData[i * 2])    || 0;
      const fpChanges      = Number(extraData[i * 2 + 1]) || 0;

      // Определяем уровень подозрительности
      let suspicious = false;
      if (opens >= 5)    suspicious = true;
      if (fpChanges >= 2) suspicious = true;

      return {
        tgId:          id,
        blocked:       user.blocked === true,
        blockedReason: user.blockedReason ?? null,
        blockedAt:     user.blockedAt     ?? null,
        hasMicro:      user.micro === true,
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

    return res.status(200).json({ users, total: users.length });

  } catch (err) {
    console.error('[admin-users] error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}