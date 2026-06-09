'use client';

import React from 'react';

interface StreakBadgeProps {
  days: number;
}

export function StreakBadge({ days }: StreakBadgeProps) {
  if (days <= 0) return null;
  return (
    <span
      className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold"
      style={{ background: 'var(--c-amber-soft)', color: 'var(--c-amber)' }}
    >
      🔥 {days} {days === 1 ? 'день' : days < 5 ? 'дня' : 'дней'}
    </span>
  );
}
