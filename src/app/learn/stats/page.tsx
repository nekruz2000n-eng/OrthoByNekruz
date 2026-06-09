'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { LearnLayout } from '@/components/OrthoLayout';
import { StreakBadge } from '@/components/ui/StreakBadge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { loadOrthoData, topicLabel, TOPIC_LABELS } from '@/lib/data';
import {
  loadProgress,
  isWeakCard,
  correctRate,
  cardKey,
} from '@/lib/progress';
import type { OrthoData } from '@/types/data';

export default function StatsPage() {
  const [data, setData] = useState<OrthoData | null>(null);
  const [progress, setProgress] = useState(loadProgress());

  useEffect(() => {
    loadOrthoData().then(setData);
    setProgress(loadProgress());
  }, []);

  const stats = useMemo(() => {
    const cards = Object.values(progress.cards);
    const studied = cards.length;
    const avgEf = studied
      ? cards.reduce((s, c) => s + c.ease_factor, 0) / studied
      : 0;

    const topicStats = Object.keys(TOPIC_LABELS).map(topicId => {
      if (!data) return { id: topicId, label: topicLabel(topicId), pct: 0 };
      const qs = data.questions.filter(q => q.topic === topicId);
      const mastered = qs.filter(q => {
        const c = progress.cards[cardKey(q.id, 'question')];
        return c && correctRate(c) >= 0.7;
      });
      return {
        id: topicId,
        label: topicLabel(topicId),
        pct: qs.length ? (mastered.length / qs.length) * 100 : 0,
      };
    });

    const weak = cards
      .filter(isWeakCard)
      .map(c => {
        const q = data?.questions.find(x => x.id === Number(c.id));
        return { card: c, question: q };
      })
      .filter(x => x.question)
      .slice(0, 8);

    const modeAgg: Record<string, { attempts: number; correct: number }> = {};
    for (const c of cards) {
      for (const [mode, s] of Object.entries(c.mode_stats)) {
        modeAgg[mode] = modeAgg[mode] ?? { attempts: 0, correct: 0 };
        modeAgg[mode].attempts += s.attempts;
        modeAgg[mode].correct += s.correct;
      }
    }

    const modes = Object.entries(modeAgg)
      .map(([mode, s]) => ({
        mode,
        attempts: s.attempts,
        rate: s.attempts ? s.correct / s.attempts : 0,
      }))
      .sort((a, b) => a.rate - b.rate);

    return { studied, avgEf, topicStats, weak, modes };
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
        <h1 className="text-xl font-bold mb-4" style={{ color: 'var(--c-text)' }}>📊 Твой прогресс</h1>

        <div className="flex flex-wrap gap-3 mb-6">
          <StreakBadge days={progress.daily_streak} />
          <span className="text-sm px-3 py-1 rounded-full" style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
            {progress.total_xp} XP
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <StatBox label="Изучено карточек" value={String(stats.studied)} />
          <StatBox label="Средний EF" value={stats.avgEf.toFixed(1)} />
        </div>

        <section className="mb-6">
          <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--c-text)' }}>По темам</h2>
          <div className="space-y-3">
            {stats.topicStats.map(t => (
              <ProgressBar key={t.id} label={t.label} value={t.pct} />
            ))}
          </div>
        </section>

        {stats.weak.length > 0 && (
          <section className="mb-6">
            <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--c-text)' }}>Слабые места</h2>
            <div className="space-y-2">
              {stats.weak.map(({ card, question }) => (
                <div key={String(card.id)} className="p-3 rounded-xl text-sm" style={{ background: 'var(--c-danger-soft)' }}>
                  <p className="font-medium">Q{question!.id} — {question!.subtopic || topicLabel(question!.topic)}</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--c-muted)' }}>
                    EF: {card.ease_factor.toFixed(1)}, rate: {(correctRate(card) * 100).toFixed(0)}%
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {stats.modes.length > 0 && (
          <section>
            <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--c-text)' }}>Режимы</h2>
            <div className="space-y-2">
              {stats.modes.map((m, i) => (
                <div key={m.mode} className="flex justify-between p-3 rounded-xl text-sm" style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
                  <span style={{ color: 'var(--c-text)' }}>{m.mode}</span>
                  <span style={{ color: 'var(--c-muted)' }}>
                    {m.attempts} ответов, {(m.rate * 100).toFixed(0)}%
                    {i === 0 && stats.modes.length > 1 ? ' ← слабейший' : ''}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </LearnLayout>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 rounded-xl" style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
      <p className="text-xs" style={{ color: 'var(--c-muted)' }}>{label}</p>
      <p className="text-xl font-bold mt-1" style={{ color: 'var(--c-text)' }}>{value}</p>
    </div>
  );
}
