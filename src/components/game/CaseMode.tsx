'use client';

import React, { useState } from 'react';
import type { Case } from '@/types/data';
import type { Quality } from '@/lib/progress';

interface CaseModeProps {
  caseItem: Case;
  onResult: (correct: boolean, quality: Quality) => void;
}

export function CaseMode({ caseItem, onResult }: CaseModeProps) {
  const [stepIdx, setStepIdx] = useState(-1);
  const [showAnswer, setShowAnswer] = useState(false);
  const steps = caseItem.steps ?? [];

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap" style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)', color: 'var(--c-text)' }}>
        {caseItem.scenario.replace(/\*\*/g, '')}
      </div>

      <div className="p-4 rounded-2xl" style={{ borderTop: '2px solid var(--c-border)' }}>
        <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--c-text)' }}>
          {caseItem.question.replace(/\*\*/g, '')}
        </p>
      </div>

      {steps.length > 0 && (
        <button
          type="button"
          onClick={() => setStepIdx(i => Math.min(i + 1, steps.length - 1))}
          disabled={stepIdx >= steps.length - 1}
          className="w-full min-h-[48px] rounded-xl text-sm font-semibold"
          style={{ background: 'var(--c-primary-dim)', color: 'var(--c-primary-strong)', border: '1px solid var(--c-primary-br)' }}
        >
          {stepIdx < 0 ? 'Показать подсказку' : `Подсказка ${stepIdx + 1}/${steps.length}`}
        </button>
      )}

      {stepIdx >= 0 && steps[stepIdx] && (
        <p className="text-sm p-3 rounded-xl" style={{ background: 'var(--c-amber-soft)', color: 'var(--c-text)' }}>
          {steps[stepIdx]}
        </p>
      )}

      {!showAnswer ? (
        <button
          type="button"
          onClick={() => setShowAnswer(true)}
          className="w-full min-h-[48px] rounded-xl font-semibold"
          style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)', color: 'var(--c-text)' }}
        >
          Показать ответ
        </button>
      ) : (
        <>
          <div className="p-4 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed" style={{ background: 'var(--c-primary-dim)', color: 'var(--c-text)' }}>
            {caseItem.answer.replace(/\*\*/g, '')}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => onResult(false, 0)} className="min-h-[48px] rounded-xl font-semibold" style={{ background: 'var(--c-danger-soft)', color: 'var(--c-danger)' }}>
              Не справился
            </button>
            <button type="button" onClick={() => onResult(true, 2)} className="min-h-[48px] rounded-xl font-semibold" style={{ background: 'var(--c-primary)', color: 'var(--c-bg)' }}>
              Справился
            </button>
          </div>
        </>
      )}
    </div>
  );
}
