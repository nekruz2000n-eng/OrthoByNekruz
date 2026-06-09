'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronRight, Database, Layers } from 'lucide-react';

interface LearnModuleEntryProps {
  accentColor?: string;
  compact?: boolean;
}

/** Вход в /learn — сравнение одного JSON vs нескольких файлов по предмету. */
export function LearnModuleEntry({ accentColor = 'var(--c-primary)', compact = false }: LearnModuleEntryProps) {
  return (
    <Link
      href="/learn"
      className={`block rounded-[18px] transition-transform active:scale-[0.98] ${compact ? 'p-3' : 'p-4'}`}
      style={{
        background: 'color-mix(in srgb, var(--c-info) 10%, var(--c-card))',
        border: '1px solid color-mix(in srgb, var(--c-info) 35%, var(--c-border))',
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'color-mix(in srgb, var(--c-info) 18%, transparent)' }}
        >
          <Layers className="w-5 h-5" style={{ color: 'var(--c-info)' }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold" style={{ color: 'var(--c-text)' }}>
              Сравнить загрузку данных
            </p>
            <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--c-muted)' }} />
          </div>

          {!compact && (
            <div className="mt-2 space-y-1.5 text-[11px] leading-snug" style={{ color: 'var(--c-muted)' }}>
              <p className="flex items-start gap-1.5">
                <Database className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: accentColor }} />
                <span><strong style={{ color: 'var(--c-text)' }}>Сейчас</strong> — 4 JSON через API: вопросы, тесты, задачи, глоссарий</span>
              </p>
              <p className="flex items-start gap-1.5">
                <Layers className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: 'var(--c-info)' }} />
                <span><strong style={{ color: 'var(--c-text)' }}>/learn</strong> — один orthopedics.json + localStorage</span>
              </p>
            </div>
          )}

          {compact && (
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--c-muted)' }}>
              4 JSON vs один orthopedics.json
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
