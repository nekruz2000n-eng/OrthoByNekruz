import { PREVIEW_AWAITING_CONFIRM_KEY } from '@/components/AccessWelcomeOverlay';
import { USER_FACULTY_ID_KEY } from '@/lib/facultyCodes';

export const AUTH_STORAGE_KEYS = [
  'is_authed',
  'user_tg_id',
  'available_subjects',
  'subject_chosen',
  'has_micro',
  'preview_end',
  'preview_start',
  'last_subject',
  'welcome_seen',
  PREVIEW_AWAITING_CONFIRM_KEY,
  USER_FACULTY_ID_KEY,
] as const;

export function readClientAuthFlag(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('is_authed') === 'true';
}

export function clearLocalSession(): void {
  if (typeof window === 'undefined') return;
  AUTH_STORAGE_KEYS.forEach(k => localStorage.removeItem(k));
}

/** Сессия валидна, если TG ID в localStorage совпадает с текущим WebApp. */
export function validateClientSession(): boolean {
  if (typeof window === 'undefined') return false;
  if (!readClientAuthFlag()) return false;

  const storedId = localStorage.getItem('user_tg_id');
  const currentId = (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id;
  if (currentId && storedId && String(currentId) !== storedId) {
    clearLocalSession();
    return false;
  }
  return true;
}
