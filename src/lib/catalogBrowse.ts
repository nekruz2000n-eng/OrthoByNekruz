import type { Redis } from '@upstash/redis';
import type { FacultyPromo } from '@/lib/facultyCodes';
import { buildSelectingPreviewUserFromExisting } from '@/lib/preview';

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

const dailyKey = (tgId: string) => `catalog_daily:${String(tgId).trim()}`;

/** Уже был 10‑минутный просмотр каталога сегодня. */
export async function isCatalogDailySessionUsed(redis: Redis, tgId: string): Promise<boolean> {
  const val = await redis.get(dailyKey(tgId));
  return val === todayUtc();
}

export async function markCatalogDailySessionUsed(redis: Redis, tgId: string): Promise<void> {
  await redis.set(dailyKey(tgId), todayUtc(), { ex: 48 * 3600 });
}

/** Витрина из приложения для оплаченного аккаунта — отдельно от первого входа по коду канала. */
export function buildCatalogSelectingUser(
  user: any,
  profile: {
    username: string | null;
    firstName: string | null;
    lastName: string | null;
  },
  promo: FacultyPromo,
) {
  const hasGroup = !!String(user?.studyGroup || '').trim();
  const sameFaculty = !user?.facultyId || user.facultyId === promo.id;
  const forceNewGroup = !(hasGroup && sameFaculty);
  return {
    ...buildSelectingPreviewUserFromExisting(user, profile, promo, { forceNewGroup }),
    _catalogBrowse: true,
  };
}
