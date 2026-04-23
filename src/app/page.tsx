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

  // --- Скрытый сброс сессии через долгое нажатие (2 секунды) ---
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLongPressStart = useCallback(() => {
    longPressTimerRef.current = setTimeout(() => {
      // Сброс сессии
      localStorage.removeItem('is_authed');
      localStorage.removeItem('user_tg_id');
      localStorage.removeItem('welcome_seen');
      toast({ title: 'Session reset', description: 'Reloading...' });
      setTimeout(() => window.location.reload(), 500);
    }, 2000); // 2 секунды удержания
  }, [toast]);

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);
  // ---------------------------------------------------------

  useEffect(() => {
    const storedAuthed = localStorage.getItem('is_authed') === 'true';

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
      {/* Заголовок со скрытым long-press сбросом сессии */}
      <div className="flex justify-center pt-4 pb-2">
        <h1
          className="text-lg font-bold text-white/40 select-none cursor-default"
          onTouchStart={handleLongPressStart}
          onTouchEnd={handleLongPressEnd}
          onTouchCancel={handleLongPressEnd}
          onMouseDown={handleLongPressStart}
          onMouseUp={handleLongPressEnd}
          onMouseLeave={handleLongPressEnd}
        >
          OrthoByNekruz
        </h1>
      </div>

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