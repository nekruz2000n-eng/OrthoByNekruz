import type { NextApiRequest, NextApiResponse } from 'next';
import { Redis } from '@upstash/redis';
import { verifyInitDataUser } from '@/lib/verifyInitData';

const redis        = Redis.fromEnv();
const ADMIN_SECRET = process.env.ADMIN_SECRET || '';
const ADMIN_TG_ID  = '978243325';
const BOT_TOKEN    = process.env.BOT_TOKEN    || '';

function verifyAdmin(initData: string, secret: string): boolean {
  if (!ADMIN_SECRET || secret !== ADMIN_SECRET) return false;
  if (!BOT_TOKEN) return false;
  const tgUser = verifyInitDataUser(initData, BOT_TOKEN);
  if (!tgUser || String(tgUser.id) !== ADMIN_TG_ID) return false;
  return true;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // GET — публичный (AuthScreen + Watermark читают настройки при загрузке)
  if (req.method === 'GET') {
    const isDemoEnabled = await redis.get('settings:is_demo_enabled');
    return res.status(200).json({
      isDemoEnabled: isDemoEnabled ?? true,
    });
  }

  // POST — только админ с валидной initData и секретом
  if (req.method === 'POST') {
    const { initData, secret, isDemoEnabled } = req.body ?? {};
    if (!initData || !secret || !verifyAdmin(String(initData), String(secret))) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (typeof isDemoEnabled !== 'undefined') {
      await redis.set('settings:is_demo_enabled', Boolean(isDemoEnabled));
    }
    const demo = await redis.get('settings:is_demo_enabled');
    return res.status(200).json({
      success:       true,
      isDemoEnabled: demo ?? true,
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
