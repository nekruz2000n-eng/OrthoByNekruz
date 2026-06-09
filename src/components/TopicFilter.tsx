'use client';

import React from 'react';

interface TopicFilterProps {
  topics: { id: string; label: string }[];
  value: string | null;
  onChange: (topic: string | null) => void;
}

export function TopicFilter({ topics, value, onChange }: TopicFilterProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
      <button
        type="button"
        onClick={() => onChange(null)}
        className="flex-shrink-0 px-4 py-2 rounded-full text-xs font-semibold min-h-[36px]"
        style={{
          background: value === null ? 'var(--c-primary)' : 'var(--c-card)',
          color: value === null ? 'var(--c-bg)' : 'var(--c-text)',
          border: '1px solid var(--c-border)',
        }}
      >
        Все
      </button>
      {topics.map(t => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className="flex-shrink-0 px-4 py-2 rounded-full text-xs font-semibold min-h-[36px] whitespace-nowrap"
          style={{
            background: value === t.id ? 'var(--c-primary)' : 'var(--c-card)',
            color: value === t.id ? 'var(--c-bg)' : 'var(--c-text)',
            border: '1px solid var(--c-border)',
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
