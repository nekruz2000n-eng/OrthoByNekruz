// pages/api/test-notify.ts  ← Pages Router формат
// ⚠️ ТОЛЬКО ДЛЯ ДИАГНОСТИКИ — удали после теста!
import type { NextApiRequest, NextApiResponse } from 'next';

const BOT_TOKEN   = process.env.BOT_TOKEN   || '';
const ADMIN_TG_ID = process.env.ADMIN_TG_ID || '';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const result: Record<string, any> = {
    BOT_TOKEN_set:     !!BOT_TOKEN,
    ADMIN_TG_ID_set:   !!ADMIN_TG_ID,
    ADMIN_TG_ID_value: ADMIN_TG_ID || '(пусто)',
  };

  if (!BOT_TOKEN || !ADMIN_TG_ID) {
    return res.status(200).json({ ...result, error: 'env vars not set!' });
  }

  try {
    const resp = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id:    ADMIN_TG_ID,
          text:       '🔧 Тест уведомлений OrthoByNekruz работает!',
          parse_mode: 'HTML',
        }),
      }
    );
    const data = await resp.json();
    result.telegram_response = data;
    result.success = data.ok === true;
  } catch (e: any) {
    result.error   = e.message;
    result.success = false;
  }

  return res.status(200).json(result);
}
