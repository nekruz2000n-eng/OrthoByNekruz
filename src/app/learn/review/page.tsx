'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { LearnLayout } from '@/components/OrthoLayout';
import { GameWrapper } from '@/components/GameWrapper';
import { loadProgress, getDueCards, cardKey } from '@/lib/progress';
import { loadOrthoData, getQuestionById, pickGameMode } from '@/lib/data';
import type { OrthoData, Question } from '@/types/data';

export default function ReviewPage() {
  const [data, setData] = useState<OrthoData | null>(null);
  const [queue, setQueue] = useState<Question[]>([]);
  const [idx, setIdx] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    loadOrthoData().then(d => {
      setData(d);
      const progress = loadProgress();
      const due = getDueCards(progress).filter(c => c.type === 'question');
      const qs = due
        .map(c => getQuestionById(d, Number(c.id)))
        .filter(Boolean) as Question[];
      setQueue(qs);
    });
  }, []);

  const current = queue[idx];
  const progress = loadProgress();
  const mode = useMemo(() => {
    if (!current) return 'flashcard';
    const card = progress.cards[cardKey(current.id, 'question')];
    return card ? pickGameMode(current, card) : 'flashcard';
  }, [current, progress]);

  if (!data) {
    return (
      <LearnLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="animate-spin" style={{ color: 'var(--c-primary)' }} />
        </div>
      </LearnLayout>
    );
  }

  if (queue.length === 0) {
    return (
      <LearnLayout>
        <div className="flex flex-col items-center justify-center h-full px-6 text-center">
          <p className="text-4xl mb-3">✅</p>
          <h2 className="text-lg font-bold" style={{ color: 'var(--c-text)' }}>Всё повторено!</h2>
          <p className="text-sm mt-2" style={{ color: 'var(--c-muted)' }}>Нет карточек на сегодня</p>
        </div>
      </LearnLayout>
    );
  }

  if (done || !current) {
    return (
      <LearnLayout>
        <div className="flex flex-col items-center justify-center h-full px-6 text-center gap-4">
          <p className="text-4xl">🎉</p>
          <h2 className="text-xl font-bold" style={{ color: 'var(--c-text)' }}>Повторение завершено</h2>
          <p style={{ color: 'var(--c-muted)' }}>{queue.length} карточек</p>
        </div>
      </LearnLayout>
    );
  }

  return (
    <LearnLayout>
      <div className="h-full flex flex-col">
        <GameWrapper
          question={current}
          mode={mode}
          sessionIndex={idx}
          sessionTotal={queue.length}
          onNext={() => {
            if (idx + 1 >= queue.length) setDone(true);
            else setIdx(i => i + 1);
          }}
        />
      </div>
    </LearnLayout>
  );
}
