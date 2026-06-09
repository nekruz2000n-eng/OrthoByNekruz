'use client';

import React, { useMemo, useState } from 'react';
import type { Question } from '@/types/data';
import { shuffle } from '@/lib/shuffle';
import type { Quality } from '@/lib/progress';

interface TrueFalseProps {
  question: Question;
  onResult: (correct: boolean, quality: Quality) => void;
}

export function TrueFalse({ question, onResult }: TrueFalseProps) {
  const statements = useMemo(
    () => shuffle(question.true_false_statements),
    [question],
  );
  const [idx, setIdx] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [lastOk, setLastOk] = useState(false);

  const stmt = statements[idx];
  if (!stmt) return null;

  const handle = (userSaysTrue: boolean) => {
    if (answered) return;
    const ok = userSaysTrue === stmt.answer;
    setLastOk(ok);
    setAnswered(true);
    setTimeout(() => {
      if (idx + 1 >= statements.length) {
        onResult(ok, ok ? 3 : 0);
      } else {
        setIdx(i => i + 1);
        setAnswered(false);
      }
    }, 1000);
  };

  return (
    <div className="space-y-4">
      <p className="text-xs" style={{ color: 'var(--c-muted)' }}>
        Утверждение {idx + 1}/{statements.length}
      </p>
      <p className="text-base leading-relaxed p-4 rounded-2xl" style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)', color: 'var(--c-text)' }}>
        {stmt.statement}
      </p>

      {!answered ? (
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handle(true)}
            className="min-h-[48px] rounded-xl font-semibold"
            style={{ background: 'var(--c-primary-dim)', color: 'var(--c-primary-strong)', border: '1px solid var(--c-primary-br)' }}
          >
            ✅ Верно
          </button>
          <button
            type="button"
            onClick={() => handle(false)}
            className="min-h-[48px] rounded-xl font-semibold"
            style={{ background: 'var(--c-danger-soft)', color: 'var(--c-danger)', border: '1px solid var(--c-danger)' }}
          >
            ❌ Неверно
          </button>
        </div>
      ) : (
        <div className="p-4 rounded-xl text-sm" style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
          <p className="font-medium mb-1">{lastOk ? '✅ Верно!' : '❌ Неверно'}</p>
          <p style={{ color: 'var(--c-muted)' }}>Правильный ответ: {stmt.answer ? 'Верно' : 'Неверно'}</p>
          <p className="mt-2" style={{ color: 'var(--c-text)' }}>{question.short_answer}</p>
        </div>
      )}
    </div>
  );
}
