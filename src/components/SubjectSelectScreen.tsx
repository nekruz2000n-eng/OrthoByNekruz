"use client";

import React, { useState } from 'react';
import { ToothIcon } from '@/components/ToothIcon';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Типы ────────────────────────────────────────────────────────────────────
export type SubjectType = 'ortho' | 'micro';

interface SubjectSelectScreenProps {
  onSelect: (subject: SubjectType) => void;
}

// ─── Данные предметов ────────────────────────────────────────────────────────
const SUBJECTS = [
  {
    id:      'ortho' as SubjectType,
    label:   'Ортопедическая\nстоматология',
    sub:     'Вопросы · Тесты · Задачи',
    badge:   '2 курс',
    color:   'var(--c-primary)',
    dimVar:  'var(--c-primary-dim)',
    brVar:   'var(--c-primary-br)',
    variant: 'perfect' as const,
  },
  {
    id:      'micro' as SubjectType,
    label:   'Микробиология',
    sub:     'Вопросы · Тесты · Задачи',
    badge:   '2 курс',
    color:   'var(--c-amber)',
    dimVar:  'var(--c-amber-dim)',
    brVar:   'var(--c-amber-br)',
    variant: 'normal' as const,
  },
] as const;

// ─── Floating tooth background ────────────────────────────────────────────────
const FloatingTooth = ({
  x, y, size, delay, color,
}: { x: number; y: number; size: number; delay: number; color: string }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24" fill="none"
    style={{
      position: 'absolute', left: x, top: y, pointerEvents: 'none',
      animation: `subjectToothFloat ${2.5 + delay}s ${delay}s ease-in-out infinite`,
    }}
  >
    <path
      d="M7.5 3C5.5 3 4 4.5 4 6.5C4 8.5 4.5 11 5.5 13.5C6.5 16 8.5 19.5 8.5 21C8.5 21.5 8.9 22 9.5 22C10.1 22 10.5 21.5 10.5 21C10.5 20.5 11 18 12 18C13 18 13.5 20.5 13.5 21C13.5 21.5 13.9 22 14.5 22C15.1 22 15.5 21.5 15.5 21C15.5 19.5 17.5 16 18.5 13.5C19.5 11 20 8.5 20 6.5C20 4.5 18.5 3 16.5 3C14.5 3 13 4 12 5C11 4 9.5 3 7.5 3Z"
      stroke={color} strokeWidth="1.5" fill={color} fillOpacity="0.25"
    />
  </svg>
);

