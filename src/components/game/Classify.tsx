'use client';

import React, { useState } from 'react';
import type { Question } from '@/types/data';
import type { Quality } from '@/lib/progress';

interface ClassifyProps {
  question: Question;
  onResult: (correct: boolean, quality: Quality) => void;
}

export function Classify({ question, onResult }: ClassifyProps) {
  const data = question.classify;
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);

  if (!data?.categories?.length) {
    return <p className="text-sm" style={{ color: 'var(--c-muted)' }}>Нет данных для классификации.</p>;
  }

  const pool = data.pool ?? [];
  const unassigned = pool.filter(item => !Object.values(assignments).includes(item));

  const handleCheck = () => {
    setChecked(true);
    let ok = true;
    for (const cat of data.categories) {
      for (const item of cat.items) {
        if (assignments[item] !== cat.name) ok = false;
      }
    }
    setTimeout(() => onResult(ok, ok ? 3 : 0), 1500);
  };

  return (
    <div className="space-y-4">
      {unassigned.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {unassigned.map(item => (
            <span key={item} className="px-3 py-2 rounded-xl text-xs" style={{ background: 'var(--c-chip)', color: 'var(--c-text)' }}>
              {item}
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {data.categories.map(cat => (
          <div key={cat.name} className="p-3 rounded-xl min-h-[100px]" style={{ border: '1px dashed var(--c-border)' }}>
            <p className="text-xs font-bold mb-2" style={{ color: 'var(--c-muted)' }}>{cat.name}</p>
            {pool.map(item => (
              <button
                key={item}
                type="button"
                disabled={checked}
                onClick={() => setAssignments(a => ({ ...a, [item]: cat.name }))}
                className={`block w-full text-left text-xs px-2 py-2 rounded-lg mb-1 min-h-[36px] ${assignments[item] === cat.name ? 'ring-2 ring-primary' : ''}`}
                style={{
                  background: assignments[item] === cat.name ? 'var(--c-primary-dim)' : 'transparent',
                  color: 'var(--c-text)',
                  opacity: assignments[item] && assignments[item] !== cat.name ? 0.3 : 1,
                }}
              >
                {assignments[item] === cat.name ? item : '+'}
              </button>
            ))}
          </div>
        ))}
      </div>

      {!checked && (
        <button
          type="button"
          onClick={handleCheck}
          disabled={unassigned.length > 0}
          className="w-full min-h-[48px] rounded-xl font-semibold disabled:opacity-40"
          style={{ background: 'var(--c-primary)', color: 'var(--c-bg)' }}
        >
          Проверить
        </button>
      )}
    </div>
  );
}
