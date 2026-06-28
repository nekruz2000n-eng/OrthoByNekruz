"use client";

import React, { useState, useEffect } from 'react';
import { FacultyIcon } from '@/components/FacultyIcon';
import { useFacultyIcon } from '@/hooks/use-faculty-icon';
import { EMOJI_FONT_STACK } from '@/lib/facultyCodes';
import { motion } from 'framer-motion';
import { SUBJECTS, getSubject, SubjectConfig } from '@/lib/subjects';

// ─── Типы ────────────────────────────────────────────────────────────────────
export type SubjectType = string;

interface SubjectSelectScreenProps {
  /** Список ID доступных пользователю дисциплин */
  availableSubjects: string[];
  /** Колбэк при выборе дисциплины */
  onSelect: (subject: string) => void;
  /** Открыть ввод кода канала (витрина предметов) */
  onBrowseCatalog?: () => void;
  browseCatalogBusy?: boolean;
}

// ─── Хук: разблокирует скролл (нужен для Telegram Mini App) ───────────────────
function useReleaseScroll() {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prev = {
      htmlOverflow: html.style.overflow,
      htmlHeight:   html.style.height,
      bodyOverflow: body.style.overflow,
      bodyHeight:   body.style.height,
      bodyTouch:    body.style.touchAction,
    };
    html.style.overflow = 'hidden';
    html.style.height   = '100%';
    body.style.overflow = 'hidden';
    body.style.height   = '100%';
    body.style.touchAction = 'auto';
    return () => {
      html.style.overflow = prev.htmlOverflow;
      html.style.height   = prev.htmlHeight;
      body.style.overflow = prev.bodyOverflow;
      body.style.height   = prev.bodyHeight;
      body.style.touchAction = prev.bodyTouch;
    };
  }, []);
}

const FloatingFacultyEmoji = ({
  icon, x, y, size, delay, opacity = 0.35,
}: { icon: string; x: number; y: number; size: number; delay: number; opacity?: number }) => (
  <div
    aria-hidden
    style={{
      position: 'absolute',
      left: x,
      top: y,
      pointerEvents: 'none',
      fontSize: size,
      lineHeight: 1,
      fontFamily: EMOJI_FONT_STACK,
      opacity,
      animation: `subjectToothFloat ${2.5 + delay}s ${delay}s ease-in-out infinite`,
    }}
  >
    {icon}
  </div>
);

