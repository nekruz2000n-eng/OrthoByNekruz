import type { NextApiRequest, NextApiResponse } from 'next';

const ADMIN_SECRET = process.env.ADMIN_SECRET   || '';
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const BUCKET       = 'materials';

export const config = {
  api: { bodyParser: { sizeLimit: '50mb' } },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { secret, filename, contentType, fileBase64 } = req.body ?? {};

  if (!secret || String(secret) !== ADMIN_SECRET) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (!filename || !contentType || !fileBase64) {
    return res.status(400).json({ error: 'filename, contentType and fileBase64 required' });
  }
  if (!SUPABASE_URL || !SERVICE_KEY || !SUPABASE_URL.startsWith('https://')) {
    return res.status(500).json({
      error: `Supabase not configured`,
      debug: {
        SUPABASE_URL_value: (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '(empty)').slice(0, 40),
        SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY ? 'set' : 'missing',
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'set' : 'missing',
      },
    });
  }

  const safeName = `${Date.now()}_${String(filename).replace(/[^a-zA-Z0-9._-]/g, '_')}`;

  try {
    const buffer = Buffer.from(String(fileBase64), 'base64');
    const blob   = new Blob([buffer], { type: String(contentType) });
    const form   = new FormData();
    form.append('file', blob, safeName);

    const uploadRes = await fetch(
      `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${safeName}`,
      {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'x-upsert':      'false',
        },
        body: form,
      },
    );

    if (!uploadRes.ok) {
      const text = await uploadRes.text().catch(() => '');
      console.error('[admin-upload] Supabase error:', uploadRes.status, text);
      return res.status(502).json({ error: 'Upload failed', detail: text });
    }

    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${safeName}`;
    return res.status(200).json({ publicUrl });
  } catch (err) {
    console.error('[admin-upload]', err);
    return res.status(500).json({ error: String(err) });
  }
}
