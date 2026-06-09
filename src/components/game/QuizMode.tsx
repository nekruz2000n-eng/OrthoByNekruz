'use client';

import React, { useMemo, useState } from 'react';
import type { Question } from '@/types/data';
import { shuffle } from '@/lib/shuffle';
import { SourceBadge } from '@/components/ui/SourceBadge';
import type { Quality } from '@/lib/progress';

interface QuizModeProps {
  question: Question;
  onResult: (correct: boolean, quality: Quality) => void;
}

export function QuizMode({ question, onResult }: QuizModeProps) {
  const [picked, setPicked] = useState<string | null>(null);
  const options = useMemo(() => {
    const { correct, distractors } = question.quiz_options;
    return shuffle([correct, ...distractors]);
  }, [question]);

  const handlePick = (opt: string) => {
    if (picked) return;
    setPicked(opt);
    const ok = opt === question.quiz_options.correct;
    setTimeout(() => onResult(ok, ok ? 3 : 0), 1200);
  };

  return (
    <div className="space-y-4">
      <p className="text-base font-medium leading-relaxed" style={{ color: 'var(--c-text)' }}>
        {question.question.replace(/\*\*/g, '')}
      </p>

      <div className="space-y-2">
        {options.map(opt => {
          const isCorrect = opt === question.quiz_options.correct;
          const show = picked !== null;
          let bg = 'var(--c-card)';
          let border = 'var(--c-border)';
          if (show && opt === picked) {
            bg = isCorrect ? 'var(--c-primary-dim)' : 'var(--c-danger-soft)';
            border = isCorrect ? 'var(--c-primary)' : 'var(--c-danger)';
          } else if (show && isCorrect) {
            bg = 'var(--c-primary-dim)';
            border = 'var(--c-primary)';
          }
          return (
            <button
              key={opt}
              type="button"
              disabled={!!picked}
              onClick={() => handlePick(opt)}
              className="w-full min-h-[48px] px-4 py-3 rounded-xl text-left text-sm"
              style={{ background: bg, border: `1px solid ${border}`, color: 'var(--c-text)' }}
            >
              {show && opt === picked && (isCorrect ? '✅ ' : '❌ ')}
              {opt}
            </button>
          );
        })}
      </div>

      {picked && (
        <div className="p-4 rounded-xl text-sm" style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
          <p className="font-medium mb-1">{picked === question.quiz_options.correct ? 'Правильно!' : 'Неверно'}</p>
          <p style={{ color: 'var(--c-muted)' }}>{question.short_answer}</p>
          <SourceBadge source={question.source} excerpt={question.book_excerpt} />
        </div>
      )}
    </div>
  );
}
