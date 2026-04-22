import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { key, telegramId } = await request.json();
    if (!key || !telegramId) return NextResponse.json({ error: 'Missing data' }, { status: 400 });

    const linkedTgId = await kv.get(`link:${key}`);
    if (linkedTgId && String(linkedTgId) !== String(telegramId)) {
      return NextResponse.json({ error: 'Key already used' }, { status: 403 });
    }

    const wasRemoved = await kv.srem('valid_keys', key);
    if (wasRemoved === 1 || linkedTgId) {
      await kv.set(`link:${key}`, telegramId);
      await kv.hset('user_registry', { [telegramId]: key });
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: 'Invalid key' }, { status: 401 });
  } catch (e) { return NextResponse.json({ error: 'Server error' }, { status: 500 }); }
}