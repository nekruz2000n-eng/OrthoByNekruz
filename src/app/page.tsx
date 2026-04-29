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
      localStorage.clear(); // Очищаем вообще всё для сброса
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

  // ======== ОСНОВНАЯ ЛОГИКА АВТОРИЗАЦИИ И ДЕМО ========
  useEffect(() => {
    const initAuth = () => {
      const storedAuthed = localStorage.getItem('is_authed') === 'true';
      const demoMode = localStorage.getItem('demo_mode') === 'true';
      const demoStart = localStorage.getItem('demo_start');
      const demoUsed = localStorage.getItem('demo_used') === 'true';

      // 1. ЛОГИКА ДЕМО-РЕЖИМА
      if (demoMode && demoStart) {
        const DEMO_LIMIT = 1 * 60 * 1000; // Ровно 1 минута

        const checkDemoStatus = () => {
          const elapsed = Date.now() - Number(demoStart);
          if (elapsed >= DEMO_LIMIT) {
            // Время истекло: чистим ключи и сбрасываем стейт
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

        // Проверяем сразу при загрузке
        if (checkDemoStatus()) return;

        setIsAuthenticated(true);
        setIsLoading(false);

        // Ставим интервал для проверки каждую секунду (чтобы выкинуло мгновенно)
        const interval = setInterval(() => {
          checkDemoStatus();
        }, 1000);

        return () => clearInterval(interval);
      }

      // 2. ЕСЛИ ДЕМО ИСПОЛЬЗОВАН, НО НЕТ КЛЮЧА
      if (demoUsed && !storedAuthed) {
        setIsAuthenticated(false);
        setIsLoading(false);
        return;
      }

      // 3. ОБЫЧНАЯ АВТОРИЗАЦИЯ ПО КЛЮЧУ
      if (storedAuthed) {
        const storedTgId = localStorage.getItem('user_tg_id');
        const tg = (window as any).Telegram?.WebApp;
        const currentTgId = tg?.initDataUnsafe?.user?.id;

        // Если ID сменился — сбрасываем
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
    }
  }, [isAuthenticated]); // Следим за изменением стейта для перезапуска логики

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
    <main 
     className="flex flex-col h-[100dvh] w-full relative overflow-hidden animate-in fade-in duration-1000"
      style={{
        // Оставляем ТОЛЬКО переменную Телеграма, а если её нет — ставим 0px.
        // Теперь отступ будет появляться только тогда, когда он реально нужен!
        paddingTop: 'var(--tg-safe-area-inset-top, 0px)'
      }}
    >
      {/* Невидимая зона для скрытого сброса сессии (правый верхний угол) */}
      <div
        className="absolute top-0 right-0 w-15 h-15 z-50"
        // ... твои обработчики нажатий
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