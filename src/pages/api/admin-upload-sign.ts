import type { NextApiRequest, NextApiResponse } from 'next';

const ADMIN_SECRET = process.env.ADMIN_SECRET || '';
const SUPABASE_URL = process.env.SUPABASE_URL || ''; // Проверь: БЕЗ слэша на конце!
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY || '';
const BUCKET       = 'materials';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { secret, filename, contentType } = req.body ?? {};

  if (!secret || String(secret) !== ADMIN_SECRET) return res.status(403).json({ error: 'Forbidden' });
  if (!filename || !contentType) return res.status(400).json({ error: 'Missing params' });

  // Создаем безопасное имя файла
  const safeName = `${Date.now()}_${String(filename).replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const path = `${BUCKET}/${safeName}`;

  try {
    // Используем REST API для генерации подписанного URL
    const url = `${SUPABASE_URL}/storage/v1/object/create-signed-upload-url/${path}`;

    const signRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'apikey': SERVICE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}), // Supabase ожидает пустой объект
    });

    const data = await signRes.json();

    if (!signRes.ok) {
      console.error('[admin-upload-sign] Error:', { status: signRes.status, data });
      return res.status(signRes.status).json({ error: data.message || 'Supabase API Error' });
    }

    return res.status(200).json({ 
      signedUrl: data.signedUrl, 
      publicUrl: `${SUPABASE_URL}/storage/v1/object/public/${path}` 
    });
    
  } catch (err) {
    console.error('[admin-upload-sign] System Error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}