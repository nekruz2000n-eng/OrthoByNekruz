/** Bump when paid users may have stale preview state in localStorage. */
export const ACCESS_CACHE_VERSION = 2;

const VERSION_KEY = 'access_cache_v';

const STALE_PREVIEW_KEYS = [
  'pending_payment_subject',
  'preview_awaiting_confirm',
  'available_subjects',
  'subject_chosen',
  'last_subject',
  'has_micro',
] as const;

/** One-time client reset so stuck deploy sessions pick up healed server access. */
export function applyClientAccessCacheVersion(): boolean {
  if (typeof window === 'undefined') return false;
  const prev = Number(localStorage.getItem(VERSION_KEY) || '0');
  if (prev === ACCESS_CACHE_VERSION) return false;
  for (const k of STALE_PREVIEW_KEYS) localStorage.removeItem(k);
  localStorage.setItem(VERSION_KEY, String(ACCESS_CACHE_VERSION));
  return true;
}

export function clearPreviewClientKeys(): void {
  if (typeof window === 'undefined') return;
  for (const k of STALE_PREVIEW_KEYS) localStorage.removeItem(k);
}
