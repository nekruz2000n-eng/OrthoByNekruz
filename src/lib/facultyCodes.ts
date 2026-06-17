/**
 * Коды факультетов — вход по цифрам из канала.
 * В интерфейсе только нейтральные медицинские подписи, без религиозных отсылок.
 */

export interface FacultyPromo {
  id:            string;
  /** Полное название (админка, заявки) */
  facultyLabel:  string;
  code:          string;
  digitIcon:     string;
  /** Подсказка для поста в канале (внутренняя) */
  channelReveal: string;
}

export const FACULTY_PROMOS: FacultyPromo[] = [
  {
    id:           'stomatology',
    facultyLabel: 'Стоматологический факультет',
    code:         '3950',
    digitIcon:    '🦷',
    channelReveal:
      '3950 — международная нумерация зубов FDI (ISO 3950). Код стоматологического факультета.',
  },
  {
    id:           'therapeutic',
    facultyLabel: 'Лечебный факультет',
    code:         '5016',
    digitIcon:    '🩺',
    channelReveal:
      '5016 — яремная вена и близость сосудов к тканям (анатомия). Код лечебного факультета.',
  },
  {
    id:           'pediatrics',
    facultyLabel: 'Педиатрический факультет',
    code:         '2314',
    digitIcon:    '👶',
    channelReveal:
      '2314 — этапы формирования тканей в период роста. Код педиатрического факультета.',
  },
];

export const MAX_PROMO_CODE_LENGTH = Math.max(...FACULTY_PROMOS.map(p => p.code.length));
export const MAX_INPUT_LENGTH = Math.max(MAX_PROMO_CODE_LENGTH, 8);

export function resolveFacultyPromoCode(input: string): FacultyPromo | null {
  const digits = input.replace(/\D/g, '');
  if (!digits) return null;
  return FACULTY_PROMOS.find(p => p.code === digits) ?? null;
}

/** Факультет уже известен (новые и старые пользователи с сохранённым кодом). */
export function userHasKnownFaculty(user: {
  facultyId?: string | null;
  promoCode?: string | null;
  previewFaculty?: string | null;
} | null | undefined): boolean {
  return resolveUserFacultyPromo(user) != null;
}

/** facultyId, promoCode или подпись факультета из старых записей. */
export function resolveUserFacultyPromo(
  user: {
    facultyId?: string | null;
    promoCode?: string | null;
    previewFaculty?: string | null;
  } | null | undefined,
  key?: string | null,
  clientFacultyId?: string | null,
): FacultyPromo | null {
  const byId = getFacultyPromoById(user?.facultyId);
  if (byId) return byId;

  const storedCode = String(user?.promoCode || '').replace(/\D/g, '');
  if (storedCode) {
    const byStored = resolveFacultyPromoCode(storedCode);
    if (byStored) return byStored;
  }

  const label = String(user?.previewFaculty || '').trim();
  if (label) {
    const byLabel = FACULTY_PROMOS.find(p => p.facultyLabel === label) ?? null;
    if (byLabel) return byLabel;
  }

  if (key) {
    const byKey = resolveFacultyPromoCode(String(key).trim());
    if (byKey) return byKey;
  }

  return getFacultyPromoById(clientFacultyId);
}

export function detectFacultyByInput(input: string): FacultyPromo | null {
  const digits = input.replace(/\D/g, '');
  if (!digits) return null;

  const exact = resolveFacultyPromoCode(digits);
  if (exact) return exact;

  const asPrefix = FACULTY_PROMOS.filter(p => p.code.startsWith(digits));
  if (asPrefix.length === 1) return asPrefix[0];

  return null;
}

export function getDefaultDigitIcon(): string {
  return '🦷';
}

export const USER_FACULTY_ID_KEY = 'user_faculty_id';

export const FACULTY_ICON_CHANGED_EVENT = 'faculty-icon-changed';

export const EMOJI_FONT_STACK =
  '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

export function getFacultyPromoById(facultyId: string | null | undefined): FacultyPromo | null {
  if (!facultyId) return null;
  return FACULTY_PROMOS.find(p => p.id === facultyId) ?? null;
}

export function getDigitIconByFacultyId(facultyId: string | null | undefined): string {
  return getFacultyPromoById(facultyId)?.digitIcon ?? getDefaultDigitIcon();
}

export function readStoredFacultyId(): string | null {
  if (typeof window === 'undefined') return null;
  const id = localStorage.getItem(USER_FACULTY_ID_KEY);
  return id && FACULTY_PROMOS.some(p => p.id === id) ? id : null;
}

export function readStoredFacultyIcon(): string {
  return getDigitIconByFacultyId(readStoredFacultyId());
}

export function persistFacultyId(facultyId: string | null | undefined): void {
  if (typeof window === 'undefined') return;
  if (facultyId && FACULTY_PROMOS.some(p => p.id === facultyId)) {
    localStorage.setItem(USER_FACULTY_ID_KEY, facultyId);
  } else {
    localStorage.removeItem(USER_FACULTY_ID_KEY);
  }
  window.dispatchEvent(new Event(FACULTY_ICON_CHANGED_EVENT));
}

export function persistFacultyFromPromo(promo: FacultyPromo | null | undefined): void {
  persistFacultyId(promo?.id ?? null);
}

export function persistFacultyFromAccessCode(code: string): void {
  persistFacultyFromPromo(resolveFacultyPromoCode(code));
}

export function facultyFieldsFromUser(user: { facultyId?: string | null } | null | undefined) {
  const facultyId = user?.facultyId ?? null;
  return {
    facultyId,
    digitIcon: getDigitIconByFacultyId(facultyId),
  };
}

/** Записать факультет в профиль пользователя (Redis). */
export function applyFacultyToUser<T extends Record<string, unknown>>(
  user: T,
  promo: FacultyPromo,
): T & { facultyId: string; promoCode: string; previewFaculty: string } {
  return {
    ...user,
    facultyId:      promo.id,
    promoCode:      promo.code,
    previewFaculty: promo.facultyLabel,
  };
}

/** Нужно ли показать выбор факультета (нет данных ни в профиле, ни в старых полях). */
export function userNeedsFacultyPick(
  user: Parameters<typeof userHasKnownFaculty>[0] | null | undefined,
): boolean {
  return !!user && !userHasKnownFaculty(user);
}

export function isLegacyPaidKey(input: string): boolean {
  return /^\d{8}$/.test(input.trim());
}
