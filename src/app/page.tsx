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

  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLongPressStart = useCallback(() => {
    longPressTimerRef.current = setTimeout(() => {
      localStorage.clear();
      toast({ title: 'Session reset', description: 'All data cleared. Reloading...' });
      setTimeout(() => window.location.reload(), 500);
    }, 8000);
  }, [toast]);

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const initAuth = () => {
      const storedAuthed = localStorage.getItem('is_authed') === 'true';
      const demoMode = localStorage.getItem('demo_mode') === 'true';
      const demoStart = localStorage.getItem('demo_start');
      const demoUsed = localStorage.getItem('demo_used') === 'true';

      if (demoMode && demoStart) {
        const DEMO_LIMIT = 1 * 60 * 1000;

        const checkDemoStatus = () => {
          const elapsed = Date.now() - Number(demoStart);
          if (elapsed >= DEMO_LIMIT) {
            localStorage.removeItem('is_authed');
            localStorage.removeItem('demo_mode');
            localStorage.removeItem('demo_start');
            localStorage.setItem('demo_used', 'true');
            setIsAuthenticated(false);
            window.location.reload();
            return true;
          }
          return false;
        };

        if (checkDemoStatus()) return;

        setIsAuthenticated(true);
        setIsLoading(false);

        const interval = setInterval(() => {
          checkDemoStatus();
        }, 1000);

        return () => clearInterval(interval);
      }

      if (demoUsed && !storedAuthed) {
        setIsAuthenticated(false);
        setIsLoading(false);
        return;
      }

      if (storedAuthed) {
        const storedTgId = localStorage.getItem('user_tg_id');
        const tg = (window as any).Telegram?.WebApp;
        const currentTgId = tg?.initDataUnsafe?.user?.id;

        if (currentTgId && storedTgId && String(currentTgId) !== storedTgId) {
          localStorage.removeItem('is_authed');
          setIsAuthenticated(false);
        } else {
          setIsAuthenticated(true);
        }
      } else {
        setIsAuthenticated(false);
      }

      setIsLoading(false);
    };

    initAuth();

    // Инициализация Telegram Mini App
    if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
      const tg = (window as any).Telegram.WebApp;
      tg.ready();
      tg.expand();
      tg.setHeaderColor('#0B0E14');
      tg.setBackgroundColor('#0B0E14');

      // --- ИНЖЕНЕРНЫЙ ФИКС ОТСТУПОВ ---
      // Узнаем платформу: пк/браузер или телефон (android/ios)
      const isDesktop = ['tdesktop', 'weba', 'macos', 'unknown'].includes(tg.platform);
      
      // Если телефон: берем отступ ТГ, а если его нет (старый ТГ) — жестко ставим 45px под кнопку "Закрыть".
      // Если ПК: отступ не нужен (оставляем базовые 16px шапки).
      const topPadding = isDesktop 
        ? '16px' 
        : 'calc(var(--tg-safe-area-inset-top, 45px) + 16px)';
        
      // Записываем это в глобальную память стилей сайта
      document.documentElement.style.setProperty('--dynamic-top', topPadding);
    }
  }, [isAuthenticated]);

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
    <main className="flex flex-col h-[100dvh] w-full relative overflow-hidden animate-in fade-in duration-1000">
      <div
        className="absolute top-0 right-0 w-15 h-15 z-50"
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