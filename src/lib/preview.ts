import { SUBJECTS, createDefaultSubjects, getUserAvailableSubjects } from '@/lib/subjects';
import type { FacultyPromo } from '@/lib/facultyCodes';
import { getNavHiddenForSubject } from '@/lib/subjectCatalog';
import {
  type PreviewModule,
  normalizePreviewModules,
} from '@/lib/previewModules';
import {
  buildNavHiddenForCatalogAddonPreview,
  getCatalogGrantedSubjects,
  mergeGrantedModulesOnConfirm,
} from '@/lib/catalogBrowse';
import { calcPreviewPriceRub } from '@/lib/previewPricing';

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
export const PREVIEW_SHORT_DURATION_MS = 40 * 1000;

/** TG ID с укороченным пробником (для теста оплаты; совпадает с ADMIN_TG_ID). */
const PREVIEW_SHORT_DURATION_TG_IDS = new Set(['978243325']);

export function isPreviewShortDurationAccount(tgId?: string | null): boolean {
  return !!tgId && PREVIEW_SHORT_DURATION_TG_IDS.has(String(tgId).trim());
}

export function getPreviewDurationMs(tgId?: string | null): number {
  if (isPreviewShortDurationAccount(tgId)) {
    return PREVIEW_SHORT_DURATION_MS;
  }
  return PREVIEW_DURATION_MS;
}

export type PreviewStatus = 'selecting' | 'active' | 'expired' | 'confirmed';

/** Пробник завершён админом: доступ выдан, сессия витрины снята. */
export function hasFinalizedPreviewAccess(user: any): boolean {
  if (!user) return false;
  if (user.previewStatus === 'confirmed') return true;
  return !!user.previewConfirmedAt && !user.previewStatus;
}

/** Оплаченный доступ есть, но в Redis остался старый статус витрины — сбрасываем при обычном входе. */
export function healStalePreviewForFinalizedUser(user: any): any {
  if (!user) return user;
  if (user.receiptClaimedAt && user.previewChosenSubject && !hasFinalizedPreviewAccess(user)) {
    return user;
  }
  if (!hasFinalizedPreviewAccess(user)) return user;

  const inCatalogBrowse = user._catalogBrowse === true;
  const staleSelecting = user.previewStatus === 'selecting' && !inCatalogBrowse;
  const staleExpired = user.previewStatus === 'expired' && !inCatalogBrowse;
  if (!staleSelecting && !staleExpired) return user;

  const healed: Record<string, any> = { ...user };
  delete healed.previewStatus;
  delete healed.previewChosenSubject;
  delete healed.previewChosenModules;
  delete healed.previewStartedAt;
  delete healed.previewExpiredAt;
  delete healed.previewPickedAt;
  delete healed.previewFacultyRecordedAt;
  delete healed._subjectsBeforePreview;
  delete healed._previewStatusBeforeCatalog;
  delete healed._catalogBrowse;
  return healed;
}

export function isPreviewUser(user: any): boolean {
  return !!user?.previewStatus;
}

export function isPreviewExpired(user: any, now = Date.now(), tgId?: string | null): boolean {
  if (user?.previewStatus !== 'active') return false;
  const started = user.previewStartedAt;
  if (!started) return true;
  return now - Date.parse(started) >= getPreviewDurationMs(tgId);
}

export function previewEndsAt(user: any, tgId?: string | null): string | null {
  if (user?.previewStatus !== 'active' || !user.previewStartedAt) return null;
  return new Date(Date.parse(user.previewStartedAt) + getPreviewDurationMs(tgId)).toISOString();
}

export function getAllPickableSubjectIds(): string[] {
  return SUBJECTS.map(s => s.id);
}

