// pages/api/admin-resources.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { Redis } from '@upstash/redis';
import type { Resource } from './resources';

const redis        = Redis.fromEnv();
const ADMIN_SECRET = process.env.ADMIN_SECRET || '';

async function getResources(subjectId: string): Promise<Resource[]> {
  const raw = await redis.get(`resources:${subjectId}`);
  if (Array.isArray(raw)) return raw as Resource[];
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return []; }
  }
  return [];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { action, subjectId, resource, resourceId, secret } = req.body;

  if (!ADMIN_SECRET || secret !== ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!subjectId) return res.status(400).json({ error: 'subjectId required' });

  // ── Список ────────────────────────────────────────────────────────────────
  if (action === 'list') {
    const resources = await getResources(subjectId);
    return res.status(200).json({ ok: true, resources });
  }

  // ── Добавить ──────────────────────────────────────────────────────────────
  if (action === 'add') {
    if (!resource?.title || !resource?.url || !resource?.type) {
      return res.status(400).json({ error: 'title, url, type required' });
    }
    const newResource: Resource = {
      id:          `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type:        resource.type,
      title:       resource.title.trim(),
      url:         resource.url.trim(),
      description: (resource.description || '').trim(),
    };
    const resources = await getResources(subjectId);
    resources.push(newResource);
    await redis.set(`resources:${subjectId}`, resources);
    return res.status(200).json({ ok: true, resource: newResource, resources });
  }

  // ── Удалить ───────────────────────────────────────────────────────────────
  if (action === 'delete') {
    if (!resourceId) return res.status(400).json({ error: 'resourceId required' });
    const resources = await getResources(subjectId);
    const updated   = resources.filter(r => r.id !== resourceId);
    await redis.set(`resources:${subjectId}`, updated);
    return res.status(200).json({ ok: true, resources: updated });
  }

  return res.status(400).json({ error: 'Unknown action. Use: list | add | delete' });
}
