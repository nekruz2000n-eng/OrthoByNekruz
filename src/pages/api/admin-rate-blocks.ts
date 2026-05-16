// pages/api/admin-rate-blocks.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { Redis } from '@upstash/redis';

const redis        = Redis.fromEnv();
const ADMIN_SECRET = process.env.ADMIN_SECRET || '';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { action, tgId, secret } = req.body;

  if (!ADMIN_SECRET || secret !== ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // ── Список активных блокировок входа ──────────────────────────────────────
  if (action === 'list') {
    const blocks: { key: string; tgId: string; ttl: number }[] = [];
    let cursor = 0;

    do {
      const [nextCursor, keys] = await redis.scan(cursor, { match: 'block:*', count: 100 });
      cursor = Number(nextCursor);

      for (const key of keys) {
        const ttl = await redis.ttl(key);
        // Ключ: block:{ip}:{tgId}. tgId — только цифры (5–12 символов), всегда последний сегмент.
        const parts       = key.split(':');
        const possibleTgId = parts[parts.length - 1];
        if (/^\d{5,12}$/.test(possibleTgId)) {
          blocks.push({ key, tgId: possibleTgId, ttl });
        }
      }
    } while (cursor !== 0);

    // Объединяем дубли (несколько IP с одним tgId) — берём максимальный TTL
    const byTgId = new Map<string, number>();
    for (const b of blocks) {
      const prev = byTgId.get(b.tgId) ?? 0;
      if (b.ttl > prev) byTgId.set(b.tgId, b.ttl);
    }

    const result = Array.from(byTgId.entries())
      .map(([id, ttl]) => ({ tgId: id, ttl }))
      .sort((a, b) => b.ttl - a.ttl);

    return res.status(200).json({ ok: true, blocks: result });
  }

  // ── Снятие блокировки для конкретного tgId ────────────────────────────────
  if (action === 'clear') {
    if (!tgId) return res.status(400).json({ error: 'tgId required' });

    const patterns = [
      `block:*:${tgId}`,
      `viol:*:${tgId}`,
      `rate:*:${tgId}`,
    ];
    let deleted = 0;

    for (const pattern of patterns) {
      let cur = 0;
      do {
        const [nextCur, keys] = await redis.scan(cur, { match: pattern, count: 100 });
        cur = Number(nextCur);
        if (keys.length > 0) {
          await redis.del(...(keys as [string, ...string[]]));
          deleted += keys.length;
        }
      } while (cur !== 0);
    }

    return res.status(200).json({ ok: true, deleted });
  }

  return res.status(400).json({ error: 'Unknown action. Use: list | clear' });
}
