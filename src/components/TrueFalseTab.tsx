"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { loadSubjectData } from '@/lib/subjectData';
import {
  type BioQuestionTF,
  type TrueFalseStatement,
  type DifficultyFilter,
  SESSION_SIZE,
  DIFFICULTY_LABELS,
  buildTrueFalseSession,
  computeTopicResults,
  listTopics,
  statementKey,
  topicLabel,
} from '@/lib/trueFalse';
import { saveTrueFalseSession } from '@/lib/trueFalseApi';

interface TrueFalseTabProps {
  subject?: string;
  accentColor?: string;
  bustDataCache?: boolean;
}

type Phase = 'loading' | 'play' | 'summary';
type Feedback = 'none' | 'correct' | 'wrong';
type SwipeDir = 'left' | 'right' | null;

function haptic(type: 'success' | 'error' | 'light') {
  const hf = (window as {
    Telegram?: { WebApp?: { HapticFeedback?: {
      impactOccurred: (s: string) => void;
      notificationOccurred: (s: string) => void;
    } } };
  }).Telegram?.WebApp?.HapticFeedback;
  if (!hf) return;
  if (type === 'light') hf.impactOccurred('light');
  else hf.notificationOccurred(type === 'success' ? 'success' : 'error');
}

export const TrueFalseTab: React.FC<TrueFalseTabProps> = ({
  subject = 'bio',
  accentColor = 'var(--c-primary)',
  bustDataCache = false,
}) => {
  const [phase, setPhase]               = useState<Phase>('loading');
  const [allQuestions, setAllQuestions] = useState<BioQuestionTF[]>([]);
  const [topicFilter, setTopicFilter]   = useState<string | null>(null);
  const [difficulty, setDifficulty]     = useState<DifficultyFilter>('all');
  const [queue, setQueue]               = useState<TrueFalseStatement[]>([]);
  const [index, setIndex]               = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount]     = useState(0);
  const [sessionErrors, setSessionErrors] = useState<TrueFalseStatement[]>([]);
  const [answers, setAnswers]           = useState<{ statement: TrueFalseStatement; correct: boolean }[]>([]);
  const [feedback, setFeedback]         = useState<Feedback>('none');
  const [swipeDir, setSwipeDir]         = useState<SwipeDir>(null);
  const [locked, setLocked]             = useState(false);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const topics = useMemo(() => listTopics(allQuestions), [allQuestions]);

  const clearAdvanceTimer = useCallback(() => {
    if (advanceTimer.current) {
      clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
  }, []);

  const startSession = useCallback((
    questions: BioQuestionTF[],
    topic: string | null,
    diff: DifficultyFilter,
    errorsOnly = false,
    errorStmts: TrueFalseStatement[] = [],
  ) => {
    clearAdvanceTimer();
    setFeedback('none');
    setSwipeDir(null);
    setLocked(false);

    let deck: TrueFalseStatement[];
    if (errorsOnly && errorStmts.length > 0) {
      deck = [...errorStmts];
    } else {
      const onlyKeys = errorsOnly
        ? new Set(errorStmts.map(statementKey))
        : undefined;
      deck = buildTrueFalseSession(questions, {
        topicFilter: topic,
        difficulty: diff,
        count: SESSION_SIZE,
        onlyKeys,
      });
    }

    if (deck.length === 0) {
      setQueue([]);
      setIndex(0);
      setPhase('summary');
      return;
    }

    setQueue(deck);
    setIndex(0);
    setCorrectCount(0);
    setWrongCount(0);
    if (!errorsOnly) setSessionErrors([]);
    setAnswers([]);
    setPhase('play');
  }, [clearAdvanceTimer]);

  useEffect(() => {
    let cancelled = false;
    setPhase('loading');
    (async () => {
      const questions = await loadSubjectData(subject, 'questions', { bustCache: bustDataCache });
      if (cancelled) return;
      const qs = questions as BioQuestionTF[];
      setAllQuestions(qs);
      startSession(qs, null, 'all');
    })();
    return () => { cancelled = true; };
  }, [subject, bustDataCache, startSession]);

  useEffect(() => () => clearAdvanceTimer(), [clearAdvanceTimer]);

  const current = queue[index] ?? null;
  const total = queue.length;
  const progressNum = index + 1;

  const finishSession = useCallback((
    finalCorrect: number,
    finalWrong: number,
    finalAnswers: { statement: TrueFalseStatement; correct: boolean }[],
  ) => {
    const totalAnswered = finalCorrect + finalWrong;
    const pct = totalAnswered > 0 ? Math.round((finalCorrect / totalAnswered) * 100) : 0;
    const topicResults = computeTopicResults(finalAnswers);
    void saveTrueFalseSession(subject, pct, topicResults);
    setPhase('summary');
  }, [subject]);

  const advance = useCallback((
    nextIndex: number,
    nextCorrect: number,
    nextWrong: number,
    nextAnswers: { statement: TrueFalseStatement; correct: boolean }[],
  ) => {
    if (nextIndex >= queue.length) {
      finishSession(nextCorrect, nextWrong, nextAnswers);
      return;
    }
    setIndex(nextIndex);
    setFeedback('none');
    setSwipeDir(null);
    setLocked(false);
  }, [queue.length, finishSession]);

  const handleAnswer = useCallback((userSaysTrue: boolean) => {
    if (!current || locked || feedback !== 'none') return;

    const isCorrect = userSaysTrue === current.isTrue;
    setLocked(true);
    setFeedback(isCorrect ? 'correct' : 'wrong');
    setSwipeDir(isCorrect ? 'right' : 'left');

    if (isCorrect) {
      haptic('success');
    } else {
      haptic('error');
    }

    const nextCorrect = correctCount + (isCorrect ? 1 : 0);
    const nextWrong = wrongCount + (isCorrect ? 0 : 1);
    const entry = { statement: current, correct: isCorrect };
    const nextAnswers = [...answers, entry];

    setCorrectCount(nextCorrect);
    setWrongCount(nextWrong);
    setAnswers(nextAnswers);
    if (!isCorrect) {
      setSessionErrors(prev => [...prev, current]);
    }

    const delay = isCorrect ? 450 : 1500;
    clearAdvanceTimer();
    advanceTimer.current = setTimeout(() => {
      advance(index + 1, nextCorrect, nextWrong, nextAnswers);
    }, delay);
  }, [
    current, locked, feedback, correctCount, wrongCount, answers, index,
    advance, clearAdvanceTimer,
  ]);

  const applyTopic = (topic: string | null) => {
    setTopicFilter(topic);
    startSession(allQuestions, topic, difficulty);
  };

  const applyDifficulty = (diff: DifficultyFilter) => {
    setDifficulty(diff);
    startSession(allQuestions, topicFilter, diff);
  };

  const restartAll = () => startSession(allQuestions, topicFilter, difficulty);
  const repeatErrors = () => startSession(allQuestions, topicFilter, difficulty, true, sessionErrors);

  const totalAnswered = correctCount + wrongCount;
  const pct = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0;

  if (phase === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center flex-1 py-24" style={{ color: accentColor }}>
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="text-sm mt-3" style={{ color: 'var(--c-muted)' }}>Загружаем утверждения…</p>
      </div>
    );
  }

  if (allQuestions.filter(q => q.key_facts?.length).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 p-8 text-center">
        <p className="text-base font-semibold" style={{ color: 'var(--c-text)' }}>Нет данных</p>
        <p className="text-sm mt-2" style={{ color: 'var(--c-muted)' }}>
          В вопросах нет key_facts для режима Верно/Неверно.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Фильтры: темы */}
      <div className="flex-shrink-0 px-3 pb-2 pt-1">
        <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          <button
            type="button"
            onClick={() => applyTopic(null)}
            className="inline-flex items-center px-3 h-8 rounded-full text-[12px] font-bold whitespace-nowrap transition-all active:scale-95 flex-shrink-0"
            style={topicFilter === null
              ? { background: accentColor, color: '#fff' }
              : { background: 'var(--c-card)', border: '1px solid var(--c-border)', color: 'var(--c-muted)' }}
          >
            Все темы
          </button>
          {topics.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => applyTopic(t.id)}
              className="inline-flex items-center gap-1 px-3 h-8 rounded-full text-[12px] font-bold whitespace-nowrap transition-all active:scale-95 flex-shrink-0"
              style={topicFilter === t.id
                ? { background: accentColor, color: '#fff' }
                : { background: 'var(--c-card)', border: '1px solid var(--c-border)', color: 'var(--c-muted)' }}
            >
              {t.label}
              <span className="text-[10px] font-mono opacity-75">{t.count}</span>
            </button>
          ))}
        </div>

        {/* Сложность */}
        <div className="flex gap-1.5 overflow-x-auto mt-1.5" style={{ scrollbarWidth: 'none' }}>
          {(Object.keys(DIFFICULTY_LABELS) as DifficultyFilter[]).map(d => (
            <button
              key={d}
              type="button"
              onClick={() => applyDifficulty(d)}
              className="inline-flex items-center px-3 h-7 rounded-full text-[11px] font-bold whitespace-nowrap transition-all active:scale-95 flex-shrink-0"
              style={difficulty === d
                ? { background: 'var(--c-primary-soft)', border: '1.5px solid var(--c-primary-br)', color: 'var(--c-text)' }
                : { background: 'var(--c-card)', border: '1px solid var(--c-border)', color: 'var(--c-muted)' }}
            >
              {DIFFICULTY_LABELS[d]}
            </button>
          ))}
        </div>
      </div>

      {phase === 'summary' ? (
        <div className="flex flex-col items-center justify-center flex-1 px-6 py-8 text-center gap-6">
          <div className="text-5xl">{pct >= 80 ? '🏆' : pct >= 60 ? '👍' : '📚'}</div>
          <div>
            <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--c-text)' }}>
              {pct}%
            </h2>
            <p className="text-sm" style={{ color: 'var(--c-muted)' }}>правильных ответов</p>
            <p className="text-sm leading-relaxed mt-3" style={{ color: 'var(--c-muted)' }}>
              Верно угадал: <strong style={{ color: 'var(--c-primary)' }}>{correctCount}</strong>
              {' · '}
              Ошибок: <strong style={{ color: 'var(--c-danger)' }}>{wrongCount}</strong>
              {total > 0 && (
                <>
                  {' · '}
                  Всего: {totalAnswered || total}
                </>
              )}
            </p>
          </div>
          <div className="w-full max-w-xs flex flex-col gap-3">
            {sessionErrors.length > 0 && (
              <button
                type="button"
                onClick={repeatErrors}
                className="w-full h-[52px] rounded-2xl text-[15px] font-bold active:scale-[0.98] transition-transform"
                style={{ background: accentColor, color: 'var(--c-bg)' }}
              >
                Только ошибки
              </button>
            )}
            <button
              type="button"
              onClick={restartAll}
              className="w-full h-12 rounded-2xl text-sm font-semibold inline-flex items-center justify-center gap-2 active:scale-[0.98]"
              style={{
                background: 'var(--c-card)',
                border: '1px solid var(--c-border)',
                color: 'var(--c-text)',
              }}
            >
              <RotateCcw className="w-4 h-4" />
              Повторить
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-shrink-0 px-4 pb-2 text-center">
            <p className="text-[13px] font-bold tabular-nums" style={{ color: 'var(--c-text)' }}>
              {progressNum} / {total}
            </p>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center px-4 pb-4 min-h-0">
            <AnimatePresence mode="wait">
              {current && (
                <motion.div
                  key={`${statementKey(current)}-${index}`}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{
                    opacity: swipeDir ? 0 : 1,
                    scale: 1,
                    x: swipeDir === 'right' ? 120 : swipeDir === 'left' ? -120 : 0,
                    rotate: swipeDir === 'right' ? 8 : swipeDir === 'left' ? -8 : 0,
                  }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: swipeDir ? 0.35 : 0.2 }}
                  className={`tf-card w-full max-w-sm flex-1 max-h-[min(52vh,420px)] min-h-[220px] mb-4 rounded-[20px] flex flex-col items-center justify-center p-6 text-center ${
                    feedback === 'correct' ? 'tf-card-correct' : feedback === 'wrong' ? 'tf-card-wrong' : ''
                  }`}
                  style={{
                    background: 'var(--c-card)',
                    boxShadow: '0 12px 40px hsl(0 0% 0% / 0.12), 0 2px 8px hsl(0 0% 0% / 0.06)',
                    border: feedback === 'correct'
                      ? '2px solid hsl(142 71% 45% / 0.6)'
                      : feedback === 'wrong'
                        ? '2px solid hsl(var(--destructive) / 0.5)'
                        : '1px solid var(--c-border)',
                  }}
                >
                  <span
                    className="text-[10px] font-bold uppercase tracking-widest mb-3"
                    style={{ color: accentColor }}
                  >
                    {topicLabel(current.topic)}
                  </span>
                  <p
                    className="text-[11px] font-semibold mb-4"
                    style={{ color: 'var(--c-muted)' }}
                  >
                    {current.subtopic}
                  </p>
                  <p
                    className="text-[16px] leading-relaxed font-medium"
                    style={{ color: 'var(--c-text)' }}
                  >
                    {current.statement}
                  </p>

                  {feedback === 'wrong' && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-5 pt-4 w-full"
                      style={{ borderTop: '1px solid var(--c-border)' }}
                    >
                      <p className="text-[11px] font-bold uppercase tracking-wide mb-1" style={{ color: 'var(--c-danger)' }}>
                        Правильный ответ
                      </p>
                      <p className="text-[13px] leading-relaxed" style={{ color: 'var(--c-muted)' }}>
                        {current.isTrue
                          ? `Утверждение верно: «${current.correctFact}»`
                          : `Утверждение неверно. Верный факт: «${current.correctFact}»`}
                      </p>
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="w-full max-w-sm grid grid-cols-2 gap-3 flex-shrink-0">
              <button
                type="button"
                disabled={locked || !current}
                onClick={() => handleAnswer(true)}
                className="h-[56px] rounded-2xl text-[14px] font-bold active:scale-[0.97] transition-transform disabled:opacity-50"
                style={{
                  background: 'color-mix(in srgb, hsl(142 71% 45%) 16%, var(--c-card))',
                  border: '2px solid hsl(142 71% 45% / 0.45)',
                  color: 'var(--c-text)',
                }}
              >
                ✅ ВЕРНО
              </button>
              <button
                type="button"
                disabled={locked || !current}
                onClick={() => handleAnswer(false)}
                className="h-[56px] rounded-2xl text-[14px] font-bold active:scale-[0.97] transition-transform disabled:opacity-50"
                style={{
                  background: 'var(--c-danger-soft)',
                  border: '2px solid hsl(var(--destructive) / 0.35)',
                  color: 'var(--c-text)',
                }}
              >
                ❌ НЕВЕРНО
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
