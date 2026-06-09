'use client';

import React, { useMemo, useState } from 'react';
import type { Question } from '@/types/data';
import { shuffle } from '@/lib/shuffle';
import type { Quality } from '@/lib/progress';

interface FillBlankProps {
  question: Question;
  onResult: (correct: boolean, quality: Quality) => void;
}

export function FillBlank({ question, onResult }: FillBlankProps) {
  const items = question.fill_in_blank ?? [];
  const item = items[0];
  const [mode, setMode] = useState<'text' | 'choice'>('choice');
  const [value, setValue] = useState('');
  const [done, setDone] = useState(false);
  const [ok, setOk] = useState(false);

  const choices = useMemo(() => {
    if (!item) return [];
    const others = (question.keywords || []).filter(k => k !== item.answer).slice(0, 2);
    return shuffle([item.answer, ...others, 'Другое']);
  }, [item, question.keywords]);

  if (!item) {
    return <p className="text-sm" style={{ color: 'var(--c-muted)' }}>Нет данных для этого режима.</p>;
  }

  const check = (ans: string) => {
    const correct = ans.trim().toLowerCase() === item.answer.trim().toLowerCase();
    setOk(correct);
    setDone(true);
    setTimeout(() => onResult(correct, correct ? 2 : 0), 1200);
  };

  return (
    <div className="space-y-4">
      <p className="text-base" style={{ color: 'var(--c-text)' }}>
        {item.template.replace('___', mode === 'text' ? '______' : '…')}
      </p>

      <div className="flex gap-2">
        <button type="button" onClick={() => setMode('choice')} className="text-xs px-3 py-1 rounded-lg" style={{ background: mode === 'choice' ? 'var(--c-primary-dim)' : 'var(--c-card)' }}>Выбор</button>
        <button type="button" onClick={() => setMode('text')} className="text-xs px-3 py-1 rounded-lg" style={{ background: mode === 'text' ? 'var(--c-primary-dim)' : 'var(--c-card)' }}>Ввод</button>
      </div>

      {!done && mode === 'text' && (
        <div className="space-y-2">
          <input
            value={value}
            onChange={e => setValue(e.target.value)}
            className="w-full min-h-[48px] px-4 rounded-xl text-base"
            style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)', color: 'var(--c-text)' }}
            placeholder="Введи ответ"
          />
          <button type="button" onClick={() => check(value)} className="w-full min-h-[48px] rounded-xl font-semibold" style={{ background: 'var(--c-primary)', color: 'var(--c-bg)' }}>
            Проверить
          </button>
        </div>
      )}

      {!done && mode === 'choice' && (
        <div className="space-y-2">
          {choices.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => check(c)}
              className="w-full min-h-[48px] px-4 rounded-xl text-left text-sm"
              style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)', color: 'var(--c-text)' }}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {done && (
        <div className="p-4 rounded-xl text-sm" style={{ background: ok ? 'var(--c-primary-dim)' : 'var(--c-danger-soft)' }}>
          {ok ? '✅ Верно!' : `❌ Подсказка: ${item.hint}`}
        </div>
      )}
    </div>
  );
}
