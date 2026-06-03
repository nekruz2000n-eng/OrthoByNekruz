/**
 * Промо-коды факультетов — бесплатный пробный вход через код из канала.
 * Каждый код — не «факт из Википедии», а отсылка для своих.
 */

export interface FacultyPromo {
  id:            string;
  facultyLabel:  string;
  code:          string;
  digitIcon:     string;
  /** Короткая подсказка на экране входа */
  channelHint:   string;
  /** Текст для поста / раскрытия в канале */
  channelReveal: string;
}

export const FACULTY_PROMOS: FacultyPromo[] = [
  {
    id:           'stomatology',
    facultyLabel: 'Стоматологический факультет',
    code:         '3950',
    digitIcon:    '🦷',
    channelHint:  'ISO 3950 — международная нумерация зубов',
    channelReveal:
      '3950 — не «32 зуба». Это ISO 3950: стандарт FDI, по которому мы называем зуб «один-шесть», а не «шестнадцатый». Свой код — для своих.',
  },
  {
    id:           'therapeutic',
    facultyLabel: 'Лечебный факультет',
    code:         '5016',
    digitIcon:    '🩺',
    channelHint:  '50:16 — «ближе к нему, чем яремная вена»',
    channelReveal:
      '5016 — это 50:16 (сура «Кāф»): «Мы ближе к нему, чем его яремная вена». Анатомия в аяте — код для лечебников.',
  },
  {
    id:           'pediatrics',
    facultyLabel: 'Педиатрический факультет',
    code:         '2314',
    digitIcon:    '👶',
    channelHint:  '23:14 — кости, потом «одели плотью»',
    channelReveal:
      '2314 — это 23:14 (сура «Мu’minūn»): этапы в утробе — кости, затем плоть. Эмбриология из Корана — для педиатров.',
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
