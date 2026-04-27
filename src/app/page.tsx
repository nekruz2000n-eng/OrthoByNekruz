"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AuthScreen } from '@/components/AuthScreen';
import { Navigation, TabType } from '@/components/Navigation';
import { QuestionsTab } from '@/components/QuestionsTab';
import { TestsTab } from '@/components/TestsTab';
import { TasksTab } from '@/components/TasksTab';
import { StatsTab } from '@/components/StatsTab';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<TabType>('questions');
  const { toast } = useToast();

  // ======== Скрытый сброс сессии (долгое нажатие 8 секунд) ========
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLongPressStart = useCallback(() => {
    longPressTimerRef.current = setTimeout(() => {
      // Принудительно очищаем всё: авторизацию и демо
      localStorage.removeItem('is_authed');
      localStorage.removeItem('user_tg_id');
      localStorage.removeItem('welcome_seen');
      localStorage.removeItem('demo_mode');
      localStorage.removeItem('demo_start');
      localStorage.removeItem('demo_used');
      toast({ title: 'Session reset', description: 'Reloading...' });
      setTimeout(() => window.location.reload(), 500);
    }, 8000);
  }, [toast]);

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);
  // =============================================================

  useEffect(() => {
    const checkAuth = () => {
      const storedAuthed = localStorage.getItem('is_authed') === 'true';
      const demoMode = localStorage.getItem('demo_mode') === 'true';
      const demoStart = localStorage.getItem('demo_start');
      const demoUsed = localStorage.getItem('demo_used') === 'true';

      // 1. Проверка демо-режима (1 МИНУТА)
      if (demoMode && demoStart) {
        const DEMO_LIMIT = 1 * 60 * 1000; // 1 минута в мс
        const elapsed = Date.now() - Number(demoStart);

        if (elapsed >= DEMO_LIMIT) {
          localStorage.removeItem('demo_mode');
          localStorage.removeItem('demo_start');
          localStorage.setItem('demo_used', 'true');
          setIsAuthenticated(false);
          return;
        }

        setIsAuthenticated(true);

        // Таймер на вылет
        const remaining = DEMO_LIMIT - elapsed;
        const timer = setTimeout(() => {
          localStorage.removeItem('demo_mode');
          localStorage.removeItem('demo_start');
          localStorage.setItem('demo_used', 'true');
          setIsAuthenticated(false); // Сначала закрываем доступ
          window.location.reload();   // Потом релоад для надежности
        }, remaining);

        return () => clearTimeout(timer);
      }

      if (demoUsed && !storedAuthed) {
        setIsAuthenticated(false);
        return;
      }

      // 2. Обычная проверка
      if (storedAuthed) {
        const storedTgId = localStorage.getItem('user_tg_id');
        const tg = (window as any).Telegram?.WebApp;
        const currentTgId = tg?.initDataUnsafe?.user?.id;

        if (currentTgId && storedTgId && String(currentTgId) !== storedTgId) {
          setIsAuthenticated(false);
        } else {
          setIsAuthenticated(true);
        }
      } else {
        setIsAuthenticated(false);
      }
    };

    checkAuth();
    setIsLoading(false);

    // Telegram Init
    if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
      const tg = (window as any).Telegram.WebApp;
      tg.ready();
      tg.expand();
    }
  }, [isAuthenticated]); // Добавляем isAuthenticated, чтобы эффект реагировал на вход
  // ====== РЕНДЕР ======
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0B0E14]">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthScreen onAuthenticated={() => setIsAuthenticated(true)} />;
  }

  return (
    <main className="flex flex-col h-full w-full relative overflow-hidden animate-in fade-in duration-1000">
      {/* Невидимая зона для скрытого сброса сессии (правый верхний угол) */}
      <div
        className="absolute top-0 right-0 w-10 h-10 z-50"
        onTouchStart={handleLongPressStart}
        onTouchEnd={handleLongPressEnd}
        onTouchCancel={handleLongPressEnd}
        onMouseDown={handleLongPressStart}
        onMouseUp={handleLongPressEnd}
        onMouseLeave={handleLongPressEnd}
      />

      <div className="flex-1 overflow-hidden relative">
        {activeTab === 'questions' && <QuestionsTab />}
        {activeTab === 'tests' && <TestsTab />}
        {activeTab === 'tasks' && <TasksTab />}
        {activeTab === 'stats' && <StatsTab />}
      </div>
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
    </main>
  );
}