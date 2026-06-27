'use client';

import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  detectFacultyByInput,
  EMOJI_FONT_STACK,
  FACULTY_AUTH_THEME,
  FACULTY_PROMOS,
  FACULTY_SHORT_LABEL,
  type FacultyPromo,
} from '@/lib/facultyCodes';

const AUTH_ANIM_STYLES = `
  @keyframes authRainCascade {
    0% { transform: translateY(-40px) rotate(-12deg); opacity: 0; }
    12% { opacity: var(--max-op); }
    100% { transform: translateY(110vh) rotate(14deg); opacity: 0; }
  }
  @keyframes authRainDrift {
    0% { transform: translate(-30px, -40px) rotate(-8deg); opacity: 0; }
    15% { opacity: var(--max-op); }
    50% { transform: translate(24px, 52vh) rotate(6deg); }
    100% { transform: translate(-18px, 110vh) rotate(-4deg); opacity: 0; }
  }
  @keyframes authRainBubble {
    0% { transform: translateY(20vh) scale(0.6); opacity: 0; }
    15% { opacity: var(--max-op); }
    50% { transform: translateY(-8vh) scale(1) translateX(12px); }
    100% { transform: translateY(-115vh) scale(0.85) translateX(-8px); opacity: 0; }
  }
  @keyframes authIconTooth {
    0%, 100% { transform: rotate(-6deg) scale(1); }
    50% { transform: rotate(6deg) scale(1.08); }
  }
  @keyframes authIconStethoscope {
    0%, 100% { transform: rotate(-10deg); }
    50% { transform: rotate(10deg); }
  }
  @keyframes authIconPediatrics {
    0%, 100% { transform: translateY(0) scale(1); }
    50% { transform: translateY(-4px) scale(1.06); }
  }
  @keyframes authSlotPop {
    0% { transform: scale(0.5) rotate(-8deg); opacity: 0; }
    70% { transform: scale(1.12) rotate(4deg); opacity: 1; }
    100% { transform: scale(1) rotate(0); opacity: 1; }
  }
  @keyframes authCardGlow {
    0%, 100% { box-shadow: 0 0 0 0 var(--glow); }
    50% { box-shadow: 0 0 22px 2px var(--glow); }
  }
  @keyframes authFacultyHintPop {
    0% { transform: translateY(6px); opacity: 0; }
    100% { transform: translateY(0); opacity: 1; }
  }
`;

type FacultyId = keyof typeof FACULTY_AUTH_THEME;

function buildParticles(facultyId: FacultyId | null) {
  const promos = facultyId
    ? FACULTY_PROMOS.filter(p => p.id === facultyId)
    : FACULTY_PROMOS;

  const count = facultyId ? 16 : 10;
  return Array.from({ length: count * promos.length }, (_, i) => {
    const promo = promos[i % promos.length];
    const theme = FACULTY_AUTH_THEME[promo.id];
    return {
      id: `${promo.id}-${i}`,
      emoji: promo.digitIcon,
      rainAnim: theme.rainAnim,
      left: (i * 23 + (promo.id.length * 7)) % 96,
      size: facultyId ? 22 + (i % 5) * 6 : 14 + (i % 4) * 5,
      dur: facultyId ? 5.5 + (i % 4) * 1.2 : 9 + (i % 5) * 1.4,
      delay: (i * 0.55) % 6,
      maxOpacity: facultyId ? 0.38 : 0.14,
      blur: facultyId ? 0 : 1.2,
    };
  });
}

export function FacultyAmbience({ facultyId }: { facultyId: string | null }) {
  const particles = useMemo(
    () => buildParticles(facultyId as FacultyId | null),
    [facultyId],
  );

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      <style>{AUTH_ANIM_STYLES}</style>
      {particles.map(p => (
        <div
          key={p.id}
          aria-hidden
          style={{
            position: 'absolute',
            left: `${p.left}%`,
            top: p.rainAnim === 'authRainBubble' ? 'auto' : -40,
            bottom: p.rainAnim === 'authRainBubble' ? -40 : undefined,
            fontSize: p.size,
            lineHeight: 1,
            fontFamily: EMOJI_FONT_STACK,
            animation: `${p.rainAnim} ${p.dur}s ${p.delay}s linear infinite`,
            '--max-op': p.maxOpacity,
            filter: p.blur
              ? `blur(${p.blur}px) drop-shadow(0 0 4px rgba(255,255,255,0.25))`
              : 'drop-shadow(0 0 6px rgba(255,255,255,0.35))',
          } as React.CSSProperties}
        >
          {p.emoji}
        </div>
      ))}
    </div>
  );
}

