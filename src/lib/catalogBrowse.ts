import type { FacultyPromo } from '@/lib/facultyCodes';
import { buildSelectingPreviewUserFromExisting } from '@/lib/preview';
import type { PreviewStatus } from '@/lib/preview';

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
