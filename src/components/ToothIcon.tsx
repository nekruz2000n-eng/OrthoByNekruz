import React from 'react';
import { cn } from '@/lib/utils';

// Расширяем через SVGProps — принимает style, onClick и все стандартные SVG-атрибуты
interface ToothIconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  variant?: 'normal' | 'broken' | 'perfect';
}

export const ToothIcon = ({ className = "w-12 h-12", variant = 'normal', ...props }: ToothIconProps) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg" 
    className={cn(className, "transition-all duration-500")}
    {...props}
  >
    {/* Main Tooth Body */}
    <path 
      d="M7.5 3C5.5 3 4 4.5 4 6.5C4 8.5 4.5 11 5.5 13.5C6.5 16 8.5 19.5 8.5 21C8.5 21.5 8.9 22 9.5 22C10.1 22 10.5 21.5 10.5 21C10.5 20.5 11 18 12 18C13 18 13.5 20.5 13.5 21C13.5 21.5 13.9 22 14.5 22C15.1 22 15.5 21.5 15.5 21C15.5 19.5 17.5 16 18.5 13.5C19.5 11 20 8.5 20 6.5C20 4.5 18.5 3 16.5 3C14.5 3 13 4 12 5C11 4 9.5 3 7.5 3Z" 
      stroke="currentColor" 
      strokeWidth="1.5" 
      strokeLinecap="round" 
      strokeLinejoin="round"
      fill={variant === 'perfect' ? 'currentColor' : 'transparent'}
      fillOpacity={variant === 'perfect' ? '0.1' : '0'}
      className={cn(
        "drop-shadow-[0_0_8px_rgba(77,159,255,0.8)]",
        variant === 'perfect' && "drop-shadow-[0_0_15px_rgba(16,185,129,0.6)]",
        variant === 'broken' && "drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]"
      )}
    />
    
    {/* Broken Variant - Crack */}
    {variant === 'broken' && (
      <path 
        d="M12 5L10 9L13 12L11 16" 
        stroke="currentColor" 
        strokeWidth="1.5" 
        strokeLinecap="round" 
        strokeLinejoin="round"
        className="animate-in fade-in duration-700"
      />
    )}

    {/* Perfect Variant - Sparkles */}
    {variant === 'perfect' && (
      <>
        <circle cx="5" cy="5" r="1" fill="white" className="animate-pulse" />
        <circle cx="19" cy="8" r="0.8" fill="white" className="animate-pulse delay-75" />
        <circle cx="17" cy="18" r="1.2" fill="white" className="animate-pulse delay-150" />
      </>
    )}
  </svg>
);