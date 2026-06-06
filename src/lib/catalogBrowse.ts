import type { FacultyPromo } from '@/lib/facultyCodes';
import { getNavHiddenForSubject } from '@/lib/subjectCatalog';
import { buildSelectingPreviewUserFromExisting } from '@/lib/preview';
import type { PreviewStatus } from '@/lib/preview';
import type { PreviewModule } from '@/lib/previewModules';

const CONTENT_MODULES: PreviewModule[] = ['questions', 'tests', 'tasks'];

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

/** Разделы предмета, уже в постоянном доступе. */
export function getGrantedCatalogModules(
  subjectId: string,
  grantedSubjects: string[],
  navHidden: Record<string, string[]>,
): PreviewModule[] {
  if (!grantedSubjects.includes(subjectId)) return [];
  return CONTENT_MODULES.filter(m =>
    isCatalogModuleAlreadyGranted(subjectId, m, grantedSubjects, navHidden),
  );
}

export function countPickableCatalogModules(
  subjectId: string,
  modules: { id: PreviewModule; available: boolean }[],
  grantedSubjects: string[],
  navHidden: Record<string, string[]>,
): number {
  return modules.filter(
    m => m.available && !isCatalogModuleAlreadyGranted(subjectId, m.id, grantedSubjects, navHidden),
  ).length;
}

/** Все готовые разделы уже куплены — предмет на витрине не открываем. */
export function isSubjectFullyOwnedInCatalog(
  subjectId: string,
  modules: { id: PreviewModule; available: boolean }[],
  grantedSubjects: string[],
  navHidden: Record<string, string[]>,
): boolean {
  const ready = modules.filter(m => m.available);
  if (ready.length === 0) return false;
  return countPickableCatalogModules(subjectId, modules, grantedSubjects, navHidden) === 0;
}

/** Проба докупки: оставляем купленные разделы + выбранные для пробы. */
export function buildNavHiddenForCatalogAddonPreview(
  subjectId: string,
  chosenModules: PreviewModule[],
  grantedSubjects: string[],
  navHidden: Record<string, string[]>,
): string[] {
  const hidden = new Set<string>(['exam', 'materials']);
  const granted = new Set(getGrantedCatalogModules(subjectId, grantedSubjects, navHidden));
  const visible = new Set<PreviewModule>([...granted, ...chosenModules]);
  for (const tab of CONTENT_MODULES) {
    if (!visible.has(tab)) hidden.add(tab);
  }
  for (const tab of getNavHiddenForSubject(subjectId)) {
    hidden.add(tab);
  }
  return [...hidden];
}

/** После оплаты докупки — открыть новые разделы, не трогая уже купленные. */
export function mergeGrantedModulesOnConfirm(
  navHidden: Record<string, string[]>,
  subjectId: string,
  newModules: PreviewModule[],
): Record<string, string[]> {
  const next = { ...navHidden };
  const hidden = new Set<string>(next[subjectId] || []);
  for (const m of newModules) hidden.delete(m);
  if (hidden.size === 0) delete next[subjectId];
  else next[subjectId] = [...hidden];
  return next;
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
