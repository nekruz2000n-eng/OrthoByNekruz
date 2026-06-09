'use client';

import React, { useState } from 'react';
import type { Question, Case } from '@/types/data';
import type { Quality } from '@/lib/progress';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { XPToast } from '@/components/ui/XPToast';
import { FlashCard } from '@/components/game/FlashCard';
import { QuizMode } from '@/components/game/QuizMode';
import { TrueFalse } from '@/components/game/TrueFalse';
import { FillBlank } from '@/components/game/FillBlank';
import { MatchPairs } from '@/components/game/MatchPairs';
import { Sequence } from '@/components/game/Sequence';
import { Classify } from '@/components/game/Classify';
import { CaseMode } from '@/components/game/CaseMode';
import { recordAnswer, loadProgress } from '@/lib/progress';

interface GameWrapperProps {
  question?: Question;
  caseItem?: Case;
  mode: string;
  sessionIndex: number;
  sessionTotal: number;
  onNext: () => void;
}

export function GameWrapper({
  question,
  caseItem,
  mode,
  sessionIndex,
  sessionTotal,
  onNext,
}: GameWrapperProps) {
  const [xp, setXp] = useState(0);
  const [showXp, setShowXp] = useState(false);
  const progress = loadProgress();

  const handleResult = (correct: boolean, quality: Quality) => {
    const id = caseItem ? caseItem.id : question!.id;
    const type = caseItem ? 'case' : 'question';
    const sr = question?.spaced_repetition;
    const { xp: earned } = recordAnswer(id, mode, correct, quality, type, sr);
    setXp(earned);
    setShowXp(true);
    setTimeout(onNext, earned > 0 ? 800 : 400);
  };

  const renderMode = () => {
    if (caseItem || mode === 'case') {
      return caseItem ? <CaseMode caseItem={caseItem} onResult={handleResult} /> : null;
    }
    if (!question) return null;

    switch (mode) {
      case 'flashcard': return <FlashCard question={question} onResult={handleResult} />;
      case 'quiz': return <QuizMode question={question} onResult={handleResult} />;
      case 'true_false': return <TrueFalse question={question} onResult={handleResult} />;
      case 'fill_blank': return <FillBlank question={question} onResult={handleResult} />;
      case 'matching':
      case 'match_pairs': return <MatchPairs question={question} onResult={handleResult} />;
      case 'sequence': return <Sequence question={question} onResult={handleResult} />;
      case 'classify': return <Classify question={question} onResult={handleResult} />;
      default: return <FlashCard question={question} onResult={handleResult} />;
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-2 pb-3 flex-shrink-0 space-y-2">
        <div className="flex justify-between text-xs" style={{ color: 'var(--c-muted)' }}>
          <span>Карточка {sessionIndex + 1}/{sessionTotal}</span>
          <span>{progress.total_xp} XP</span>
        </div>
        <ProgressBar value={sessionIndex + 1} max={sessionTotal} />
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6 scroll-container">
        {renderMode()}
      </div>

      <XPToast xp={xp} visible={showXp} onDone={() => setShowXp(false)} />
    </div>
  );
}
