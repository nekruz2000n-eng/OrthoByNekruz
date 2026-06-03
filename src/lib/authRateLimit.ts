type RedisScanDel = {
  scan: (cursor: number, opts: { match: string; count: number }) => Promise<[number | string, string[]]>;
  del:  (...keys: [string, ...string[]]) => Promise<unknown>;
};

/** Снимает block/rate/viol для tgId и demo_{tgId} (все IP). */
export async function clearAuthRateLimitsForTgId(redis: RedisScanDel, tgId: string): Promise<number> {
  const id = String(tgId).trim();
  const suffixes = [id, `demo_${id}`];
  const prefixes = ['block', 'rate', 'viol'];
  let deleted = 0;

  for (const suffix of suffixes) {
    for (const prefix of prefixes) {
      const pattern = `${prefix}:*:${suffix}`;
      let cur = 0;
      do {
        const [nextCur, keys] = await redis.scan(cur, { match: pattern, count: 100 });
        cur = Number(nextCur);
        if (keys.length > 0) {
          await redis.del(...(keys as [string, ...string[]]));
          deleted += keys.length;
        }
      } while (cur !== 0);
    }
  }

  return deleted;
}

/** Из ключа block:{ip}:{suffix} достаёт TG ID для отображения в админке. */
export function tgIdFromRateBlockKey(key: string): string | null {
  const suffix = key.split(':').pop() ?? '';
  const id = suffix.startsWith('demo_') ? suffix.slice(5) : suffix;
  return /^\d{5,12}$/.test(id) ? id : null;
}
