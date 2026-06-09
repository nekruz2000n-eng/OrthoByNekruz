'use client';

import React from 'react';

interface DueCountProps {
  count: number;
  className?: string;
}

export function DueCount({ count, className = '' }: DueCountProps) {
  if (count <= 0) return null;
  return (
    <span
      className={`inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full text-[11px] font-bold ${className}`}
      style={{ background: 'var(--c-danger)', color: '#fff' }}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}
