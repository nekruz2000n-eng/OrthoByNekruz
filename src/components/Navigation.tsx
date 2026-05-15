"use client";

import React from 'react';
import { BookOpen, ClipboardList, PenTool, BarChart3 } from 'lucide-react';

export type TabType = 'questions' | 'tests' | 'tasks' | 'stats';

interface NavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  /** ID табов, которые надо скрыть (управляется из админки per-user) */
  hiddenTabs?: TabType[];
}

const ALL_TABS: { id: TabType; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'questions', label: 'Вопросы',    Icon: BookOpen      },
  { id: 'tests',     label: 'Тесты',      Icon: ClipboardList },
  { id: 'tasks',     label: 'Задачи',     Icon: PenTool       },
  { id: 'stats',     label: 'Статистика', Icon: BarChart3     },
];

export const Navigation: React.FC<NavigationProps> = ({ activeTab, onTabChange, hiddenTabs }) => {
  const tabs = hiddenTabs && hiddenTabs.length
    ? ALL_TABS.filter(t => !hiddenTabs.includes(t.id))
    : ALL_TABS;
  if (tabs.length === 0) return null;

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
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className="flex items-center gap-1.5 rounded-full transition-all duration-200"
              style={{
                padding: isActive ? '9px 15px 9px 12px' : '10px 12px',
                background: isActive ? 'var(--c-primary)' : 'transparent',
                color: isActive ? 'var(--c-bg)' : 'var(--c-muted)',
              }}
            >
              <Icon className="w-[18px] h-[18px]" />
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