/** Аккаунт с ключом или уже выданными предметами (не новый гость по коду). */
export function isEstablishedAccount(user: any): boolean {
  if (!user) return false;
  const key = String(user.activatedKey || '').trim();
  if (/^\d{8}$/.test(key)) return true;
  if (hasFinalizedPreviewAccess(user)) return true;
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
  if (hasFinalizedPreviewAccess(user)) return false;
  if (user.receiptClaimedAt) return true;
  if (user.previewStatus !== 'active' && user.previewStatus !== 'expired') return false;
  if (user.previewFacultyRecordedAt && !user.previewStartedAt) return false;

  // Во время active в user.subjects уже стоит временный доступ к chosen — сравниваем только снимок до пробы
  if (user._subjectsBeforePreview && typeof user._subjectsBeforePreview === 'object') {
    return user._subjectsBeforePreview[chosen] !== true;
  }

  if (user.previewStatus === 'active') {
    return true;
  }

  const grants = user.subjects && typeof user.subjects === 'object' ? user.subjects : null;
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
  opts?: { forceNewGroup?: boolean },
) {
  const now = new Date().toISOString();
  const facultyChanged = !!user.facultyId && user.facultyId !== promo.id;
  const clearGroup = opts?.forceNewGroup === true || facultyChanged;
  return {
    ...user,
    previewStatus:              'selecting' as PreviewStatus,
    previewFaculty:             promo.facultyLabel,
    facultyId:                  promo.id,
    promoCode:                  promo.code,
    studyGroup:                 clearGroup ? null : (user.studyGroup ?? null),
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
  options?: { catalogAddon?: boolean },
) {
  const before = snapshotSubjects(user);
  const subjects = before ? { ...before } : createDefaultSubjects();
  subjects[subjectId] = true;
  const now = new Date().toISOString();
  const granted = getCatalogGrantedSubjects(user);
  const isAddon = options?.catalogAddon === true
    && userAlreadyHasSubjectAccess(user, subjectId);
  const hiddenTabs = isAddon
    ? buildNavHiddenForCatalogAddonPreview(
      subjectId,
      chosenModules,
      granted,
      user.navHidden || {},
    )
    : buildNavHiddenForPreview(subjectId, chosenModules);
  const navHidden = { ...(user.navHidden || {}), [subjectId]: hiddenTabs };
  const navHiddenBeforePreview = isAddon
    ? { ...(user.navHidden || {}) }
    : user._navHiddenBeforePreview;

  return {
    ...user,
    previewStatus:          'active' as PreviewStatus,
    previewChosenSubject:   subjectId,
    previewChosenModules:   chosenModules,
    previewQuotedPrice:     calcPreviewPriceRub(subjectId, chosenModules),
    previewStartedAt:       now,
    previewPickedAt:          now,
    receiptClaimedAt:         null,
    subjects,
    navHidden,
    _subjectsBeforePreview: before,
    _navHiddenBeforePreview: navHiddenBeforePreview,
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

/** Разделы из заявки: сначала previewChosenModules, иначе из navHidden активной пробы. */
export function inferChosenModulesForConfirm(user: any, subjectId: string): PreviewModule[] {
  const fromField = normalizePreviewModules(user?.previewChosenModules);
  if (fromField.length > 0) return fromField;

  const hiddenList = user?.navHidden?.[subjectId];
  if (Array.isArray(hiddenList)) {
    const hidden = new Set(hiddenList.map(String));
    const inferred = (['questions', 'tests', 'tasks'] as PreviewModule[]).filter(
      m => !hidden.has(m),
    );
    if (inferred.length > 0) return inferred;
  }

  return [];
}

/** Студент меняет разделы на экране оплаты — пересчёт суммы и заявки. */
export function updatePreviewPaymentChoice(user: any, modules: PreviewModule[]) {
  const subject = user?.previewChosenSubject;
  if (!subject) return null;
  if (user.receiptClaimedAt || hasFinalizedPreviewAccess(user)) return null;

  const chosen = normalizePreviewModules(modules);
  if (chosen.length === 0) return null;

  const before = user._subjectsBeforePreview;
  const isAddon = before && typeof before === 'object' && before[subject] === true;
  const grantedSubjects = isAddon ? getCatalogGrantedSubjects(user) : [];
  const baseNavHidden = (user._navHiddenBeforePreview && typeof user._navHiddenBeforePreview === 'object')
    ? user._navHiddenBeforePreview
    : (user.navHidden || {});
  const hiddenTabs = isAddon
    ? buildNavHiddenForCatalogAddonPreview(subject, chosen, grantedSubjects, baseNavHidden)
    : buildNavHiddenForPreview(subject, chosen);
  const navHidden = { ...(user.navHidden || {}), [subject]: hiddenTabs };

  return {
    ...user,
    previewChosenModules: chosen,
    previewQuotedPrice:   calcPreviewPriceRub(subject, chosen),
    navHidden,
  };
}

/** Студент нажал «Скинул чек» — доверяем, сразу открываем доступ по выбору. */
export function claimPreviewReceipt(user: any) {
  const chosen = user?.previewChosenSubject;
  if (!chosen) return null;
  if (hasFinalizedPreviewAccess(user)) return user;

  const stamped = user.receiptClaimedAt
    ? user
    : { ...user, receiptClaimedAt: new Date().toISOString() };

  return confirmPreviewUser(stamped);
}

/** Админ вернул на витрину — студент выбирает заново. */
export function reopenPreviewVitrine(user: any) {
  if (!user) return null;
  const updated: Record<string, any> = {
    ...user,
    previewStatus:        'selecting' as PreviewStatus,
    previewChosenSubject: null,
    previewChosenModules: null,
    previewQuotedPrice:   null,
    previewStartedAt:     null,
    previewExpiredAt:     null,
    previewPickedAt:      null,
    receiptClaimedAt:     null,
    _subjectsBeforePreview: undefined,
  };
  delete updated._catalogBrowse;
  return updated;
}

export function confirmPreviewUser(user: any) {
  const chosen = user.previewChosenSubject;
  if (!chosen) return null;

  const modules = inferChosenModulesForConfirm(user, chosen);
  if (modules.length === 0) return null;

  const subjects = user._subjectsBeforePreview && typeof user._subjectsBeforePreview === 'object'
    ? { ...user._subjectsBeforePreview }
    : user.subjects && typeof user.subjects === 'object'
      ? { ...user.subjects }
      : createDefaultSubjects();
  subjects[chosen] = true;
  const now = new Date().toISOString();
  const hadSubjectBefore = user._subjectsBeforePreview
    && typeof user._subjectsBeforePreview === 'object'
    && user._subjectsBeforePreview[chosen] === true;
  const baseNavHidden = (user._navHiddenBeforePreview && typeof user._navHiddenBeforePreview === 'object')
    ? user._navHiddenBeforePreview
    : (user.navHidden || {});
  const navHidden = hadSubjectBefore
    ? mergeGrantedModulesOnConfirm(baseNavHidden, chosen, modules)
    : {
      ...(user.navHidden || {}),
      [chosen]: buildNavHiddenForPreview(chosen, modules),
    };

  const updated: Record<string, any> = {
    ...user,
    subjects,
    navHidden,
    previewChosenSubject: chosen,
    previewChosenModules: modules,
    previewConfirmedAt:   now,
    receiptClaimedAt:     user.receiptClaimedAt ?? now,
    paid:                 user.paid === true,
    activatedKey:         user.activatedKey && !String(user.activatedKey).startsWith('promo:')
      ? user.activatedKey
      : (user.activatedKey || 'preview'),
    [`${chosen}_grantedAt`]: now,
    _subjectsBeforePreview:    undefined,
    _navHiddenBeforePreview:   undefined,
    _migrated_subjects:        true,
  };

  delete updated.previewStatus;
  delete updated.previewStartedAt;
  delete updated.previewExpiredAt;
  delete updated.previewPickedAt;
  delete updated.previewFacultyRecordedAt;
  delete updated._previewStatusBeforeCatalog;
  delete updated._catalogBrowse;

  return updated;
}

export function getEffectiveUserSubjects(user: any, tgId?: string | null): string[] {
  if (!user) return [];
  if (user.previewStatus === 'selecting') return [];
  if (user.previewStatus === 'active' && isPreviewExpired(user, Date.now(), tgId)) {
    return getUserAvailableSubjects(user);
  }
  return getUserAvailableSubjects(user);
}

export async function maybeExpirePreviewUser(
  redis: { get: (k: string) => Promise<any>; set: (k: string, v: any) => Promise<any> },
  tgId: string,
  user: any,
): Promise<any> {
  if (!user || user.previewStatus !== 'active' || !isPreviewExpired(user, Date.now(), tgId)) return user;
  const expired = expirePreviewUser(user);
  await redis.set(`user_id:${tgId}`, expired);
  return expired;
}
