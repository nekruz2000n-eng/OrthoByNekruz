import { SUBJECTS, createDefaultSubjects, getUserAvailableSubjects } from '@/lib/subjects';
import type { FacultyPromo } from '@/lib/facultyCodes';
import { getNavHiddenForSubject } from '@/lib/subjectCatalog';
import {
  type PreviewModule,
  normalizePreviewModules,
} from '@/lib/previewModules';

export type { PreviewModule } from '@/lib/previewModules';
export { PREVIEW_MODULE_LABELS, formatPreviewModulesList, normalizePreviewModules } from '@/lib/previewModules';

/** Скрыть всё, что пользователь не выбрал + exam/materials + нет JSON */
export function buildNavHiddenForPreview(
  subjectId: string,
  chosenModules: PreviewModule[],
): string[] {
  const hidden = new Set<string>(['exam', 'materials']);
  for (const tab of ['questions', 'tests', 'tasks'] as PreviewModule[]) {
    if (!chosenModules.includes(tab)) hidden.add(tab);
  }
  for (const tab of getNavHiddenForSubject(subjectId)) {
    hidden.add(tab);
  }
  return [...hidden];
}

export const PREVIEW_DURATION_MS = 10 * 60 * 1000;

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

/** Аккаунт с ключом или уже выданными предметами (не новый гость по коду). */
export function isEstablishedAccount(user: any): boolean {
  if (!user) return false;
  const key = String(user.activatedKey || '').trim();
  if (/^\d{8}$/.test(key)) return true;
  if (user.previewStatus === 'confirmed') return true;
  const granted = getUserAvailableSubjects(user);
  return granted.length > 0 && user.previewStatus !== 'selecting' && user.previewStatus !== 'active';
}

/** Предмет уже был открыт до витрины (админ / ключ). */
export function userAlreadyHasSubjectAccess(user: any, subjectId: string): boolean {
  if (!user) return false;
  if (user.subjects && typeof user.subjects === 'object') {
    return user.subjects[subjectId] === true;
  }
  return getUserAvailableSubjects(user).includes(subjectId);
}

function snapshotSubjects(user: any): Record<string, boolean> | null {
  if (user?.subjects && typeof user.subjects === 'object') {
    const snap = { ...user.subjects };
    if (Object.values(snap).some(v => v === true)) return snap;
  }
  const granted = getUserAvailableSubjects(user);
  if (granted.length === 0) return null;
  const snap = createDefaultSubjects();
  for (const id of granted) snap[id] = true;
  return snap;
}

/** Новый предмет в заявке — нужно подтверждение админа (докупка или первый доступ). */
export function previewChoiceNeedsAdminConfirm(user: any): boolean {
  const chosen = user?.previewChosenSubject;
  if (!chosen) return false;
  if (user.previewStatus !== 'active' && user.previewStatus !== 'expired') return false;
  if (user.previewFacultyRecordedAt && !user.previewStartedAt) return false;

  const grants = user._subjectsBeforePreview && typeof user._subjectsBeforePreview === 'object'
    ? user._subjectsBeforePreview
    : user.subjects && typeof user.subjects === 'object'
      ? user.subjects
      : null;

  if (grants) return grants[chosen] !== true;
  return true;
}

