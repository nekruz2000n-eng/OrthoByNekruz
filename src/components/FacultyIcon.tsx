'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { EMOJI_FONT_STACK } from '@/lib/facultyCodes';
import { useFacultyIcon } from '@/hooks/use-faculty-icon';

export interface FacultyIconProps {
  /** Размер в px (font-size) */
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  onClick?: React.MouseEventHandler<HTMLSpanElement>;
  /** Явная иконка (поле ввода кода до сохранения факультета) */
  icon?: string;
}

/** Системный эмодзи факультета пользователя (🦷 / 🩺 / 👶) */
export const FacultyIcon = ({
  size = 20,
  className,
  style,
  onClick,
  icon: iconOverride,
}: FacultyIconProps) => {
  const storedIcon = useFacultyIcon();
  const icon = iconOverride ?? storedIcon;

  return (
    <span
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(e as unknown as React.MouseEvent<HTMLSpanElement>); } : undefined}
      className={cn('inline-flex items-center justify-center leading-none select-none', className)}
      style={{
        fontSize: size,
        fontFamily: EMOJI_FONT_STACK,
        ...style,
      }}
      aria-hidden={!onClick}
    >
      {icon}
    </span>
  );
};
