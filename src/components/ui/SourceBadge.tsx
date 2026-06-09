'use client';

import React, { useState } from 'react';
import type { Source } from '@/types/data';

interface SourceBadgeProps {
  source: Source;
  excerpt?: string | null;
}

export function SourceBadge({ source, excerpt }: SourceBadgeProps) {
  const [open, setOpen] = useState(false);
  const label = source.section
    ? `📖 ${source.book}, ${source.section}`
    : `📖 ${source.book}`;

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => excerpt && setOpen(v => !v)}
        className="text-xs px-3 py-2 rounded-xl min-h-[44px]"
        style={{
          background: 'var(--c-primary-dim)',
          color: 'var(--c-muted)',
          border: '1px solid var(--c-primary-br)',
        }}
      >
        {label}
        {excerpt ? (open ? ' ▲' : ' ▼') : ''}
      </button>
      {open && excerpt && (
        <div
          className="mt-2 p-3 rounded-xl text-sm leading-relaxed"
          style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)', color: 'var(--c-text)' }}
        >
          <p className="text-xs font-semibold mb-1" style={{ color: 'var(--c-muted)' }}>Из учебника</p>
          {excerpt}
        </div>
      )}
    </div>
  );
}
