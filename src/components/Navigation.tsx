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
    { id: 'questions', label: 'Вопросы',    icon: BookOpen      },
    { id: 'tests',     label: 'Тесты',      icon: ClipboardList },
    { id: 'tasks',     label: 'Задачи',     icon: PenTool       },
    { id: 'stats',     label: 'Статистика', icon: BarChart3     },
  ];

  return (
    <div
      className="fixed left-0 right-0 px-6 z-50 flex justify-center"
      style={{ bottom: 'calc(var(--nav-bottom, 12px) + 8px)' }}
    >
      <nav
        className="flex items-center gap-1 p-1.5 rounded-[28px] shadow-2xl"
        style={{
          background: 'color-mix(in srgb, var(--c-bg) 85%, transparent)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid var(--c-border)',
        }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id as TabType)}
              className="relative flex items-center gap-2 px-4 py-2.5 rounded-full transition-all duration-300 overflow-hidden"
              style={isActive ? {
                background: 'var(--c-primary-dim)',
                border: '1px solid var(--c-primary-br)',
              } : {
                background: 'transparent',
                border: '1px solid transparent',
              }}
            >
              <Icon
                className="w-5 h-5 transition-all duration-300"
                style={{
                  color: isActive ? 'var(--c-primary)' : 'var(--c-muted)',
                  transform: isActive ? 'scale(1.1)' : 'scale(1)',
                }}
              />
              {isActive && (
                <span
                  className="text-[11px] font-bold animate-in fade-in slide-in-from-left-2 duration-200"
                  style={{ color: 'var(--c-primary)' }}
                >
                  {tab.label}
                </span>
              )}
              {isActive && (
                <div
                  className="absolute inset-0 -translate-x-full pointer-events-none"
                  style={{
                    background: 'linear-gradient(90deg, transparent, var(--c-primary-dim), transparent)',
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
