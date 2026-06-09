'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { LearnLayout } from '@/components/OrthoLayout';
import { GameWrapper } from '@/components/GameWrapper';
import { loadOrthoData, buildStudySession, sortNewQuestions } from '@/lib/data';
import { loadProgress } from '@/lib/progress';
import type { OrthoData, Question } from '@/types/data';

export default function StudyModePage() {
  const params = useParams();
  const router = useRouter();
  const modeParam = String(params?.mode ?? 'flashcard');

  const [data, setData] = useState<OrthoData | null>(null);
  const [idx, setIdx] = useState(0);
  const [session, setSession] = useState<{ question: Question; mode: string }[]>([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    loadOrthoData().then(d => {
      setData(d);
      const progress = loadProgress();
      if (modeParam === 'session') {
        setSession(buildStudySession(d, progress, 10));
      } else {
        const qs = sortNewQuestions(d.questions).slice(0, 10);
        setSession(qs.map(q => ({ question: q, mode: modeParam })));
      }
    });
  }, [modeParam]);

  const current = session[idx];

  const handleNext = useCallback(() => {
    if (idx + 1 >= session.length) {
      setDone(true);
    } else {
      setIdx(i => i + 1);
    }
  }, [idx, session.length]);

  if (!data || session.length === 0) {
    return (
      <LearnLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="animate-spin" style={{ color: 'var(--c-primary)' }} />
        </div>
      </LearnLayout>
    );
  }

  if (done) {
    return (
      <LearnLayout>
        <div className="flex flex-col items-center justify-center h-full px-6 text-center gap-4">
          <p className="text-4xl">🎉</p>
          <h2 className="text-xl font-bold" style={{ color: 'var(--c-text)' }}>Сессия завершена!</h2>
          <p style={{ color: 'var(--c-muted)' }}>{session.length} карточек пройдено</p>
          <button
            type="button"
            onClick={() => router.push('/learn')}
            className="min-h-[48px] px-8 rounded-xl font-semibold"
            style={{ background: 'var(--c-primary)', color: 'var(--c-bg)' }}
          >
            На главную
          </button>
        </div>
      </LearnLayout>
    );
  }

  return (
    <LearnLayout>
      <div className="h-full flex flex-col">
        <GameWrapper
          question={current.question}
          mode={current.mode}
          sessionIndex={idx}
          sessionTotal={session.length}
          onNext={handleNext}
        />
      </div>
    </LearnLayout>
  );
}
