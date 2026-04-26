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

  // --- Скрытый сброс сессии (долгое нажатие 8 сек на невидимую область) ---
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLongPressStart = useCallback(() => {
    longPressTimerRef.current = setTimeout(() => {
      localStorage.removeItem('is_authed');
      localStorage.removeItem('user_tg_id');
      localStorage.removeItem('welcome_seen');
      toast({ title: 'Session reset', description: 'Reloading...' });
      setTimeout(() => window.location.reload(), 500);
    }, 8000); // 8 секунд удержания
  }, [toast]);

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);
  // ------------------------------------------------------------------------

  useEffect(() => {
  const storedAuthed = localStorage.getItem('is_authed') === 'true';
  const demoMode = localStorage.getItem('demo_mode') === 'true';
  const demoStart = localStorage.getItem('demo_start');

  // 1. Сначала проверяем демо-режим
  if (demoMode && demoStart) {
    const elapsed = Date.now() - Number(demoStart);
    if (elapsed > 5 * 60 * 1000) {
      // Время демо истекло — сбрасываем
      localStorage.removeItem('demo_mode');
      localStorage.removeItem('demo_start');
      setIsAuthenticated(false);
      setIsLoading(false);
      return;
    }
    // Демо ещё активно — пускаем
    setIsAuthenticated(true);
    setIsLoading(false);

    // Таймер, который выкинет через оставшееся время
    const remaining = 5 * 60 * 1000 - elapsed;
    const timer = setTimeout(() => {
      localStorage.removeItem('demo_mode');
      localStorage.removeItem('demo_start');
      window.location.reload();
    }, remaining);

    return () => clearTimeout(timer);
  }

  // 2. Обычная проверка авторизации (твой исходный код)
  if (storedAuthed) {
    const storedTgId = localStorage.getItem('user_tg_id');
    const tg = (window as any).Telegram?.WebApp;
    const currentTgId = tg?.initDataUnsafe?.user?.id;

    if (currentTgId && storedTgId && String(currentTgId) !== storedTgId) {
      localStorage.removeItem('is_authed');
      localStorage.removeItem('user_tg_id');
      localStorage.removeItem('welcome_seen');
      setIsAuthenticated(false);
    } else {
      setIsAuthenticated(true);
    }
  } else {
    setIsAuthenticated(false);
  }

  // 3. Инициализация Telegram Mini App
  if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
    const tg = (window as any).Telegram.WebApp;
    tg.ready();
    tg.expand();
    tg.setHeaderColor('#0B0E14');
    tg.setBackgroundColor('#0B0E14');
  }

  setIsLoading(false);
}, []);

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