'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { LearnLayout } from '@/components/OrthoLayout';
import { shuffle } from '@/lib/shuffle';
import { loadOrthoData } from '@/lib/data';
import { recordAnswer } from '@/lib/progress';
import type { OrthoData, Test } from '@/types/data';

const EXAM_SIZE = 20;

export default function TestsPage() {
  const [data, setData] = useState<OrthoData | null>(null);
  const [exam, setExam] = useState<Test[]>([]);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [answers, setAnswers] = useState<{ test: Test; optionId: string; correct: boolean }[]>([]);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    loadOrthoData().then(d => {
      setData(d);
      setExam(shuffle(d.tests).slice(0, EXAM_SIZE));
    });
  }, []);

  const current = exam[idx];

  const startExam = () => {
    if (data) {
      setExam(shuffle(data.tests).slice(0, EXAM_SIZE));
      setIdx(0);
      setAnswers([]);
      setPicked(null);
      setFinished(false);
      setStarted(true);
    }
  };

  const handlePick = useCallback((optionId: string) => {
    if (picked || !current) return;
    setPicked(optionId);
    const opt = current.options.find(o => o.id === optionId);
    const correct = !!opt?.correct;
    recordAnswer(current.id, 'exam', correct, correct ? 3 : 0, 'test');
    setAnswers(a => [...a, { test: current, optionId, correct }]);
  }, [picked, current]);

  const goNext = () => {
    if (idx + 1 >= exam.length) {
      setFinished(true);
    } else {
      setIdx(i => i + 1);
      setPicked(null);
    }
  };

  const score = useMemo(() => answers.filter(a => a.correct).length, [answers]);

  if (!data) {
    return (
      <LearnLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="animate-spin" style={{ color: 'var(--c-primary)' }} />
        </div>
      </LearnLayout>
    );
  }

  if (!started) {
    return (
      <LearnLayout>
        <div className="flex flex-col items-center justify-center h-full px-6 text-center gap-4">
          <p className="text-4xl">📝</p>
          <h1 className="text-xl font-bold" style={{ color: 'var(--c-text)' }}>Режим экзамена</h1>
          <p style={{ color: 'var(--c-muted)' }}>{EXAM_SIZE} случайных вопросов из {data.tests.length}</p>
          <button type="button" onClick={startExam} className="min-h-[48px] px-8 rounded-xl font-semibold" style={{ background: 'var(--c-primary)', color: 'var(--c-bg)' }}>
            Начать
          </button>
        </div>
      </LearnLayout>
    );
  }

  if (finished) {
    const pct = Math.round((score / exam.length) * 100);
    return (
      <LearnLayout>
        <div className="h-full overflow-y-auto scroll-container px-4 pb-4">
          <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--c-text)' }}>Результат</h1>
          <p className="text-3xl font-bold mb-4" style={{ color: 'var(--c-primary)' }}>
            {score}/{exam.length} ({pct}%)
          </p>

          <div className="space-y-3">
            {answers.map((a, i) => (
              <div
                key={a.test.id}
                className="p-4 rounded-xl text-sm"
                style={{
                  background: a.correct ? 'var(--c-primary-dim)' : 'var(--c-danger-soft)',
                  border: `1px solid ${a.correct ? 'var(--c-primary)' : 'var(--c-danger)'}`,
                }}
              >
                <p className="font-medium mb-1">{i + 1}. {a.test.question}</p>
                <p className="text-xs" style={{ color: 'var(--c-muted)' }}>
                  {a.correct ? '✅ Верно' : '❌ Неверно'}
                </p>
                {a.test.explanation && (
                  <p className="text-xs mt-2" style={{ color: 'var(--c-text)' }}>{a.test.explanation}</p>
                )}
              </div>
            ))}
          </div>

          <button type="button" onClick={startExam} className="w-full min-h-[48px] rounded-xl font-semibold mt-4" style={{ background: 'var(--c-primary)', color: 'var(--c-bg)' }}>
            Ещё раз
          </button>
        </div>
      </LearnLayout>
    );
  }

  if (!current) return null;

  return (
    <LearnLayout>
      <div className="h-full overflow-y-auto scroll-container px-4 pb-4">
        <p className="text-xs mb-2" style={{ color: 'var(--c-muted)' }}>Вопрос {idx + 1}/{exam.length}</p>
        <p className="text-base font-medium mb-4 leading-relaxed" style={{ color: 'var(--c-text)' }}>{current.question}</p>

        <div className="space-y-2 mb-4">
          {current.options.map(opt => {
            const selected = picked === opt.id;
            const show = !!picked;
            let bg = 'var(--c-card)';
            let border = 'var(--c-border)';
            if (show && selected) {
              bg = opt.correct ? 'var(--c-primary-dim)' : 'var(--c-danger-soft)';
              border = opt.correct ? 'var(--c-primary)' : 'var(--c-danger)';
            } else if (show && opt.correct) {
              bg = 'var(--c-primary-dim)';
              border = 'var(--c-primary)';
            }
            return (
              <button
                key={opt.id}
                type="button"
                disabled={!!picked}
                onClick={() => handlePick(opt.id)}
                className="w-full min-h-[48px] px-4 py-3 rounded-xl text-left text-sm"
                style={{ background: bg, border: `1px solid ${border}`, color: 'var(--c-text)' }}
              >
                {opt.text}
              </button>
            );
          })}
        </div>

        {picked && current.explanation && (
          <p className="text-sm p-3 rounded-xl mb-4" style={{ background: 'var(--c-card)', color: 'var(--c-muted)' }}>
            {current.explanation}
          </p>
        )}

        {picked && (
          <button type="button" onClick={goNext} className="w-full min-h-[48px] rounded-xl font-semibold" style={{ background: 'var(--c-primary)', color: 'var(--c-bg)' }}>
            {idx + 1 >= exam.length ? 'Завершить' : 'Следующий →'}
          </button>
        )}
      </div>
    </LearnLayout>
  );
}
