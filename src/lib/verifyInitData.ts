import { createHmac } from 'crypto';

const MAX_AGE_SECONDS = 86400;

/**
 * Verifies Telegram WebApp initData and returns the user ID on success,
 * or null if the signature is invalid / expired.
 */
export function verifyInitDataId(
  initData: string,
  botToken: string,
): number | null {
  try {
    const params = new URLSearchParams(initData);
    const hash   = params.get('hash');
    if (!hash) return null;
    params.delete('hash');
    const str = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');
    const secret   = createHmac('sha256', 'WebAppData').update(botToken).digest();
    const expected = createHmac('sha256', secret).update(str).digest('hex');
    if (expected !== hash) return null;
    const authDate = Number(params.get('auth_date') || '0');
    if (Math.floor(Date.now() / 1000) - authDate > MAX_AGE_SECONDS) return null;
    const user = JSON.parse(params.get('user') || '{}');
    return user.id || null;
  } catch {
    return null;
  }
}

export interface TelegramUser {
  id:          number;
  username?:   string;
  first_name?: string;
  last_name?:  string;
  [key: string]: unknown;
}

/**
 * Verifies Telegram WebApp initData and returns the full user object on
 * success, or null if the signature is invalid / expired.
 */
export function verifyInitDataUser(
  initData: string,
  botToken: string,
): TelegramUser | null {
  try {
    const params = new URLSearchParams(initData);
    const hash   = params.get('hash');
    if (!hash) return null;
    params.delete('hash');
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');
    const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
    const expected  = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    if (expected !== hash) return null;
    const authDate = Number(params.get('auth_date') || '0');
    if (Math.floor(Date.now() / 1000) - authDate > MAX_AGE_SECONDS) return null;
    const userStr = params.get('user');
    if (!userStr) return null;
    return JSON.parse(userStr) as TelegramUser;
  } catch {
    return null;
  }
}
