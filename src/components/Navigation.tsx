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
    <nav className="fixed bottom-0 left-0 right-0 h-20 glass-nav flex items-center justify-around px-4 pb-safe z-50">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id as TabType)}
            className="flex flex-col items-center justify-center space-y-1 w-full relative h-full transition-all active:scale-90"
          >
            <div className={cn(
              "p-2 rounded-xl transition-all duration-300",
              isActive ? "text-primary" : "text-muted-foreground"
            )}>
              <Icon className={cn("w-6 h-6", isActive && "drop-shadow-[0_0_8px_rgba(77,159,255,0.6)]")} />
            </div>
            <span className={cn(
              "text-[10px] font-medium transition-all duration-300",
              isActive ? "text-primary opacity-100" : "text-muted-foreground opacity-70"
            )}>
              {tab.label}
            </span>
            {isActive && (
              <div className="absolute top-0 w-8 h-1 bg-primary rounded-full blur-[2px]" />
            )}
          </button>
        );
      })}
    </nav>
  );
};
