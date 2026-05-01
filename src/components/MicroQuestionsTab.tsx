"use client";

// ─── MicroQuestionsTab.tsx ────────────────────────────────────────────────────
// ПУСТЫШКА — компонент вкладки "Вопросы" для предмета Микробиология
//
// Это точная копия структуры QuestionsTab.tsx, но импортирует данные
// из micro_questions.json и micro_glossary.json.
//
// КАК ЗАПОЛНИТЬ:
//   1. Заполните /data/micro_questions.json вопросами и ответами
//   2. Заполните /data/micro_glossary.json терминами
//   3. Удалите этот комментарий и TODO-заглушку ниже
//   4. Скопируйте полную логику из QuestionsTab.tsx, заменив импорты данных
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { ToothIcon } from './ToothIcon';

// TODO: раскомментировать когда данные заполнены:
// import questionsData from '@/data/micro_questions.json';
// import glossaryData  from '@/data/micro_glossary.json';

// Пустышка данных для отображения заглушки
const questionsData: any[] = [];

export const MicroQuestionsTab = () => {
  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{ background: 'var(--c-bg)' }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 sticky top-0 z-10"
        style={{
          background:        'color-mix(in srgb, var(--c-bg) 92%, transparent)',
          backdropFilter:    'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom:      '1px solid var(--c-border)',
          paddingTop:        'var(--header-pt)',
        }}
      >
        <div className="flex items-center gap-3 px-1">
          <ToothIcon className="w-9 h-9" style={{ color: 'var(--c-amber)' }} />
          <div>
            <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--c-text)' }}>
              OrthoByNekruz
            </h1>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--c-amber)' }}>
              Микробиология
            </p>
          </div>
        </div>
      </div>

      {/* Empty state */}
      <div
        className="flex-1 flex flex-col items-center justify-center gap-5 px-8 text-center"
        style={{ paddingBottom: 'var(--scroll-pb)' }}
      >
        <div
          className="w-20 h-20 rounded-[24px] flex items-center justify-center"
          style={{
            background: 'var(--c-amber-dim)',
            border:     '1.5px solid var(--c-amber-br)',
          }}
        >
          <ToothIcon className="w-12 h-12" style={{ color: 'var(--c-amber)' }} />
        </div>

        <div>
          <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--c-text)' }}>
            Вопросы по микробиологии
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--c-muted)' }}>
            Раздел в разработке.{'\n'}
            Заполните{' '}
            <code
              className="text-xs px-1.5 py-0.5 rounded"
              style={{ background: 'var(--c-amber-dim)', color: 'var(--c-amber)' }}
            >
              data/micro_questions.json
            </code>{' '}
            чтобы вопросы появились здесь.
          </p>
        </div>

        <div
          className="w-full max-w-xs rounded-2xl p-4 text-left"
          style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}
        >
          <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--c-muted)' }}>
            Прогресс
          </p>
          <div className="text-2xl font-bold" style={{ color: 'var(--c-text)' }}>
            0<span className="text-sm font-normal" style={{ color: 'var(--c-muted)' }}> / {questionsData.length || '—'}</span>
          </div>
          <div
            className="h-1.5 w-full rounded-full mt-3 overflow-hidden"
            style={{ background: 'var(--c-border)' }}
          >
            <div
              className="h-full rounded-full"
              style={{ width: '0%', background: 'var(--c-amber)' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
