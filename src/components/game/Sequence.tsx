'use client';

import React, { useMemo, useState } from 'react';
import type { Question } from '@/types/data';
import { shuffle } from '@/lib/shuffle';
import type { Quality } from '@/lib/progress';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface SequenceProps {
  question: Question;
  onResult: (correct: boolean, quality: Quality) => void;
}

export function Sequence({ question, onResult }: SequenceProps) {
  const seq = question.sequence;
  const correct = seq?.steps ?? [];
  const [order, setOrder] = useState<string[]>(() => shuffle(correct));
  const [checked, setChecked] = useState(false);

  if (!seq || correct.length === 0) {
    return <p className="text-sm" style={{ color: 'var(--c-muted)' }}>Нет шагов для упорядочивания.</p>;
  }

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
  };

  const handleCheck = () => {
    setChecked(true);
    const ok = order.every((s, i) => s === correct[i]);
    setTimeout(() => onResult(ok, ok ? 3 : 0), 1500);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium" style={{ color: 'var(--c-text)' }}>{seq.title}</p>
      <p className="text-xs" style={{ color: 'var(--c-muted)' }}>Расставь шаги в правильном порядке (↑↓)</p>

      <div className="space-y-2">
        {order.map((step, i) => {
          const isOk = checked && step === correct[i];
          const isBad = checked && step !== correct[i];
          return (
            <div
              key={`${step}-${i}`}
              className="flex items-center gap-2 p-3 rounded-xl min-h-[48px]"
              style={{
                background: isOk ? 'var(--c-primary-dim)' : isBad ? 'var(--c-danger-soft)' : 'var(--c-card)',
                border: `1px solid ${isOk ? 'var(--c-primary)' : isBad ? 'var(--c-danger)' : 'var(--c-border)'}`,
              }}
            >
              <span className="flex-1 text-sm" style={{ color: 'var(--c-text)' }}>{step}</span>
              {!checked && (
                <div className="flex flex-col">
                  <button type="button" onClick={() => move(i, -1)} className="p-2 min-w-[44px] min-h-[22px] flex items-center justify-center" aria-label="Вверх">
                    <ChevronUp size={18} />
                  </button>
                  <button type="button" onClick={() => move(i, 1)} className="p-2 min-w-[44px] min-h-[22px] flex items-center justify-center" aria-label="Вниз">
                    <ChevronDown size={18} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!checked && (
        <button type="button" onClick={handleCheck} className="w-full min-h-[48px] rounded-xl font-semibold" style={{ background: 'var(--c-primary)', color: 'var(--c-bg)' }}>
          Проверить
        </button>
      )}

      {checked && (
        <div className="text-xs p-3 rounded-xl" style={{ background: 'var(--c-card)', color: 'var(--c-muted)' }}>
          Правильный порядок: {correct.join(' → ')}
        </div>
      )}
    </div>
  );
}
