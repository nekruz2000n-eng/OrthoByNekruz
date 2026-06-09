'use client';

import React, { useState } from 'react';
import type { Question } from '@/types/data';
import { SourceBadge } from '@/components/ui/SourceBadge';
import type { Quality } from '@/lib/progress';

interface FlashCardProps {
  question: Question;
  onResult: (correct: boolean, quality: Quality) => void;
}

const BTNS: { q: Quality; label: string }[] = [
  { q: 0, label: 'Не знал 😔' },
  { q: 1, label: 'С трудом 😐' },
  { q: 2, label: 'Нормально 👍' },
  { q: 3, label: 'Легко ⚡' },
];

export function FlashCard({ question, onResult }: FlashCardProps) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => !flipped && setFlipped(true)}
        className="w-full min-h-[180px] p-5 rounded-2xl text-left transition-transform active:scale-[0.99]"
        style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}
      >
        <p className="text-xs mb-2" style={{ color: 'var(--c-muted)' }}>
          {flipped ? 'Ответ' : 'Вопрос — нажми, чтобы перевернуть'}
        </p>
        <p className="text-base font-medium leading-relaxed" style={{ color: 'var(--c-text)' }}>
          {flipped ? question.short_answer : question.question.replace(/\*\*/g, '')}
        </p>
      </button>

      {question.mnemonic && (
        <p className="text-sm px-3 py-2 rounded-xl" style={{ background: 'var(--c-amber-soft)', color: 'var(--c-text)' }}>
          💡 {question.mnemonic}
        </p>
      )}

      <SourceBadge source={question.source} excerpt={question.book_excerpt} />

      {flipped && (
        <div className="grid grid-cols-2 gap-2">
          {BTNS.map(b => (
            <button
              key={b.q}
              type="button"
              onClick={() => onResult(b.q >= 2, b.q)}
              className="min-h-[48px] px-3 py-2 rounded-xl text-sm font-semibold"
              style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)', color: 'var(--c-text)' }}
            >
              {b.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
