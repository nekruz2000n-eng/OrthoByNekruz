"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BookOpen, ClipboardList, PenTool, BarChart3, Layers, Scale } from 'lucide-react';

export type TabType = 'questions' | 'tests' | 'tasks' | 'stats';

export type BioGameMode = 'list' | 'flashcards' | 'true_false';

interface NavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  hiddenTabs?: TabType[];
  subject?: string;
  /** Удержание ~500 ms → флэшкарты (bio) */
  onQuestionsLongPress?: () => void;
  /** Удержание ~800 ms → Верно/Неверно (bio) */
  onQuestionsTrueFalseLongPress?: () => void;
  bioGameMode?: BioGameMode;
}

const FLASH_PRESS_MS   = 500;
const TRUE_FALSE_MS    = 800;
const FEEDBACK_MS      = 280;

const ALL_TABS: { id: TabType; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'questions', label: 'Вопросы',    Icon: BookOpen      },
  { id: 'tests',     label: 'Тесты',      Icon: ClipboardList },
  { id: 'tasks',     label: 'Задачи',     Icon: PenTool       },
  { id: 'stats',     label: 'Статистика', Icon: BarChart3     },
];

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onTabChange,
  hiddenTabs,
  subject,
  onQuestionsLongPress,
  onQuestionsTrueFalseLongPress,
  bioGameMode = 'list',
}) => {
  const tabs = hiddenTabs && hiddenTabs.length
    ? ALL_TABS.filter(t => !hiddenTabs.includes(t.id))
    : ALL_TABS;
  if (tabs.length === 0) return null;

  const flashTimer     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trueFalseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);
  const pressActive    = useRef(false);
  const flashReady     = useRef(false);
  const trueFalseFired = useRef(false);

  const [hintMode, setHintMode] = useState<'none' | 'flashcards' | 'true_false'>('none');

  const clearFlashTimer = useCallback(() => {
    if (flashTimer.current) {
      clearTimeout(flashTimer.current);
      flashTimer.current = null;
    }
  }, []);

  const clearTrueFalseTimer = useCallback(() => {
    if (trueFalseTimer.current) {
      clearTimeout(trueFalseTimer.current);
      trueFalseTimer.current = null;
    }
  }, []);

  const clearAllTimers = useCallback(() => {
    clearFlashTimer();
    clearTrueFalseTimer();
  }, [clearFlashTimer, clearTrueFalseTimer]);

  const handlePressStart = useCallback((tabId: TabType) => {
    const isBioQuestions = tabId === 'questions' && subject === 'bio'
      && (onQuestionsLongPress || onQuestionsTrueFalseLongPress);
    if (!isBioQuestions) return;

    longPressFired.current = false;
    flashReady.current = false;
    trueFalseFired.current = false;
    pressActive.current = true;
    setHintMode('none');
    clearAllTimers();

    flashTimer.current = setTimeout(() => {
      if (!pressActive.current) return;
      flashReady.current = true;
      setHintMode('flashcards');
    }, FLASH_PRESS_MS);

    trueFalseTimer.current = setTimeout(() => {
      if (!pressActive.current) return;
      flashReady.current = false;
      trueFalseFired.current = true;
      longPressFired.current = true;
      setHintMode('true_false');
      setTimeout(() => {
        setHintMode('none');
        onQuestionsTrueFalseLongPress?.();
      }, FEEDBACK_MS);
    }, TRUE_FALSE_MS);
  }, [subject, onQuestionsLongPress, onQuestionsTrueFalseLongPress, clearAllTimers]);

  const handlePressEnd = useCallback(() => {
    if (!pressActive.current) return;
    pressActive.current = false;
    clearAllTimers();

    if (trueFalseFired.current) {
      setHintMode('none');
      return;
    }

    if (flashReady.current && onQuestionsLongPress) {
      longPressFired.current = true;
      flashReady.current = false;
      setHintMode('none');
      onQuestionsLongPress();
      return;
    }

    setHintMode('none');
  }, [onQuestionsLongPress, clearAllTimers]);

  const handleTabClick = useCallback((tabId: TabType) => {
    if (longPressFired.current) {
      longPressFired.current = false;
      return;
    }
    onTabChange(tabId);
  }, [onTabChange]);

  useEffect(() => () => {
    pressActive.current = false;
    clearAllTimers();
  }, [clearAllTimers]);

  return (
    <div
      className="fixed left-0 right-0 px-6 z-50 flex justify-center"
      style={{ bottom: 'calc(var(--nav-bottom, 12px) + 14px)' }}
    >
      <nav
        className="flex items-center gap-1 p-1.5 rounded-full"
        style={{
          background: 'var(--c-nav-bg)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid var(--c-nav-border)',
          boxShadow: '0 10px 30px hsl(0 0% 0% / 0.28), 0 2px 6px hsl(0 0% 0% / 0.12)',
        }}
      >
        {tabs.map(tab => {
          const isActive = activeTab === tab.id;
          const Icon = tab.Icon;
          const isBioQuestions = tab.id === 'questions' && subject === 'bio'
            && (!!onQuestionsLongPress || !!onQuestionsTrueFalseLongPress);

          const toFlashcards = hintMode === 'flashcards' && bioGameMode !== 'flashcards';
          const toList = hintMode === 'flashcards' && bioGameMode === 'flashcards';
          const toTrueFalse = hintMode === 'true_false';

          const showFlashIcon = isBioQuestions && (
            toFlashcards
            || (bioGameMode === 'flashcards' && isActive && hintMode === 'none')
          );
          const showTrueFalseIcon = isBioQuestions && (
            toTrueFalse
            || (bioGameMode === 'true_false' && isActive && hintMode === 'none')
          );
          const showListHint = isBioQuestions && toList;

          const flashRing = hintMode === 'flashcards' && isBioQuestions;
          const tfRing = hintMode === 'true_false' && isBioQuestions;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabClick(tab.id)}
              onMouseDown={() => handlePressStart(tab.id)}
              onMouseUp={handlePressEnd}
              onMouseLeave={handlePressEnd}
              onTouchStart={() => handlePressStart(tab.id)}
              onTouchEnd={handlePressEnd}
              onTouchCancel={handlePressEnd}
              className="relative flex items-center gap-1.5 rounded-full transition-all duration-200 select-none"
              style={{
                padding: isActive ? '9px 15px 9px 12px' : '10px 12px',
                background: isActive ? 'var(--c-primary)' : 'transparent',
                color: isActive ? 'var(--c-bg)' : 'var(--c-muted)',
                WebkitTouchCallout: 'none',
                boxShadow: flashRing
                  ? '0 0 0 2px hsl(142 71% 45% / 0.85), 0 0 16px hsl(142 71% 45% / 0.35)'
                  : tfRing
                    ? '0 0 0 2px hsl(270 65% 58% / 0.9), 0 0 18px hsl(270 65% 58% / 0.4)'
                    : undefined,
              }}
            >
              {showListHint ? (
                <BookOpen className="w-[18px] h-[18px] animate-in zoom-in duration-200" />
              ) : showTrueFalseIcon ? (
                <Scale className="w-[18px] h-[18px] animate-in zoom-in duration-200" />
              ) : showFlashIcon ? (
                <Layers className="w-[18px] h-[18px] animate-in zoom-in duration-200" />
              ) : (
                <Icon className="w-[18px] h-[18px]" />
              )}
              {toFlashcards && (
                <span
                  className="absolute -top-1 -right-0.5 text-[10px] leading-none animate-in zoom-in duration-150"
                  aria-hidden
                >
                  🎴
                </span>
              )}
              {toTrueFalse && (
                <span
                  className="absolute -top-1 -right-0.5 text-[10px] leading-none animate-in zoom-in duration-150"
                  aria-hidden
                >
                  ⚖️
                </span>
              )}
              {toList && (
                <span
                  className="absolute -top-1 -right-0.5 text-[10px] leading-none animate-in zoom-in duration-150"
                  aria-hidden
                >
                  📋
                </span>
              )}
              {isActive && (
                <span className="text-[12.5px] font-bold whitespace-nowrap animate-in fade-in slide-in-from-left-1 duration-200">
                  {tab.label}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
};
