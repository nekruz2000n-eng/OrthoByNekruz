'use client';

import React, { useMemo, useState } from 'react';
import type { Question } from '@/types/data';
import { shuffle } from '@/lib/shuffle';
import type { Quality } from '@/lib/progress';

interface MatchPairsProps {
  question: Question;
  onResult: (correct: boolean, quality: Quality) => void;
}

export function MatchPairs({ question, onResult }: MatchPairsProps) {
  const pairs = question.match_pairs ?? [];
  const defs = useMemo(() => shuffle(pairs.map(p => p.definition)), [pairs]);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);

  if (pairs.length === 0) {
    return <p className="text-sm" style={{ color: 'var(--c-muted)' }}>Нет пар для сопоставления.</p>;
  }

  const handleCheck = () => {
    setChecked(true);
    const allOk = pairs.every(p => selected[p.term] === p.definition);
    setTimeout(() => onResult(allOk, allOk ? 3 : 0), 1500);
  };

  return (
    <div className="space-y-4">
      {pairs.map(p => {
        const userDef = selected[p.term];
        const isOk = checked && userDef === p.definition;
        const isBad = checked && userDef && userDef !== p.definition;
        return (
          <div key={p.term} className="space-y-1">
            <p className="text-sm font-medium" style={{ color: 'var(--c-text)' }}>{p.term}</p>
            <select
              value={userDef || ''}
              disabled={checked}
              onChange={e => setSelected(s => ({ ...s, [p.term]: e.target.value }))}
              className="w-full min-h-[48px] px-3 rounded-xl text-sm"
              style={{
                background: isOk ? 'var(--c-primary-dim)' : isBad ? 'var(--c-danger-soft)' : 'var(--c-card)',
                border: `1px solid ${isOk ? 'var(--c-primary)' : isBad ? 'var(--c-danger)' : 'var(--c-border)'}`,
                color: 'var(--c-text)',
              }}
            >
              <option value="">Выбери определение</option>
              {defs.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        );
      })}

      {!checked && (
        <button
          type="button"
          onClick={handleCheck}
          disabled={pairs.some(p => !selected[p.term])}
          className="w-full min-h-[48px] rounded-xl font-semibold disabled:opacity-40"
          style={{ background: 'var(--c-primary)', color: 'var(--c-bg)' }}
        >
          Проверить
        </button>
      )}
    </div>
  );
}
