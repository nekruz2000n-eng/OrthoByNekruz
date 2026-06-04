/** @username или tg:// по ID — ссылка для чата в Telegram. */
export function getTgChatHref(tgId: string, username?: string | null, contactUsername?: string | null): string {
  const handle = (username || contactUsername || '').replace(/^@/, '').trim();
  if (handle) return `https://t.me/${handle}`;
  return `tg://user?id=${String(tgId).trim()}`;
}

export function formatTgChatLabel(username?: string | null, contactUsername?: string | null): string {
  const handle = (username || contactUsername || '').replace(/^@/, '').trim();
  return handle ? `@${handle}` : 'Написать в TG';
}

/** Открыть чат из Mini App или браузера. */
export function openTgChat(href: string) {
  if (typeof window === 'undefined') return;
  const tg = (window as { Telegram?: { WebApp?: { openTelegramLink?: (url: string) => void } } }).Telegram?.WebApp;
  if (tg?.openTelegramLink) {
    tg.openTelegramLink(href);
    return;
  }
  window.open(href, '_blank', 'noopener,noreferrer');
}

export function normalizeTelegramUsername(raw: string): string {
  return raw.trim().replace(/^@/, '').toLowerCase();
}

export function isValidTelegramUsername(raw: string): boolean {
  const u = normalizeTelegramUsername(raw);
  if (!u || u.length < 5 || u.length > 32) return false;
  return /^[a-z][a-z0-9_]{3,30}[a-z0-9]$/.test(u) || /^[a-z0-9_]{5,32}$/.test(u);
}
