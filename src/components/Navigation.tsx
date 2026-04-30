"use client";

import React from 'react';
import { BookOpen, ClipboardList, PenTool, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type TabType = 'questions' | 'tests' | 'tasks' | 'stats';

interface NavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ activeTab, onTabChange }) => {
  const tabs = [
    { id: 'questions', label: 'Вопросы', icon: BookOpen },
    { id: 'tests',     label: 'Тесты',   icon: ClipboardList },
    { id: 'tasks',     label: 'Задачи',  icon: PenTool },
    { id: 'stats',     label: 'Статистика', icon: BarChart3 },
  ];

  return (
    <div
      className="fixed left-0 right-0 px-6 z-50 flex justify-center"
      style={{
        bottom: 'calc(var(--tg-safe-area-inset-bottom, env(safe-area-inset-bottom, 24px)) + 20px)'
      }}
    >
      <nav
        className="flex items-center gap-1 p-1.5 rounded-[28px] shadow-2xl"
        style={{
          background: 'hsl(160 28% 4% / 0.85)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid hsl(142 30% 18% / 0.6)',
        }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id as TabType)}
              className={cn(
                "relative flex items-center gap-2 px-4 py-2.5 rounded-full transition-all duration-400 overflow-hidden",
              )}
              style={isActive ? {
                background: 'hsl(142 70% 45% / 0.18)',
                border: '1px solid hsl(142 70% 45% / 0.35)',
              } : {
                background: 'transparent',
                border: '1px solid transparent',
              }}
            >
              <Icon
                className="w-5 h-5 transition-all duration-300"
                style={{
                  color: isActive
                    ? 'hsl(142 70% 52%)'
                    : 'hsl(130 10% 50%)',
                  transform: isActive ? 'scale(1.1)' : 'scale(1)',
                }}
              />

              {isActive && (
                <span
                  className="text-[11px] font-bold animate-in fade-in slide-in-from-left-2 duration-300"
                  style={{ color: 'hsl(142 70% 60%)' }}
                >
                  {tab.label}
                </span>
              )}

              {isActive && (
                <div
                  className="absolute inset-0 -translate-x-full pointer-events-none"
                  style={{
                    background: 'linear-gradient(90deg, transparent, hsl(142 70% 45% / 0.12), transparent)',
                    animation: 'shimmer 2.5s infinite',
                  }}
                />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
};
