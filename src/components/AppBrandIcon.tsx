'use client';

import React from 'react';
import { cn } from '@/lib/utils';

const LOGO_LIGHT = '/krasgmu-logo-light.png';
const LOGO_DARK = '/krasgmu-logo-dark.png';

export interface AppBrandIconProps {
  /** Размер в px (по умолчанию 32) */
  size?: number;
  /** Всегда тёмный вариант логотипа (экран входа и т.п.) */
  forceDark?: boolean;
  className?: string;
  style?: React.CSSProperties;
  onClick?: React.MouseEventHandler<HTMLSpanElement>;
}

/** Логотип КрасГМУ — круг, светлый/тёмный вариант по теме или forceDark. */
export function AppBrandIcon({
  size = 32,
  forceDark = false,
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
      className={cn(
        'inline-flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full',
        className,
      )}
      style={{
        width: size,
        height: size,
        background: 'transparent',
        ...style,
      }}
    >
      {forceDark ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={LOGO_DARK}
          alt=""
          className="h-full w-full object-cover"
          draggable={false}
        />
      ) : (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={LOGO_LIGHT}
            alt=""
            className="h-full w-full object-cover dark:hidden"
            draggable={false}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={LOGO_DARK}
            alt=""
            className="hidden h-full w-full object-cover dark:block"
            draggable={false}
          />
        </>
      )}
    </span>
  );
}
