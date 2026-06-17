'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface AppBrandIconProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  onClick?: React.MouseEventHandler<HTMLSpanElement>;
}

/** Логотип КрасГМУ в шапке табов (медицинский крест). */
export function AppBrandIcon({
  size = 20,
  className,
  style,
  onClick,
}: AppBrandIconProps) {
  return (
    <span
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onClick(e as unknown as React.MouseEvent<HTMLSpanElement>);
        }
      } : undefined}
      className={cn('inline-flex items-center justify-center leading-none select-none', className)}
      style={style}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
      >
        <rect x="10.25" y="4" width="3.5" height="16" rx="0.75" fill="#D32F2F" />
        <rect x="4" y="10.25" width="16" height="3.5" rx="0.75" fill="#D32F2F" />
      </svg>
    </span>
  );
}
