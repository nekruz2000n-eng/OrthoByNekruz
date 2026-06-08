"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BookOpen, ClipboardList, PenTool, BarChart3, Layers } from 'lucide-react';

export type TabType = 'questions' | 'tests' | 'tasks' | 'stats';

interface NavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  /** ID табов, которые надо скрыть (управляется из админки per-user) */
  hiddenTabs?: TabType[];
  /** Текущий предмет — long press на «Вопросы» только для bio */
  subject?: string;
  /** Удержание на «Вопросы» → флэшкарты (bio) */
  onQuestionsLongPress?: () => void;
  /** Активен режим флэшкарт через long press */
  questionsFlashcardsActive?: boolean;
}

const LONG_PRESS_MS = 500;
const FEEDBACK_MS   = 300;

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
  questionsFlashcardsActive = false,
}) => {
  const tabs = hiddenTabs && hiddenTabs.length
    ? ALL_TABS.filter(t => !hiddenTabs.includes(t.id))
    : ALL_TABS;
  if (tabs.length === 0) return null;

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedbackTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);
  const [cardHint, setCardHint] = useState(false);

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const clearFeedback = useCallback(() => {
    if (feedbackTimer.current) {
      clearTimeout(feedbackTimer.current);
      feedbackTimer.current = null;
    }
  }, []);

  const handlePressStart = useCallback((tabId: TabType) => {
    if (tabId !== 'questions' || subject !== 'bio' || !onQuestionsLongPress) return;
    longPressFired.current = false;
    clearLongPress();
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      setCardHint(true);
      feedbackTimer.current = setTimeout(() => {
        setCardHint(false);
        onQuestionsLongPress();
        feedbackTimer.current = null;
      }, FEEDBACK_MS);
    }, LONG_PRESS_MS);
  }, [subject, onQuestionsLongPress, clearLongPress]);

  const handlePressEnd = useCallback(() => {
    clearLongPress();
  }, [clearLongPress]);

  const handleTabClick = useCallback((tabId: TabType) => {
    if (longPressFired.current) {
      longPressFired.current = false;
      return;
    }
    onTabChange(tabId);
  }, [onTabChange]);

  useEffect(() => () => {
    clearLongPress();
    clearFeedback();
  }, [clearLongPress, clearFeedback]);

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
          const isBioQuestions = tab.id === 'questions' && subject === 'bio' && !!onQuestionsLongPress;
          const showFlashIcon = isBioQuestions && (cardHint || (questionsFlashcardsActive && isActive));

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
              }}
            >
              {showFlashIcon ? (
                <Layers className="w-[18px] h-[18px] animate-in zoom-in duration-200" />
              ) : (
                <Icon className="w-[18px] h-[18px]" />
              )}
              {cardHint && isBioQuestions && (
                <span
                  className="absolute -top-1 -right-0.5 text-[10px] leading-none animate-in zoom-in duration-150"
                  aria-hidden
                >
                  🎴
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
