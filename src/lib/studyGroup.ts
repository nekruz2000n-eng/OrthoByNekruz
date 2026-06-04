/** Нормализация и проверка учебной группы (108с, 103л, 105п). */

export function normalizeStudyGroup(raw: string): string {
  return raw.trim().replace(/\s+/g, '').toLowerCase();
}

export function isValidStudyGroup(raw: string): boolean {
  const g = normalizeStudyGroup(raw);
  if (!g || g.length < 3 || g.length > 10) return false;
  return /^[0-9]{2,4}[слпcsl]?$/u.test(g);
}

export const STUDY_GROUP_PLACEHOLDER = '108с, 103л или 105п';
