import type { NextApiRequest, NextApiResponse } from 'next';
import { Redis } from '@upstash/redis';
import { createHmac } from 'crypto';

const redis        = Redis.fromEnv();
const ADMIN_SECRET = process.env.ADMIN_SECRET || '';
const ADMIN_TG_ID  = '978243325';
const BOT_TOKEN    = process.env.BOT_TOKEN    || '';

// Криптографическая проверка initData от Telegram (копия из admin-users.ts).
function verifyTelegramInitData(initData: string, botToken: string): { id: number; [key: string]: any } | null {
  try {
    const params = new URLSearchParams(initData);
    const hash   = params.get('hash');
    if (!hash) return null;
    params.delete('hash');
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');
    const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
    const expected  = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    if (expected !== hash) return null;
    const authDate = Number(params.get('auth_date') || '0');
    if (Math.floor(Date.now() / 1000) - authDate > 86400) return null;
    const userStr = params.get('user');
    if (!userStr) return null;
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

function verifyAdmin(initData: string, secret: string): boolean {
  if (!ADMIN_SECRET || secret !== ADMIN_SECRET) return false;
  if (!BOT_TOKEN) return false;
  const tgUser = verifyTelegramInitData(initData, BOT_TOKEN);
  if (!tgUser || String(tgUser.id) !== ADMIN_TG_ID) return false;
  return true;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // GET — публичный (AuthScreen + Watermark читают настройки при загрузке)
  if (req.method === 'GET') {
    const [isDemoEnabled, isWatermarkEnabled] = await Promise.all([
      redis.get('settings:is_demo_enabled'),
      redis.get('settings:is_watermark_enabled'),
    ]);
    return res.status(200).json({
      isDemoEnabled:      isDemoEnabled      ?? true,
      isWatermarkEnabled: isWatermarkEnabled ?? true,
    });
  }

  // POST — только админ с валидной initData и секретом
  if (req.method === 'POST') {
    const { initData, secret, isDemoEnabled, isWatermarkEnabled } = req.body ?? {};
    if (!initData || !secret || !verifyAdmin(String(initData), String(secret))) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    // Обновляем только переданные поля — частичный апдейт
    if (typeof isDemoEnabled !== 'undefined') {
      await redis.set('settings:is_demo_enabled', Boolean(isDemoEnabled));
    }
    if (typeof isWatermarkEnabled !== 'undefined') {
      await redis.set('settings:is_watermark_enabled', Boolean(isWatermarkEnabled));
    }
    const [demo, wm] = await Promise.all([
      redis.get('settings:is_demo_enabled'),
      redis.get('settings:is_watermark_enabled'),
    ]);
    return res.status(200).json({
      success:            true,
      isDemoEnabled:      demo ?? true,
      isWatermarkEnabled: wm   ?? true,
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
