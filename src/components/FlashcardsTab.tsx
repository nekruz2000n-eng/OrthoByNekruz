"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, RotateCcw } from 'lucide-react';
import { loadSubjectData } from '@/lib/subjectData';
import {
  type BioQuestionFlash,
  type FlashcardItem,
  BIO_TOPIC_LABELS,
  topicLabel,
  expandQuestionsToCards,
  buildSessionDeck,
  flashcardMember,
} from '@/lib/flashcards';
import {
  fetchWeakFlashcards,
  markFlashcardKnown,
  markFlashcardWeak,
} from '@/lib/flashcardsApi';

interface FlashcardsTabProps {
  subject?: string;
  accentColor?: string;
  bustDataCache?: boolean;
}

type Phase = 'loading' | 'play' | 'summary';

export const FlashcardsTab: React.FC<FlashcardsTabProps> = ({
  subject = 'bio',
  accentColor = 'var(--c-primary)',
  bustDataCache = false,
}) => {
  const [phase, setPhase]           = useState<Phase>('loading');
  const [allCards, setAllCards]     = useState<FlashcardItem[]>([]);
  const [weakSet, setWeakSet]       = useState<Set<string>>(new Set());
  const [topicFilter, setTopicFilter] = useState<string | null>(null);
  const [queue, setQueue]           = useState<FlashcardItem[]>([]);
  const [flipped, setFlipped]       = useState(false);
  const [knownCount, setKnownCount] = useState(0);
  const [unknownCount, setUnknownCount] = useState(0);
  const [sessionWeak, setSessionWeak] = useState<FlashcardItem[]>([]);

  const topics = useMemo(() => {
    const ids = [...new Set(allCards.map(c => c.topic))].sort(
      (a, b) => topicLabel(a).localeCompare(topicLabel(b), 'ru'),
    );
    return ids;
  }, [allCards]);

  const startSession = useCallback((
    cards: FlashcardItem[],
    weak: Set<string>,
    topic: string | null,
    weakOnly = false,
  ) => {
    let deck = buildSessionDeck(cards, weak, topic);
    if (weakOnly) {
      deck = deck.filter(c => weak.has(flashcardMember(c.questionId, c.factIndex)));
    }
    if (deck.length === 0) {
      setQueue([]);
      setPhase('summary');
      return;
    }
    setQueue(deck);
    setFlipped(false);
    setKnownCount(0);
    setUnknownCount(0);
    setSessionWeak([]);
    setPhase('play');
  }, []);

  useEffect(() => {
    let cancelled = false;
    setPhase('loading');
    (async () => {
      const [questions, weak] = await Promise.all([
        loadSubjectData(subject, 'questions', { bustCache: bustDataCache }),
        fetchWeakFlashcards(subject),
      ]);
      if (cancelled) return;
      const cards = expandQuestionsToCards(questions as BioQuestionFlash[]);
      setAllCards(cards);
      setWeakSet(weak);
      startSession(cards, weak, null);
    })();
    return () => { cancelled = true; };
  }, [subject, bustDataCache, startSession]);

  const current = queue[0] ?? null;
  const remaining = queue.length;
  const totalInSession = knownCount + unknownCount + remaining;

  const applyTopicFilter = (topic: string | null) => {
    setTopicFilter(topic);
    startSession(allCards, weakSet, topic);
  };

  const handleFlip = () => {
    if (!current || flipped) return;
    setFlipped(true);
  };

  const handleKnown = () => {
    if (!current) return;
    void markFlashcardKnown(subject, current.questionId, current.factIndex);
    setWeakSet(prev => {
      const next = new Set(prev);
      next.delete(flashcardMember(current.questionId, current.factIndex));
      return next;
    });
    setKnownCount(n => n + 1);
    setFlipped(false);
    setQueue(q => q.slice(1));
    if (queue.length <= 1) setPhase('summary');
  };

  const handleUnknown = () => {
    if (!current) return;
    void markFlashcardWeak(subject, current.questionId, current.factIndex);
    const key = flashcardMember(current.questionId, current.factIndex);
    setWeakSet(prev => new Set(prev).add(key));
    setUnknownCount(n => n + 1);
    setSessionWeak(prev => [...prev, current]);
    setFlipped(false);
    setQueue(q => [...q.slice(1), current]);
    if (queue.length <= 1) setPhase('summary');
  };

  useEffect(() => {
    if (phase === 'play' && queue.length === 0 && allCards.length > 0) {
      setPhase('summary');
    }
  }, [phase, queue.length, allCards.length]);

  const repeatWeak = () => {
    const weakKeys = new Set(sessionWeak.map(c => flashcardMember(c.questionId, c.factIndex)));
    if (weakKeys.size === 0) {
      startSession(allCards, weakSet, topicFilter, true);
      return;
    }
    const deck = sessionWeak.length > 0
      ? [...sessionWeak]
      : buildSessionDeck(allCards, weakSet, topicFilter).filter(
          c => weakKeys.has(flashcardMember(c.questionId, c.factIndex)),
        );
    if (deck.length === 0) {
      startSession(allCards, weakSet, topicFilter, true);
      return;
    }
    setQueue(deck);
    setFlipped(false);
    setKnownCount(0);
    setUnknownCount(0);
    setSessionWeak([]);
    setPhase('play');
  };

  const restartAll = () => {
    startSession(allCards, weakSet, topicFilter);
  };

  if (phase === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center flex-1 py-24" style={{ color: accentColor }}>
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="text-sm mt-3" style={{ color: 'var(--c-muted)' }}>Загружаем карточки…</p>
      </div>
    );
  }

  if (allCards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 p-8 text-center">
        <p className="text-base font-semibold" style={{ color: 'var(--c-text)' }}>Нет карточек</p>
        <p className="text-sm mt-2" style={{ color: 'var(--c-muted)' }}>
          В данных нет key_facts для флэшкарт.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Фильтр по теме */}
      <div
        className="flex-shrink-0 px-3 pb-2 overflow-x-auto"
        style={{ scrollbarWidth: 'none' }}
      >
        <div className="flex gap-1.5 min-w-min">
          <button
            type="button"
            onClick={() => applyTopicFilter(null)}
            className="px-3 h-8 rounded-full text-[12px] font-bold whitespace-nowrap transition-all active:scale-95"
            style={topicFilter === null
              ? { background: accentColor, color: '#fff' }
              : { background: 'var(--c-card)', border: '1px solid var(--c-border)', color: 'var(--c-muted)' }}
          >
            Все темы
          </button>
          {topics.map(id => (
            <button
              key={id}
              type="button"
              onClick={() => applyTopicFilter(id)}
              className="px-3 h-8 rounded-full text-[12px] font-bold whitespace-nowrap transition-all active:scale-95"
              style={topicFilter === id
                ? { background: accentColor, color: '#fff' }
                : { background: 'var(--c-card)', border: '1px solid var(--c-border)', color: 'var(--c-muted)' }}
            >
              {BIO_TOPIC_LABELS[id] ?? topicLabel(id)}
            </button>
          ))}
        </div>
      </div>

      {phase === 'summary' ? (
        <div className="flex flex-col items-center justify-center flex-1 px-6 py-8 text-center gap-6">
          <div className="text-5xl">🎉</div>
          <div>
            <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--c-text)' }}>
              Сессия завершена
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--c-muted)' }}>
              Знал: <strong style={{ color: 'var(--c-primary)' }}>{knownCount}</strong>
              {' · '}
              Не знал: <strong style={{ color: 'var(--c-danger)' }}>{unknownCount}</strong>
              {totalInSession > 0 && (
                <>
                  {' · '}
                  Всего: {totalInSession}
                </>
              )}
            </p>
          </div>
          <div className="w-full max-w-xs flex flex-col gap-3">
            {(sessionWeak.length > 0 || unknownCount > 0) && (
              <button
                type="button"
                onClick={repeatWeak}
                className="w-full h-[52px] rounded-2xl text-[15px] font-bold active:scale-[0.98] transition-transform"
                style={{ background: accentColor, color: 'var(--c-bg)' }}
              >
                Повторить слабые
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
              Начать заново
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-shrink-0 px-4 pb-2 text-center">
            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--c-muted)' }}>
              Осталось {remaining} · Знаю {knownCount} · Не знаю {unknownCount}
            </p>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center px-4 pb-4 min-h-0">
            {current ? (
              <>
                <button
                  type="button"
                  onClick={handleFlip}
                  className="flashcard-scene w-full max-w-sm flex-1 max-h-[min(52vh,420px)] min-h-[240px] mb-4"
                  aria-label={flipped ? 'Факт на обратной стороне' : 'Нажми, чтобы перевернуть'}
                >
                  <div className={`flashcard-inner w-full h-full ${flipped ? 'flashcard-flipped' : ''}`}>
                    <div
                      className="flashcard-face flashcard-front rounded-[20px] flex flex-col items-center justify-center p-6 text-center"
                      style={{
                        background: 'var(--c-card)',
                        boxShadow: '0 12px 40px hsl(0 0% 0% / 0.12), 0 2px 8px hsl(0 0% 0% / 0.06)',
                        border: '1px solid var(--c-border)',
                      }}
                    >
                      <span
                        className="text-[10px] font-bold uppercase tracking-widest mb-3"
                        style={{ color: accentColor }}
                      >
                        {topicLabel(current.topic)}
                      </span>
                      <p
                        className="text-lg font-bold leading-snug"
                        style={{ color: 'var(--c-text)' }}
                      >
                        {current.subtopic}
                      </p>
                      <p className="text-xs mt-6" style={{ color: 'var(--c-muted)' }}>
                        Нажми, чтобы перевернуть
                      </p>
                    </div>
                    <div
                      className="flashcard-face flashcard-back rounded-[20px] flex flex-col items-center justify-center p-6 text-center"
                      style={{
                        background: 'var(--c-card)',
                        boxShadow: '0 12px 40px hsl(0 0% 0% / 0.12), 0 2px 8px hsl(0 0% 0% / 0.06)',
                        border: '1px solid var(--c-primary-br)',
                      }}
                    >
                      <p
                        className="text-[15px] leading-relaxed font-medium"
                        style={{ color: 'var(--c-text)' }}
                      >
                        {current.fact}
                      </p>
                    </div>
                  </div>
                </button>

                {flipped ? (
                  <div className="w-full max-w-sm grid grid-cols-2 gap-3 flex-shrink-0">
                    <button
                      type="button"
                      onClick={handleKnown}
                      className="h-14 rounded-2xl text-[15px] font-bold active:scale-[0.97] transition-transform"
                      style={{
                        background: 'color-mix(in srgb, var(--c-primary) 14%, var(--c-card))',
                        border: '2px solid var(--c-primary-br)',
                        color: 'var(--c-text)',
                      }}
                    >
                      ✅ Знаю
                    </button>
                    <button
                      type="button"
                      onClick={handleUnknown}
                      className="h-14 rounded-2xl text-[15px] font-bold active:scale-[0.97] transition-transform"
                      style={{
                        background: 'var(--c-danger-soft)',
                        border: '2px solid hsl(var(--destructive) / 0.35)',
                        color: 'var(--c-text)',
                      }}
                    >
                      ❌ Не знаю
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-center" style={{ color: 'var(--c-muted)' }}>
                    Карточка {knownCount + unknownCount + 1} из {knownCount + unknownCount + remaining}
                  </p>
                )}
              </>
            ) : (
              <div className="text-center" style={{ color: 'var(--c-muted)' }}>
                <Loader2 className="w-6 h-6 animate-spin mx-auto" />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
