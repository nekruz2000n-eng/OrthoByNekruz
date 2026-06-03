import { SUBJECTS, createDefaultSubjects, getUserAvailableSubjects } from '@/lib/subjects';
import type { FacultyPromo } from '@/lib/facultyCodes';
import { getNavHiddenForSubject } from '@/lib/subjectCatalog';

export const PREVIEW_DURATION_MS = 5 * 60 * 1000;

export type PreviewStatus = 'selecting' | 'active' | 'expired' | 'confirmed';

export function isPreviewUser(user: any): boolean {
  return !!user?.previewStatus;
}

export function isPreviewExpired(user: any, now = Date.now()): boolean {
  if (user?.previewStatus !== 'active') return false;
  const started = user.previewStartedAt;
  if (!started) return true;
  return now - Date.parse(started) >= PREVIEW_DURATION_MS;
}

export function previewEndsAt(user: any): string | null {
  if (user?.previewStatus !== 'active' || !user.previewStartedAt) return null;
  return new Date(Date.parse(user.previewStartedAt) + PREVIEW_DURATION_MS).toISOString();
}

export function getAllPickableSubjectIds(): string[] {
  return SUBJECTS.map(s => s.id);
}

type RedisSetOps = {
  sismember: (key: string, member: string | number) => Promise<unknown>;
  srem:      (key: string, ...members: (string | number)[]) => Promise<unknown>;
  smembers:  (key: string) => Promise<unknown>;
};

/** Снимает блокировку «пробный уже использован» для TG ID (string/number в Redis). */
export async function clearPreviewTrialLock(redis: RedisSetOps, tgId: string) {
  const id = String(tgId).trim();
  await redis.srem('used_demo_ids', id);
  const num = Number(id);
  if (Number.isSafeInteger(num)) await redis.srem('used_demo_ids', num);
  try {
    const members = await redis.smembers('used_demo_ids');
    if (Array.isArray(members)) {
      for (const m of members) {
        if (String(m) === id) await redis.srem('used_demo_ids', m as string | number);
      }
    }
  } catch { /* ignore */ }
}

export async function isPreviewTrialLocked(redis: RedisSetOps, tgId: string): Promise<boolean> {
  const id = String(tgId).trim();
  if (await redis.sismember('used_demo_ids', id)) return true;
  const num = Number(id);
  if (Number.isSafeInteger(num) && await redis.sismember('used_demo_ids', num)) return true;
  return false;
}

export function buildSelectingPreviewUser(
  profile: {
    username: string | null;
    firstName: string | null;
    lastName: string | null;
  },
  promo?: FacultyPromo,
) {
  const now = new Date().toISOString();
  return {
    activatedKey:       promo ? `promo:${promo.id}` : null,
    previewStatus:      'selecting' as PreviewStatus,
    previewFaculty:     promo?.facultyLabel ?? null,
    facultyId:          promo?.id ?? null,
    promoCode:          promo?.code ?? null,
    subjects:           createDefaultSubjects(),
    date:               now,
    username:           profile.username,
    firstName:          profile.firstName,
    lastName:           profile.lastName,
    _migrated_subjects: true,
    loginCount:         0,
  };
}

export function buildActivePreviewUser(user: any, subjectId: string) {
  const subjects = createDefaultSubjects();
  subjects[subjectId] = true;
  const now = new Date().toISOString();
  const hiddenTabs = getNavHiddenForSubject(subjectId);

  return {
    ...user,
    previewStatus:        'active' as PreviewStatus,
    previewChosenSubject: subjectId,
    previewStartedAt:     now,
    previewPickedAt:      now,
    subjects,
    navHidden:            hiddenTabs.length ? { [subjectId]: hiddenTabs } : {},
    _migrated_subjects:   true,
  };
}

export function expirePreviewUser(user: any) {
  const subjects = createDefaultSubjects();
  return {
    ...user,
    previewStatus:    'expired' as PreviewStatus,
    previewExpiredAt: new Date().toISOString(),
    subjects,
  };
}

export function confirmPreviewUser(user: any) {
  const chosen = user.previewChosenSubject;
  if (!chosen) return user;
  const subjects = createDefaultSubjects();
  subjects[chosen] = true;
  const now = new Date().toISOString();
  const hiddenTabs = getNavHiddenForSubject(chosen);

  return {
    ...user,
    previewStatus:      'confirmed' as PreviewStatus,
    previewConfirmedAt: now,
    activatedKey:       user.activatedKey && !String(user.activatedKey).startsWith('promo:')
      ? user.activatedKey
      : (user.activatedKey || 'preview'),
    subjects,
    navHidden:          hiddenTabs.length ? { [chosen]: hiddenTabs } : {},
    [`${chosen}_grantedAt`]: now,
    _migrated_subjects: true,
  };
}

export function getEffectiveUserSubjects(user: any): string[] {
  if (!user) return [];
  if (user.previewStatus === 'selecting' || user.previewStatus === 'expired') return [];
  if (user.previewStatus === 'active' && isPreviewExpired(user)) return [];
  return getUserAvailableSubjects(user);
}

export async function maybeExpirePreviewUser(
  redis: { get: (k: string) => Promise<any>; set: (k: string, v: any) => Promise<any> },
  tgId: string,
  user: any,
): Promise<any> {
  if (!user || user.previewStatus !== 'active' || !isPreviewExpired(user)) return user;
  const expired = expirePreviewUser(user);
  await redis.set(`user_id:${tgId}`, expired);
  return expired;
}
