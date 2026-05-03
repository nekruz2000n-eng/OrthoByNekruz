// pages/api/ping.ts  ← Pages Router формат
import type { NextApiRequest, NextApiResponse } from 'next';
import { Redis }      from '@upstash/redis';
import { createHmac } from 'crypto';

const redis            = Redis.fromEnv();
const BOT_TOKEN        = process.env.BOT_TOKEN    || '';
const ADMIN_TG_ID      = process.env.ADMIN_TG_ID  || '';
const DAILY_OPEN_LIMIT = 5;

function verifyInitData(initData: string): number | null {
  try {
    const params = new URLSearchParams(initData);
    const hash   = params.get('hash');
    if (!hash) return null;
    params.delete('hash');
    const str    = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`).join('\n');
    const secret   = createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
    const expected = createHmac('sha256', secret).update(str).digest('hex');
    if (expected !== hash) return null;
    const authDate = Number(params.get('auth_date') || '0');
    if (Math.floor(Date.now() / 1000) - authDate > 86400) return null;
    const user = JSON.parse(params.get('user') || '{}');
    return user.id || null;
  } catch { return null; }
}

async function notifyAdmin(tgId: string, count: number): Promise<void> {
  if (!ADMIN_TG_ID || !BOT_TOKEN) {
    console.error('[ping] notifyAdmin: BOT_TOKEN или ADMIN_TG_ID не заданы!');
    return;
  }
  try {
    const resp = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id:    ADMIN_TG_ID,
          text:       `⚠️ <b>OrthoByNekruz — подозрительная активность</b>\n\nTelegram ID: <code>${tgId}</code>\nОткрытий сегодня: <b>${count}</b>\n\nВозможно аккаунт используется несколькими людьми.`,
          parse_mode: 'HTML',
        }),
      }
    );
    const data = await resp.json();
    if (!data.ok) {
      console.error('[ping] Telegram error:', JSON.stringify(data));
    } else {
      console.log('[ping] Уведомление отправлено! userId:', tgId, 'opens:', count);
    }
  } catch (e) {
    console.error('[ping] fetch error:', e);
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { telegramId, initData } = req.body;

    if (!telegramId || !initData) {
      console.error('[ping] Missing telegramId or initData');
      return res.status(400).json({ ok: false, reason: 'missing' });
    }

    const userId = verifyInitData(initData);
    if (!userId || String(userId) !== String(telegramId)) {
      console.error('[ping] auth failed. userId:', userId, 'tgId:', telegramId);
      return res.status(401).json({ ok: false, reason: 'auth' });
    }

    const tgId  = String(telegramId);

    // ── ПРОВЕРКА БЛОКИРОВКИ ──────────────────────────────────────────────────
    const userData: any = await redis.get(`user_id:${tgId}`);
    if (userData?.blocked === true) {
      console.log(`[ping] blocked user: ${tgId}`);
      return res.status(200).json({ ok: true, blocked: true });
    }

    const today = new Date().toISOString().slice(0, 10);
    const actKey      = `opens:${tgId}:${today}`;
    const notifiedKey = `opens_notified:${tgId}:${today}`;

    const count = await redis.incr(actKey);
    if (count === 1) await redis.expire(actKey, 48 * 3600);

    console.log(`[ping] userId=${tgId} opens=${count} limit=${DAILY_OPEN_LIMIT}`);

    if (count >= DAILY_OPEN_LIMIT) {
      const alreadyNotified = await redis.exists(notifiedKey);
      if (!alreadyNotified) {
        await redis.set(notifiedKey, '1', { ex: 48 * 3600 });

        const user: any = await redis.get(`user_id:${tgId}`);
        if (user && typeof user === 'object') {
          await redis.set(`user_id:${tgId}`, {
            ...user,
            blocked:       true,
            blockedReason: 'activity',
            blockedAt:     new Date().toISOString(),
          });
        }

        await notifyAdmin(tgId, count);
      } else {
        console.log('[ping] уже уведомляли сегодня, пропускаем');
      }
    }

    return res.status(200).json({ ok: true, opens: count });

  } catch (err) {
    console.error('[ping] error:', err);
    return res.status(500).json({ ok: false });
  }
}