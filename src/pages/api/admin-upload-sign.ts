import type { NextApiRequest, NextApiResponse } from 'next';

const ADMIN_SECRET   = process.env.ADMIN_SECRET   || '';
const SUPABASE_URL   = process.env.SUPABASE_URL   || '';
const SERVICE_KEY    = process.env.SUPABASE_SERVICE_KEY || '';
const BUCKET         = 'materials';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { secret, filename, contentType } = req.body ?? {};

  if (!secret || String(secret) !== ADMIN_SECRET) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (!filename || !contentType) {
    return res.status(400).json({ error: 'filename and contentType required' });
  }
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  // Sanitize: keep only safe chars, prepend timestamp to avoid collisions
  const safeName = `${Date.now()}_${String(filename).replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    // 1. Формируем правильный путь к файлу
  const path = `${BUCKET}/${safeName}`;

  // 2. Делаем запрос к API Supabase для получения signed URL
  const signRes = await fetch(
    `${SUPABASE_URL}/storage/v1/object/create-signed-upload-url/${path}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'apikey': SERVICE_KEY, // Важно: для Supabase API нужен apikey
        'Content-Type': 'application/json',
      },
      // Тело можно оставить пустым или передать параметры, если нужно
      body: JSON.stringify({}), 
    },
  );

  if (!signRes.ok) {
    const text = await signRes.text().catch(() => '');
    console.error('[admin-upload-sign] Supabase error:', signRes.status, text);
    return res.status(502).json({ error: 'Failed to get signed URL' });
  }

  const data = await signRes.json();
  // data.signedURL is relative (/storage/v1/object/upload/sign/...)
  const signedUrl = data.signedURL?.startsWith('http')
    ? data.signedURL
    : `${SUPABASE_URL}${data.signedURL}`;

  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${safeName}`;

  return res.status(200).json({ signedUrl, publicUrl });
}