/** У пользователя уже были другие предметы — заявка на докупку. */
export function previewChoiceIsAddon(user: any): boolean {
  if (!previewChoiceNeedsAdminConfirm(user)) return false;
  const chosen = user.previewChosenSubject;
  const grants = user._subjectsBeforePreview && typeof user._subjectsBeforePreview === 'object'
    ? user._subjectsBeforePreview
    : user.subjects && typeof user.subjects === 'object'
      ? user.subjects
      : null;
  if (grants) {
    return Object.entries(grants).some(([id, v]) => v === true && id !== chosen);
  }
  return /^\d{8}$/.test(String(user.activatedKey || '').trim());
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

/** Код из канала для уже существующего аккаунта — витрина без сброса доступа. */
export function buildSelectingPreviewUserFromExisting(
  user: any,
  profile: {
    username: string | null;
    firstName: string | null;
    lastName: string | null;
  },
  promo: FacultyPromo,
) {
  const now = new Date().toISOString();
  return {
    ...user,
    previewStatus:              'selecting' as PreviewStatus,
    previewFaculty:             promo.facultyLabel,
    facultyId:                  promo.id,
    promoCode:                  promo.code,
    previewChosenSubject:       null,
    previewChosenModules:       null,
    previewStartedAt:           null,
    previewExpiredAt:           null,
    _previewStatusBeforeCatalog: user.previewStatus ?? null,
    username:                   profile.username ?? user.username,
    firstName:            profile.firstName ?? user.firstName,
    lastName:             profile.lastName ?? user.lastName,
    lastLogin:            now,
    loginCount:           Number(user.loginCount || 0) + 1,
    _migrated_subjects:   true,
  };
}

/** Выбран уже открытый предмет — только фиксируем факультет, доступ не меняем. */
export function recordFacultyChoiceOnly(
  user: any,
  subjectId: string,
  chosenModules: PreviewModule[],
) {
  const now = new Date().toISOString();
  const prev = user._previewStatusBeforeCatalog;
  const restoreStatus = prev === 'confirmed' ? 'confirmed' : null;
  return {
    ...user,
    previewStatus:            restoreStatus,
    previewChosenSubject:     subjectId,
    previewChosenModules:     chosenModules,
    previewFacultyRecordedAt: now,
    previewStartedAt:         null,
    previewExpiredAt:         null,
    _subjectsBeforePreview:     undefined,
    _previewStatusBeforeCatalog: undefined,
  };
}

export function buildActivePreviewUser(
  user: any,
  subjectId: string,
  chosenModules: PreviewModule[],
) {
  const before = snapshotSubjects(user);
  const subjects = before ? { ...before } : createDefaultSubjects();
  subjects[subjectId] = true;
  const now = new Date().toISOString();
  const hiddenTabs = buildNavHiddenForPreview(subjectId, chosenModules);
  const navHidden = { ...(user.navHidden || {}), [subjectId]: hiddenTabs };

  return {
    ...user,
    previewStatus:          'active' as PreviewStatus,
    previewChosenSubject:   subjectId,
    previewChosenModules:   chosenModules,
    previewStartedAt:       now,
    previewPickedAt:          now,
    subjects,
    navHidden,
    _subjectsBeforePreview: before,
    _migrated_subjects:     true,
  };
}

export function expirePreviewUser(user: any) {
  if (user._subjectsBeforePreview && typeof user._subjectsBeforePreview === 'object') {
    return {
      ...user,
      previewStatus:          'expired' as PreviewStatus,
      previewExpiredAt:       new Date().toISOString(),
      subjects:               { ...user._subjectsBeforePreview },
      _subjectsBeforePreview: undefined,
    };
  }
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
  let modules = normalizePreviewModules(user.previewChosenModules);
  if (!chosen) return user;
  if (modules.length === 0) {
    modules = (['questions', 'tests', 'tasks'] as PreviewModule[]).filter(
      m => !getNavHiddenForSubject(chosen).includes(m),
    );
  }
  if (modules.length === 0) return user;

  const subjects = user._subjectsBeforePreview && typeof user._subjectsBeforePreview === 'object'
    ? { ...user._subjectsBeforePreview }
    : user.subjects && typeof user.subjects === 'object'
      ? { ...user.subjects }
      : createDefaultSubjects();
  subjects[chosen] = true;
  const now = new Date().toISOString();
  const hiddenTabs = buildNavHiddenForPreview(chosen, modules);
  const navHidden = { ...(user.navHidden || {}), [chosen]: hiddenTabs };

  return {
    ...user,
    previewStatus:           'confirmed' as PreviewStatus,
    previewConfirmedAt:      now,
    paid:                    user.paid === true,
    activatedKey:            user.activatedKey && !String(user.activatedKey).startsWith('promo:')
      ? user.activatedKey
      : (user.activatedKey || 'preview'),
    subjects,
    navHidden,
    [`${chosen}_grantedAt`]: now,
    _subjectsBeforePreview:  undefined,
    _migrated_subjects:      true,
  };
}

export function getEffectiveUserSubjects(user: any): string[] {
  if (!user) return [];
  if (user.previewStatus === 'selecting') return [];
  if (user.previewStatus === 'active' && isPreviewExpired(user)) {
    return getUserAvailableSubjects(user);
  }
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
