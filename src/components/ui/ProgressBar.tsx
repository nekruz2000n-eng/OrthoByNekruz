'use client';

import React from 'react';

interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  className?: string;
}

export function ProgressBar({ value, max = 100, label, className = '' }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className={className}>
      {label && (
        <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--c-muted)' }}>
          <span>{label}</span>
          <span>{Math.round(pct)}%</span>
        </div>
      )}
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--c-border)' }}>
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, background: 'var(--c-primary)' }}
        />
      </div>
    </div>
  );
}
