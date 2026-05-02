// pages/api/micro-data.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { Redis }      from '@upstash/redis';
import { createHmac } from 'crypto';

const redis     = Redis.fromEnv();
const BOT_TOKEN = process.env.BOT_TOKEN || '';

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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { type, telegramId, initData } = req.body;

    if (!initData || !BOT_TOKEN || !telegramId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = verifyInitData(initData);
    if (!userId || String(userId) !== String(telegramId)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user: any = await redis.get(`user_id:${telegramId}`);
    if (!user || user.micro !== true) {
      return res.status(403).json({ error: 'No micro access' });
    }

    if (type === 'questions') {
      const data = require('../../data/micro_questions.json');
      return res.status(200).json({ data });
    }
    if (type === 'tasks') {
      const data = require('../../data/micro_tasks.json');
      return res.status(200).json({ data });
    }
    if (type === 'tests') {
      const data = require('../../data/micro_tests.json');
      return res.status(200).json({ data });
    }

    return res.status(400).json({ error: 'Unknown type' });

  } catch (err) {
    console.error('micro-data error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}