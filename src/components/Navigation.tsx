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
    { id: 'tests', label: 'Тесты', icon: ClipboardList },
    { id: 'tasks', label: 'Задачи', icon: PenTool },
    { id: 'stats', label: 'Статистика', icon: BarChart3 },
  ];

  return (
    <div className="fixed bottom-6 left-0 right-0 px-8 z-50 flex justify-center">
      <nav className="flex items-center gap-1 bg-black/40 dark:bg-black/40 backdrop-blur-2xl p-2 rounded-[26px] border border-white/10 shadow-2xl">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id as TabType)}
              className={cn(
                "relative flex items-center gap-2 px-4 py-2.5 rounded-full transition-all duration-500 overflow-hidden",
                isActive ? "bg-primary/20" : "bg-transparent"
              )}
            >
              <Icon
                className={cn(
                  "w-5 h-5 transition-all duration-300",
                  // Активная иконка: чёрная в светлой теме, белая в тёмной
                  isActive
                    ? "text-black dark:text-white scale-110"
                    : "text-black/50 dark:text-white/40"
                )}
              />
              
              {isActive && (
                <span className="text-[11px] font-bold text-black dark:text-white animate-in fade-in slide-in-from-left-2 duration-300">
                  {tab.label}
                </span>
              )}

              {/* Эффект блика при клике */}
              {isActive && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-[shimmer_2s_infinite] pointer-events-none" />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
};