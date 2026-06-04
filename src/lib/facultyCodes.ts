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

export function isLegacyPaidKey(input: string): boolean {
  return /^\d{8}$/.test(input.trim());
}
