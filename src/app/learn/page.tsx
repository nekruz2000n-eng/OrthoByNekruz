'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { LearnLayout } from '@/components/OrthoLayout';
import { StreakBadge } from '@/components/ui/StreakBadge';
import { DueCount } from '@/components/ui/DueCount';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { loadOrthoData, topicLabel, TOPIC_LABELS } from '@/lib/data';
import {
  loadProgress,
  getDueCards,
  isWeakCard,
  correctRate,
  cardKey,
} from '@/lib/progress';
import type { OrthoData } from '@/types/data';

export default function LearnDashboard() {
  const [data, setData] = useState<OrthoData | null>(null);
  const [progress, setProgress] = useState(loadProgress());

  useEffect(() => {
    loadOrthoData().then(setData);
    setProgress(loadProgress());
  }, []);

  const dueCount = useMemo(() => getDueCards(progress).length, [progress]);

  const topicProgress = useMemo(() => {
    if (!data) return [];
    return Object.keys(TOPIC_LABELS).map(topicId => {
      const qs = data.questions.filter(q => q.topic === topicId);
      const studied = qs.filter(q => progress.cards[cardKey(q.id, 'question')]);
      const mastered = studied.filter(q => {
        const c = progress.cards[cardKey(q.id, 'question')];
        return c && correctRate(c) >= 0.7;
      });
      return {
        id: topicId,
        label: topicLabel(topicId),
        pct: qs.length ? (mastered.length / qs.length) * 100 : 0,
      };
    });
  }, [data, progress]);

  const weakCards = useMemo(() => {
    if (!data) return [];
    return Object.values(progress.cards)
      .filter(isWeakCard)
      .slice(0, 5)
      .map(c => {
        const q = data.questions.find(x => x.id === Number(c.id));
        return { card: c, question: q };
      })
      .filter(x => x.question);
  }, [data, progress]);

  if (!data) {
    return (
      <LearnLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="animate-spin" style={{ color: 'var(--c-primary)' }} />
        </div>
      </LearnLayout>
    );
  }

  return (
    <LearnLayout>
      <div className="h-full overflow-y-auto scroll-container px-4 pb-4">
        <header className="mb-6">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--c-text)' }}>OrthoByNekruz</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--c-muted)' }}>Ортопедическая стоматология</p>
          <div className="mt-3 flex items-center gap-3">
            <StreakBadge days={progress.daily_streak} />
            <span className="text-sm font-semibold" style={{ color: 'var(--c-primary)' }}>{progress.total_xp} XP</span>
          </div>
        </header>

        <Link
          href="/learn/review"
          className="block p-4 rounded-2xl mb-4 min-h-[72px]"
          style={{ background: 'var(--c-primary-dim)', border: '1px solid var(--c-primary-br)' }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold" style={{ color: 'var(--c-primary-strong)' }}>На повторение сегодня</p>
              <p className="text-sm" style={{ color: 'var(--c-muted)' }}>Spaced repetition очередь</p>
            </div>
            <DueCount count={dueCount} />
          </div>
        </Link>

        <div className="grid grid-cols-2 gap-3 mb-6">
          {[
            { href: '/learn/study/flashcard', label: 'Flashcard', emoji: '🃏' },
            { href: '/learn/study/quiz', label: 'Quiz', emoji: '❓' },
            { href: '/learn/cases', label: 'Задачи', emoji: '🏥' },
            { href: '/learn/tests', label: 'Тесты', emoji: '📝' },
          ].map(item => (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center justify-center min-h-[88px] rounded-2xl p-3"
              style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}
            >
              <span className="text-2xl mb-1">{item.emoji}</span>
              <span className="text-sm font-semibold" style={{ color: 'var(--c-text)' }}>{item.label}</span>
            </Link>
          ))}
        </div>

        <section className="mb-6">
          <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--c-text)' }}>Прогресс по темам</h2>
          <div className="space-y-3">
            {topicProgress.map(t => (
              <ProgressBar key={t.id} label={t.label} value={t.pct} />
            ))}
          </div>
        </section>

        {weakCards.length > 0 && (
          <section>
            <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--c-text)' }}>Слабые карточки</h2>
            <div className="space-y-2">
              {weakCards.map(({ card, question }) => (
                <div
                  key={String(card.id)}
                  className="p-3 rounded-xl text-sm"
                  style={{ background: 'var(--c-danger-soft)', border: '1px solid var(--c-danger)' }}
                >
                  <p className="font-medium" style={{ color: 'var(--c-text)' }}>
                    Q{question!.id} — {question!.subtopic || topicLabel(question!.topic)}
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--c-muted)' }}>
                    EF: {card.ease_factor.toFixed(1)}, rate: {(correctRate(card) * 100).toFixed(0)}%
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </LearnLayout>
  );
}
