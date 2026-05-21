import type { NextApiRequest, NextApiResponse } from 'next';

const ADMIN_SECRET     = process.env.ADMIN_SECRET   || '';
const SUPABASE_URL     = process.env.SUPABASE_URL   || '';
const SERVICE_KEY      = process.env.SUPABASE_SERVICE_KEY || '';
const BUCKET           = 'materials'; // Убедись, что бакет называется именно так в панели Supabase

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

  // Создаем безопасное имя файла
  const safeName = `${Date.now()}_${String(filename).replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const path = `${BUCKET}/${safeName}`;

  try {
    // Делаем запрос к API Supabase для получения signed URL
    const signRes = await fetch(
      `${SUPABASE_URL}/storage/v1/object/create-signed-upload-url/${path}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'apikey': SERVICE_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}), 
      }
    );

    const data = await signRes.json();

    if (!signRes.ok) {
      console.error('[admin-upload-sign] Supabase error:', signRes.status, data);
      return res.status(502).json({ error: data.message || 'Failed to get signed URL' });
    }

    // data.signedUrl — это то, что возвращает Supabase API
    // Формируем полный URL
    const signedUrl = data.signedUrl.startsWith('http')
      ? data.signedUrl
      : `${SUPABASE_URL}/storage/v1/object/upload/sign/${path}?token=${data.token}`;

    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${path}`;

    return res.status(200).json({ signedUrl, publicUrl });
    
  } catch (err) {
    console.error('[admin-upload-sign] Error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}