import type { NextApiRequest, NextApiResponse } from 'next';

const ADMIN_SECRET = process.env.ADMIN_SECRET || '';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY || '';
const BUCKET       = 'materials'; 

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { secret, filename, contentType } = req.body ?? {};

  if (!secret || String(secret) !== ADMIN_SECRET) return res.status(403).json({ error: 'Forbidden' });
  if (!filename || !contentType) return res.status(400).json({ error: 'Missing params' });

  const safeName = `${Date.now()}_${String(filename).replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  
  // Пытаемся использовать официальный REST API для создания signed upload URL
  // Путь: /storage/v1/object/create-signed-upload-url/{bucket}/{path}
  const url = `${SUPABASE_URL}/storage/v1/object/create-signed-upload-url/${BUCKET}/${encodeURIComponent(safeName)}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'apikey': SERVICE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[DEBUG] Supabase API failed:', { 
        url, 
        status: response.status, 
        data 
      });
      return res.status(response.status).json(data);
    }

    return res.status(200).json({ 
      signedUrl: data.signedUrl, 
      publicUrl: `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${safeName}` 
    });
  } catch (err) {
    return res.status(500).json({ error: 'System error' });
  }
}