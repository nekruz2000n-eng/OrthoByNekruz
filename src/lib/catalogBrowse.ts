import type { FacultyPromo } from '@/lib/facultyCodes';
import { buildSelectingPreviewUserFromExisting } from '@/lib/preview';
import type { PreviewStatus } from '@/lib/preview';
import type { PreviewModule } from '@/lib/previewModules';

/** Предметы, уже открытые до витрины (докупка / ключ / админ). */
export function getCatalogGrantedSubjects(user: any): string[] {
  const snap = user?._subjectsBeforePreview;
  if (snap && typeof snap === 'object') {
    return Object.entries(snap)
      .filter(([, v]) => v === true)
      .map(([id]) => id);
  }
  if (user?.subjects && typeof user.subjects === 'object') {
    const ids = Object.entries(user.subjects)
      .filter(([, v]) => v === true)
      .map(([id]) => id);
    if (ids.length) return ids;
  }
  return [];
}

/** Раздел уже в постоянном доступе — нельзя выбрать снова для пробы. */
export function isCatalogModuleAlreadyGranted(
  subjectId: string,
  moduleId: PreviewModule,
  grantedSubjects: string[],
  navHidden: Record<string, string[]>,
): boolean {
  if (!grantedSubjects.includes(subjectId)) return false;
  const hidden = navHidden[subjectId] || [];
  return !hidden.includes(moduleId);
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

/** После окончания просмотра — снова витрина, можно выбрать другой предмет. */
export function restartCatalogBrowseSelecting(
  user: any,
  profile: {
    username: string | null;
    firstName: string | null;
    lastName: string | null;
  },
  promo: FacultyPromo,
) {
  return {
    ...buildCatalogSelectingUser(user, profile, promo),
    previewStatus:           'selecting' as PreviewStatus,
    previewChosenSubject:    null,
    previewChosenModules:    null,
    previewStartedAt:        null,
    previewExpiredAt:        null,
    _catalogBrowse:          true,
  };
}