// ─── SubjectSelectScreen ──────────────────────────────────────────────────────
export const SubjectSelectScreen: React.FC<SubjectSelectScreenProps> = ({ onSelect }) => {
  const [selected, setSelected] = useState<SubjectType | null>(null);

  return (
    <div
      className="flex flex-col items-center justify-center h-[100dvh] w-full relative overflow-hidden"
      style={{ background: 'var(--c-bg)' }}
    >
      {/* CSS: floating tooth keyframes — inject once */}
      <style>{`
        @keyframes subjectToothFloat {
          0%,100% { transform: translateY(0px) rotate(-3deg); }
          50%      { transform: translateY(-8px) rotate(3deg); }
        }
        @keyframes subjectToothPulse {
          0%,100% { transform: scale(1); filter: drop-shadow(0 0 8px color-mix(in srgb, var(--c-primary) 40%, transparent)); }
          50%      { transform: scale(1.07); filter: drop-shadow(0 0 20px color-mix(in srgb, var(--c-primary) 80%, transparent)); }
        }
      `}</style>

      {/* Background teeth */}
      <FloatingTooth x={20}  y={80}  size={28} delay={0}   color="color-mix(in srgb, var(--c-primary) 15%, transparent)" />
      <FloatingTooth x={320} y={120} size={20} delay={1}   color="color-mix(in srgb, var(--c-amber)  15%, transparent)" />
      <FloatingTooth x={50}  y={560} size={18} delay={0.5} color="color-mix(in srgb, var(--c-primary) 10%, transparent)" />
      <FloatingTooth x={300} y={620} size={24} delay={1.5} color="color-mix(in srgb, var(--c-amber)  10%, transparent)" />
      <FloatingTooth x={160} y={40}  size={14} delay={2}   color="color-mix(in srgb, var(--c-primary)  8%, transparent)" />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="flex flex-col items-center mb-10 text-center px-6"
      >
        <div
          className="w-[72px] h-[72px] rounded-[24px] flex items-center justify-center mb-4"
          style={{
            background: 'var(--c-primary-dim)',
            border: '1.5px solid var(--c-primary-br)',
            animation: 'subjectToothPulse 2.5s ease-in-out infinite',
          }}
        >
          <ToothIcon className="w-10 h-10 text-primary" variant="perfect" />
        </div>
        <h1
          className="text-2xl font-extrabold tracking-tight mb-2"
          style={{ color: 'var(--c-text)' }}
        >
          OrthoByNekruz
        </h1>
        <p className="text-sm" style={{ color: 'var(--c-muted)' }}>
          Выберите предмет для подготовки
        </p>
      </motion.div>

      {/* Subject cards */}
      <div className="flex flex-col gap-3 w-full max-w-xs px-5">
        {SUBJECTS.map((item, i) => {
          const isSelected = selected === item.id;
          return (
            <motion.button
              key={item.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.1 + i * 0.12 }}
              onClick={() => setSelected(item.id)}
              className="flex items-center gap-4 rounded-[24px] p-5 transition-all duration-200 active:scale-[0.97] text-left"
              style={{
                background:   isSelected ? item.dimVar : 'var(--c-card)',
                border:       `1.5px solid ${isSelected ? item.brVar : 'var(--c-border)'}`,
                boxShadow:    isSelected ? `0 8px 32px color-mix(in srgb, ${item.color} 20%, transparent)` : 'none',
              }}
            >
              {/* Icon */}
              <div
                className="w-16 h-16 rounded-[20px] flex items-center justify-center flex-shrink-0 transition-all duration-300"
                style={{
                  background: item.dimVar,
                  border:     `1px solid ${item.brVar}`,
                  filter:     isSelected ? `drop-shadow(0 0 10px ${item.color})` : 'none',
                }}
              >
                <ToothIcon
                  className="w-9 h-9"
                  style={{ color: item.color }}
                  variant={item.variant}
                />
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <div
                  className="text-[11px] font-bold uppercase tracking-widest mb-1"
                  style={{ color: item.color }}
                >
                  {item.badge}
                </div>
                <div
                  className="text-sm font-bold leading-snug mb-1 whitespace-pre-line"
                  style={{ color: 'var(--c-text)' }}
                >
                  {item.label}
                </div>
                <div className="text-[11px]" style={{ color: 'var(--c-muted)' }}>
                  {item.sub}
                </div>
              </div>

              {/* Chevron */}
              <div
                className="w-7 h-7 rounded-[10px] flex items-center justify-center flex-shrink-0 transition-all duration-200"
                style={{
                  background: isSelected ? item.color : 'color-mix(in srgb, var(--c-border) 60%, transparent)',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path
                    d="M5 3L9 7L5 11"
                    stroke={isSelected ? 'var(--c-bg)' : 'var(--c-muted)'}
                    strokeWidth="1.8" strokeLinecap="round"
                  />
                </svg>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* CTA button */}
      <motion.div
        className="w-full max-w-xs px-5 mt-7"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.42 }}
      >
        <button
          onClick={() => selected && onSelect(selected)}
          disabled={!selected}
          className="w-full h-[52px] rounded-[18px] text-[15px] font-bold transition-all duration-300 active:scale-[0.98]"
          style={selected ? {
            background:  selected === 'ortho' ? 'hsl(var(--primary))' : 'var(--c-amber)',
            color:       'hsl(var(--primary-foreground))',
            boxShadow:   selected === 'ortho'
              ? '0 8px 24px color-mix(in srgb, var(--c-primary) 35%, transparent)'
              : '0 8px 24px color-mix(in srgb, var(--c-amber) 35%, transparent)',
          } : {
            background:  'var(--c-card)',
            border:      '1px solid var(--c-border)',
            color:       'var(--c-muted)',
          }}
        >
          {selected
            ? `→ Войти в ${selected === 'ortho' ? 'Ортопедию' : 'Микробиологию'}`
            : 'Выберите предмет'}
        </button>
      </motion.div>

      <motion.p
        className="mt-4 text-[11px] text-center"
        style={{ color: 'var(--c-muted)', opacity: 0.6 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.6 }}
        transition={{ delay: 0.6 }}
      >
        Можно сменить предмет в любое время
      </motion.p>
    </div>
  );
};