// ─── SubjectSelectScreen ──────────────────────────────────────────────────────
export const SubjectSelectScreen: React.FC<SubjectSelectScreenProps> = ({
  availableSubjects,
  onSelect,
  onBrowseCatalog,
  browseCatalogBusy = false,
}) => {
  useReleaseScroll();
  const facultyIcon = useFacultyIcon();
  const [selected, setSelected] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const saved = localStorage.getItem('last_subject');
    return saved && availableSubjects.includes(saved) ? saved : null;
  });

  useEffect(() => {
    const saved = localStorage.getItem('last_subject');
    if (saved && availableSubjects.includes(saved)) {
      setSelected(saved);
    }
  }, [availableSubjects]);

  const visibleSubjects: SubjectConfig[] = SUBJECTS.filter(s =>
    availableSubjects.includes(s.id)
  );

  return (
    <div
      className="flex flex-col w-full relative overflow-hidden"
      style={{ background: 'var(--c-bg)', height: '100dvh' }}
    >
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

      <FloatingFacultyEmoji icon={facultyIcon} x={20}  y={80}  size={28} delay={0}   opacity={0.28} />
      <FloatingFacultyEmoji icon={facultyIcon} x={320} y={120} size={20} delay={1}   opacity={0.22} />
      <FloatingFacultyEmoji icon={facultyIcon} x={50}  y={560} size={18} delay={0.5} opacity={0.18} />
      <FloatingFacultyEmoji icon={facultyIcon} x={300} y={620} size={24} delay={1.5} opacity={0.2} />
      <FloatingFacultyEmoji icon={facultyIcon} x={160} y={40}  size={14} delay={2}   opacity={0.14} />

      {/* ── Большая центральная шапка (положение чуть выше центра) ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="flex flex-col items-center text-center px-6 flex-shrink-0 relative z-10"
        style={{ paddingTop: '12vh', paddingBottom: '1.5vh' }}
      >
        <div
          className="w-[72px] h-[72px] rounded-[24px] flex items-center justify-center mb-4"
          style={{
            background: 'var(--c-primary-dim)',
            border: '1.5px solid var(--c-primary-br)',
            animation: 'subjectToothPulse 2.5s ease-in-out infinite',
          }}
        >
          <FacultyIcon size={40} />
        </div>
        <h1
          className="text-2xl font-extrabold tracking-tight mb-2"
          style={{ color: 'var(--c-text)' }}
        >
          ByNekruz
        </h1>
        <p className="text-sm" style={{ color: 'var(--c-muted)' }}>
          Выберите предмет для подготовки
        </p>
      </motion.div>

      {/* ── Скроллируемый список карточек ── */}
      <div
        className="flex-1 overflow-y-auto overscroll-contain relative z-10 mt-2"
        style={{ WebkitOverflowScrolling: 'touch' as any }}
      >
        <div className="flex flex-col gap-3 w-full max-w-xs mx-auto px-5 pb-4">
          {visibleSubjects.map((item, i) => {
            const isSelected = selected === item.id;
            return (
              <motion.button
                key={item.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: Math.min(0.05 * i, 0.4) }}
                onClick={() => setSelected(item.id)}
                className="flex items-center gap-3 rounded-[20px] p-4 transition-all duration-200 active:scale-[0.97] text-left"
                style={{
                  background: isSelected ? item.dimColor : 'var(--c-card)',
                  border:     `1.5px solid ${isSelected ? item.borderColor : 'var(--c-border)'}`,
                  boxShadow:  isSelected ? `0 8px 32px color-mix(in srgb, ${item.color} 20%, transparent)` : 'none',
                }}
              >
                {/* Текст: курс / название / Вопросы · Тесты · Задачи */}
                <div className="flex-1 min-w-0">
                  <div
                    className="text-[10px] font-bold uppercase tracking-widest mb-0.5"
                    style={{ color: item.color }}
                  >
                    {item.badge}
                  </div>
                  <div
                    className="text-[15px] font-bold leading-snug mb-0.5 whitespace-pre-line"
                    style={{ color: 'var(--c-text)' }}
                  >
                    {item.label}
                  </div>
                  <div
                    className="text-[11px] whitespace-nowrap overflow-hidden text-ellipsis"
                    style={{ color: 'var(--c-muted)' }}
                  >
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
      </div>

      {/* ── Зафиксированный низ: CTA + подпись ── */}
      <div
        className="flex-shrink-0 w-full px-5 pt-3 pb-5 relative z-10"
        style={{
          background: 'linear-gradient(to top, var(--c-bg) 70%, transparent)',
        }}
      >
        <motion.button
          onClick={() => selected && onSelect(selected)}
          disabled={!selected}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="w-full max-w-xs mx-auto block h-[52px] rounded-[18px] text-[15px] font-bold transition-all duration-300 active:scale-[0.98]"
          style={selected ? {
            background: getSubject(selected)?.color || 'var(--c-primary)',
            color:      'var(--c-bg)',
            boxShadow:  `0 8px 24px color-mix(in srgb, ${getSubject(selected)?.color || 'var(--c-primary)'} 35%, transparent)`,
          } : {
            background: 'var(--c-card)',
            border:     '1px solid var(--c-border)',
            color:      'var(--c-muted)',
          }}
        >
          {selected
            ? `→ Войти в ${getSubject(selected)?.label || 'дисциплину'}`
            : 'Выберите предмет'}
        </motion.button>

        {onBrowseCatalog && (
          <button
            type="button"
            disabled={browseCatalogBusy}
            onClick={() => { if (!browseCatalogBusy) onBrowseCatalog(); }}
            className="w-full max-w-xs mx-auto block mt-3 h-[48px] rounded-[16px] text-[13px] font-bold transition-all active:scale-[0.98] disabled:opacity-50"
            style={{
              background: 'var(--c-primary-soft)',
              border: '1.5px solid var(--c-primary-br)',
              color: 'var(--c-text)',
            }}
          >
            {browseCatalogBusy ? 'Открываем…' : 'Все доступные разработки'}
          </button>
        )}

        <p
          className="mt-3 text-[10px] text-center"
          style={{ color: 'var(--c-muted)', opacity: 0.55 }}
        >
          Можно сменить предмет в любое время
        </p>
      </div>
    </div>
  );
};
