"use client";

import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { FACULTY_PROMOS, type FacultyPromo } from '@/lib/facultyCodes';

const FACULTY_ACCENT: Record<string, { border: string; bg: string }> = {
  stomatology: { border: 'rgba(52, 211, 153, 0.45)',  bg: 'rgba(52, 211, 153, 0.12)' },
  therapeutic: { border: 'rgba(96, 165, 250, 0.45)',  bg: 'rgba(96, 165, 250, 0.12)' },
  pediatrics:  { border: 'rgba(251, 191, 36, 0.45)',  bg: 'rgba(251, 191, 36, 0.12)' },
};

const SHORT_LABEL: Record<string, string> = {
  stomatology: 'Стоматология',
  therapeutic: 'Лечебный',
  pediatrics:  'Педиатрия',
};

interface Props {
  saving: boolean;
  onSelect: (promo: FacultyPromo) => void;
}

export const FacultyPickerModal: React.FC<Props> = ({ saving, onSelect }) => {
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-5"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)' }}
    >
      <div
        className="w-full max-w-md rounded-3xl p-6 shadow-2xl"
        style={{
          background: 'var(--c-card, hsl(var(--card)))',
          border: '1px solid var(--c-border, hsl(var(--border)))',
        }}
      >
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">🎓</div>
          <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--c-text)' }}>
            Выберите факультет
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--c-muted)' }}>
            Чтобы показывать вопросы и задачи вашего факультета, укажите, где вы учитесь.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {FACULTY_PROMOS.map(promo => {
            const accent = FACULTY_ACCENT[promo.id] ?? FACULTY_ACCENT.stomatology;
            const active = hovered === promo.id;
            return (
              <button
                key={promo.id}
                type="button"
                disabled={saving}
                onMouseEnter={() => setHovered(promo.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => onSelect(promo)}
                className="w-full flex items-center gap-4 rounded-2xl px-4 py-4 text-left transition-all active:scale-[0.98] disabled:opacity-60"
                style={{
                  border: `1.5px solid ${active ? accent.border : 'var(--c-border)'}`,
                  background: active ? accent.bg : 'var(--c-surface, transparent)',
                }}
              >
                <span className="text-3xl shrink-0" style={{ fontFamily: 'Apple Color Emoji, Segoe UI Emoji, sans-serif' }}>
                  {promo.digitIcon}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] font-semibold" style={{ color: 'var(--c-text)' }}>
                    {SHORT_LABEL[promo.id] ?? promo.facultyLabel}
                  </span>
                  <span className="block text-xs mt-0.5" style={{ color: 'var(--c-muted)' }}>
                    {promo.facultyLabel}
                  </span>
                </span>
                {saving ? (
                  <Loader2 className="w-5 h-5 animate-spin shrink-0" style={{ color: 'var(--c-primary)' }} />
                ) : (
                  <span className="text-lg shrink-0" style={{ color: 'var(--c-muted)' }}>›</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
