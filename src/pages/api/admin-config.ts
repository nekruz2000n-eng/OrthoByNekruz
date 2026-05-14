import type { NextApiRequest, NextApiResponse } from 'next';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 1. Получение настроек (доступно всем для AuthScreen)
  if (req.method === 'GET') {
    const isDemoEnabled = await redis.get('settings:is_demo_enabled');
    // Если в базе ничего нет, по умолчанию считаем true
    return res.status(200).json({ isDemoEnabled: isDemoEnabled ?? true });
  }

  // 2. Изменение настроек (ВАЖНО: здесь должна быть проверка на админа)
  if (req.method === 'POST') {
    const { isDemoEnabled } = req.body;

    // В будущем сюда стоит добавить проверку initData, 
    // чтобы только ты мог менять этот параметр
    await redis.set('settings:is_demo_enabled', isDemoEnabled);
    
    return res.status(200).json({ success: true, isDemoEnabled });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}