export function AuthHeroPitch() {
  return (
    <div className="space-y-3 max-w-[300px] mx-auto" style={{ animation: 'authFacultyHintPop 0.45s ease forwards' }}>
      <p className="text-[14px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.72)' }}>
        <span className="font-semibold text-white">Экзаменационные вопросы</span>,{' '}
        <span className="font-semibold text-white">задачи с разбором</span> и{' '}
        <span className="font-semibold text-white">итоговые тесты</span>
        {' '}— готовься к сессии в одном месте: учи, тренируйся, сдавай увереннее.
      </p>
      <p className="text-[11px] leading-snug" style={{ color: 'rgba(255,255,255,0.38)' }}>
        Билеты, глоссарий с картинками и пробник перед покупкой — без лишних приложений.
      </p>
    </div>
  );
}

function FacultyCard({
  promo,
  active,
  filled,
  disabled,
  onSelect,
}: {
  promo: FacultyPromo;
  active: boolean;
  filled: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const theme = FACULTY_AUTH_THEME[promo.id];
  const lit = active || filled;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'relative w-full text-left rounded-2xl px-3.5 py-3 transition-all duration-300',
        'active:scale-[0.98] disabled:opacity-45 disabled:pointer-events-none',
      )}
      style={{
        background: lit ? theme.accent.bg : 'rgba(255,255,255,0.03)',
        border: `1px solid ${lit ? theme.accent.border : 'rgba(255,255,255,0.07)'}`,
        '--glow': theme.accent.glow,
        animation: lit ? 'authCardGlow 2.4s ease-in-out infinite' : undefined,
      } as React.CSSProperties}
    >
      <div className="flex items-center gap-3">
        <span
          className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-[26px]"
          style={{
            background: theme.accent.bg,
            border: `1px solid ${theme.accent.border}`,
            fontFamily: EMOJI_FONT_STACK,
            lineHeight: 1,
            animation: `${theme.iconAnim} 2.2s ease-in-out infinite`,
          }}
          aria-hidden
        >
          {promo.digitIcon}
        </span>
        <div className="min-w-0 flex-1">
          <div
            className="text-[14px] font-bold leading-tight"
            style={{ color: lit ? theme.accent.text : 'rgba(255,255,255,0.9)' }}
          >
            {FACULTY_SHORT_LABEL[promo.id]}
          </div>
          <div className="text-[11px] mt-0.5 leading-snug" style={{ color: 'rgba(255,255,255,0.42)' }}>
            {theme.tagline}
          </div>
        </div>
      </div>
      {lit && (
        <p
          className="text-[10px] mt-2 pl-14 leading-snug"
          style={{ color: theme.accent.text, opacity: 0.75, animation: 'authFacultyHintPop 0.35s ease' }}
        >
          {theme.tagline}
        </p>
      )}
    </button>
  );
}

export function FacultyPicker({
  code,
  disabled,
  onSelect,
}: {
  code: string;
  disabled: boolean;
  onSelect: (promo: FacultyPromo) => void;
}) {
  const active = detectFacultyByInput(code);

  return (
    <div className="space-y-2.5">
      <p className="text-[11px] text-center leading-snug" style={{ color: 'rgba(255,255,255,0.45)' }}>
        Выбери факультет и нажми «Войти»
      </p>
      <div className="grid gap-2">
        {FACULTY_PROMOS.map(promo => (
          <FacultyCard
            key={promo.id}
            promo={promo}
            active={active?.id === promo.id}
            filled={code === promo.code}
            disabled={disabled}
            onSelect={() => onSelect(promo)}
          />
        ))}
      </div>
    </div>
  );
}
