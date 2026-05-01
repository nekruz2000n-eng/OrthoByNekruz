"use client";

// ─── MicroTestsTab.tsx ────────────────────────────────────────────────────────
// ПУСТЫШКА — компонент вкладки "Тесты" для предмета Микробиология
//
// КАК ЗАПОЛНИТЬ:
//   1. Заполните /data/micro_tests.json тестами (мин. 20 для одного блока)
//   2. Удалите заглушку и скопируйте полную логику из TestsTab.tsx,
//      заменив импорт: import testsData from '@/data/micro_tests.json'
//      и localStorage ключ: 'micro_test_block_scores'
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { ToothIcon } from './ToothIcon';

const testsData: any[] = [];

export const MicroTestsTab = () => {
  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{ background: 'var(--c-bg)' }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 sticky top-0 z-10"
        style={{
          background:           'color-mix(in srgb, var(--c-bg) 92%, transparent)',
          backdropFilter:       'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom:         '1px solid var(--c-border)',
          paddingTop:           'var(--header-pt)',
        }}
      >
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-3">
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
          <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: 'var(--c-muted)' }}>
            {testsData.length} тестов
          </span>
        </div>
      </div>

      {/* Empty state */}
      <div
        className="flex-1 flex flex-col items-center justify-center gap-5 px-8 text-center"
        style={{ paddingBottom: 'var(--scroll-pb)' }}
      >
        <div
          className="w-20 h-20 rounded-[24px] flex items-center justify-center"
          style={{ background: 'var(--c-amber-dim)', border: '1.5px solid var(--c-amber-br)' }}
        >
          <ToothIcon className="w-12 h-12" style={{ color: 'var(--c-amber)' }} />
        </div>
        <div>
          <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--c-text)' }}>
            Тесты по микробиологии
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--c-muted)' }}>
            Раздел в разработке.{'\n'}
            Заполните{' '}
            <code
              className="text-xs px-1.5 py-0.5 rounded"
              style={{ background: 'var(--c-amber-dim)', color: 'var(--c-amber)' }}
            >
              data/micro_tests.json
            </code>
          </p>
        </div>
      </div>
    </div>
  );
};
