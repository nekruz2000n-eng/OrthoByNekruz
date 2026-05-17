import type { NextApiRequest, NextApiResponse } from 'next';
import { Redis } from '@upstash/redis';

const redis        = Redis.fromEnv();
const ADMIN_SECRET = process.env.ADMIN_SECRET || '';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const { secret } = req.body ?? {};
  if (!secret || secret !== ADMIN_SECRET) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const version = await redis.incr('cache_version');
    return res.status(200).json({ version });
  } catch (err) {
    console.error('[admin-cache-bust]', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
