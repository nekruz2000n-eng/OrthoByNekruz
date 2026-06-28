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
  @keyframes authCampusKenBurns {
    0% { transform: scale(1.08) translate(0, 0); }
    100% { transform: scale(1.18) translate(-2%, -1%); }
  }
  @keyframes authCampusKenBurnsAlt {
    0% { transform: scale(1.12) translate(-1%, 0); }
    100% { transform: scale(1.22) translate(1%, -2%); }
  }
  @keyframes authAuroraShift {
    0%, 100% { opacity: 0.5; transform: translateX(-5%) scale(1); }
    50% { opacity: 0.85; transform: translateX(5%) scale(1.08); }
  }
`;

const CAMPUS_AERIAL = '/images/auth/campus-aerial.png';
const CAMPUS_FRONT = '/images/auth/campus-front.png';
const CAMPUS_RED = '#C41E3A';

/** Полноэкранный фон: реальные фото кампуса КрасГМУ + затемнение для читаемости. */
export function AuthCampusBackdrop({ facultyId }: { facultyId: string | null }) {
  const theme = facultyId ? FACULTY_AUTH_THEME[facultyId as FacultyId] : null;
  const accentGlow = theme?.accent.glow ?? 'rgba(196, 30, 58, 0.25)';

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      <style>{AUTH_ANIM_STYLES}</style>

      {/* фото с улицы — купол и «МЕДИЦИНСКИЙ» */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={CAMPUS_FRONT}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        style={{
          objectPosition: 'center 35%',
          animation: facultyId ? 'authCampusKenBurnsAlt 22s ease-in-out infinite alternate' : 'authCampusKenBurns 22s ease-in-out infinite alternate',
          filter: 'saturate(1.05) contrast(1.05)',
        }}
        draggable={false}
      />

      {/* лёгкий слой с aerial для глубины (верх экрана) */}
      <div
        className="absolute inset-0 opacity-[0.22]"
        style={{
          backgroundImage: `url(${CAMPUS_AERIAL})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center 20%',
          mixBlendMode: 'soft-light',
        }}
      />

      {/* цвета корпуса: жёлтый + синий купол + красный цоколь */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            linear-gradient(180deg,
              rgba(8, 10, 12, 0.92) 0%,
              rgba(8, 10, 12, 0.55) 28%,
              rgba(8, 10, 12, 0.35) 48%,
              rgba(8, 10, 12, 0.72) 78%,
              rgba(8, 10, 12, 0.96) 100%
            )
          `,
        }}
      />

      {/* красный оттенок снизу — цоколь здания */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(0deg, rgba(139, 26, 26, 0.35) 0%, transparent 45%)`,
        }}
      />

      {/* синий блик купола сверху */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 70% 40% at 50% 18%, rgba(59, 130, 246, 0.12) 0%, transparent 70%)`,
        }}
      />

      {/* акцент факультета */}
      {theme && (
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse 90% 55% at 50% 100%, ${accentGlow} 0%, transparent 65%)`,
            animation: 'authAuroraShift 6s ease-in-out infinite',
          }}
        />
      )}
    </div>
  );
}

export function AuthHeroTitle({ onTitleClick }: { onTitleClick?: () => void }) {
  return (
    <div className="flex flex-col items-center text-center space-y-2">
      <p
        className="text-[10px] font-semibold uppercase tracking-[0.28em]"
        style={{ color: 'rgba(196, 30, 58, 0.75)' }}
      >
        Красноярский мед. университет
      </p>
      <h1
        className="text-[2.75rem] font-black tracking-tighter select-none cursor-default leading-none"
        onClick={onTitleClick}
        style={{
          background: 'linear-gradient(135deg, #FFFFFF 0%, #F8F8F8 40%, #E8A0A8 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          filter: 'drop-shadow(0 2px 24px rgba(196, 30, 58, 0.35))',
        }}
      >
        КрасГМУ
      </h1>
      <div
        className="h-[2px] w-16 rounded-full"
        style={{
          background: `linear-gradient(90deg, transparent, ${CAMPUS_RED}, transparent)`,
        }}
      />
    </div>
  );
}

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
      maxOpacity: facultyId ? 0.22 : 0.1,
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
    <div className="max-w-[300px] mx-auto flex flex-col" style={{ animation: 'authFacultyHintPop 0.45s ease forwards' }}>
      <p
        className="m-0"
        style={{ fontSize: 20, fontWeight: 700, color: '#FFFFFF', lineHeight: 1.4 }}
      >
        Не важно когда ты начал —{'\u00A0'}важно что всё нужное уже здесь.
      </p>
      <p
        className="m-0"
        style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 1.4, marginTop: 8 }}
      >
        Билеты, задачи, глоссарий — под твой факультет и твою группу.
      </p>
      <p
        className="m-0"
        style={{ fontSize: 13, color: '#a3e635', fontWeight: 600, lineHeight: 1.4, marginTop: 16 }}
      >
        200+ студентов КрасГМУ уже готовятся здесь.
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
