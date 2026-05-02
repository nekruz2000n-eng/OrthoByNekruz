// pages/api/ping.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { Redis }      from '@upstash/redis';
import { createHmac } from 'crypto';

const redis           = Redis.fromEnv();
const BOT_TOKEN       = process.env.BOT_TOKEN       || '';
const ADMIN_TG_ID     = process.env.ADMIN_TG_ID     || '';
const DAILY_OPEN_LIMIT = 5; // открытий в сутки — подозрительно

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
  if (!ADMIN_TG_ID || !BOT_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id:    ADMIN_TG_ID,
        text:       `⚠️ <b>OrthoByNekruz — подозрительная активность</b>\n\nTelegram ID: <code>${tgId}</code>\nОткрытий сегодня: <b>${count}</b>\n\nВозможно аккаунт используется несколькими людьми.\nПользователь автоматически заблокирован.`,
        parse_mode: 'HTML',
      }),
    });
  } catch {}
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { telegramId, initData } = req.body;
    if (!telegramId || !initData) return res.status(400).json({ ok: false });

    // Верифицируем initData
    const userId = verifyInitData(initData);
    if (!userId || String(userId) !== String(telegramId)) {
      return res.status(401).json({ ok: false });
    }

    const tgId = String(telegramId);

    // Считаем открытия за сутки
    const today  = new Date().toISOString().slice(0, 10);
    const actKey = `opens:${tgId}:${today}`;
    const count  = await redis.incr(actKey);
    if (count === 1) await redis.expire(actKey, 48 * 3600);

    // При достижении лимита — блокируем и уведомляем
    if (count === DAILY_OPEN_LIMIT) {
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
    }

    return res.status(200).json({ ok: true, opens: count });

  } catch (err) {
    console.error('ping error:', err);
    return res.status(500).json({ ok: false });
  }
}