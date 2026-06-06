const CORE_ACTIVITY_FIELDS = [
  'lastActivityAt',
  'lastLogin',
  'date',
  'receiptClaimedAt',
  'previewConfirmedAt',
  'previewPickedAt',
  'previewStartedAt',
  'previewExpiredAt',
  'previewFacultyRecordedAt',
  'blockedAt',
  'microGrantedAt',
  'microDate',
] as const;

function bumpTimestamp(value: unknown, max: { ms: number }) {
  if (typeof value !== 'string' || !value) return;
  const ms = Date.parse(value);
  if (!Number.isNaN(ms) && ms > max.ms) max.ms = ms;
}

/** Последнее значимое действие: вход, покупка, докупка, чек, подтверждение и т.д. */
export function resolveLastActivityMs(user: any): number {
  if (!user || typeof user !== 'object') return 0;
  const max = { ms: 0 };

  for (const key of CORE_ACTIVITY_FIELDS) {
    bumpTimestamp(user[key], max);
  }

  for (const key of Object.keys(user)) {
    if (
      key.endsWith('At')
      || key.endsWith('_grantedAt')
      || key.endsWith('Date')
    ) {
      bumpTimestamp(user[key], max);
    }
  }

  return max.ms;
}

export function resolveLastActivityIso(user: any): string | null {
  const ms = resolveLastActivityMs(user);
  return ms > 0 ? new Date(ms).toISOString() : null;
}

export function touchUserActivity<T extends Record<string, unknown>>(
  user: T,
  at?: string,
): T & { lastActivityAt: string } {
  const ts = at ?? new Date().toISOString();
  return { ...user, lastActivityAt: ts };
}
