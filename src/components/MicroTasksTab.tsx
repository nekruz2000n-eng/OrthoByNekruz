"use client";

// ─── MicroTasksTab.tsx ────────────────────────────────────────────────────────
// ПУСТЫШКА — компонент вкладки "Задачи" для предмета Микробиология
//
// КАК ЗАПОЛНИТЬ:
//   1. Заполните /data/micro_tasks.json задачами и решениями
//   2. Удалите заглушку и скопируйте полную логику из TasksTab.tsx,
//      заменив импорт: import tasksData from '@/data/micro_tasks.json'
//      и localStorage ключи: 'resolvedMicroTasks', 'userMicroTaskNotes'
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { ToothIcon } from './ToothIcon';

const tasksData: any[] = [];

export const MicroTasksTab = ({ onSecretTap }: { onSecretTap?: () => void }) => {
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
            <ToothIcon
              className="w-9 h-9"
              style={{ color: 'var(--c-amber)' }}
              onClick={onSecretTap}
            />
            <div>
              <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--c-text)' }}>
                OrthoByNekruz
              </h1>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--c-amber)' }}>
                Микробиология
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest" style={{ color: 'var(--c-amber)' }}>
              0/{tasksData.length || '—'}
            </span>
            <div className="w-16 h-1 rounded-full overflow-hidden" style={{ background: 'var(--c-border)' }}>
              <div className="h-full rounded-full" style={{ width: '0%', background: 'var(--c-amber)' }} />
            </div>
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
          style={{ background: 'var(--c-amber-dim)', border: '1.5px solid var(--c-amber-br)' }}
        >
          <ToothIcon className="w-12 h-12" style={{ color: 'var(--c-amber)' }} />
        </div>
        <div>
          <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--c-text)' }}>
            Задачи по микробиологии
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--c-muted)' }}>
            Раздел в разработке.{'\n'}
            Заполните{' '}
            <code
              className="text-xs px-1.5 py-0.5 rounded"
              style={{ background: 'var(--c-amber-dim)', color: 'var(--c-amber)' }}
            >
              data/micro_tasks.json
            </code>
          </p>
        </div>
      </div>
    </div>
  );
};
