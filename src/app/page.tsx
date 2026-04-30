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

// ── Safe areas ──────────────────────────────────────────────────────────────
// Читаем TG-переменные ПОСЛЕ tg.ready().
// Fallback 44px применяем ТОЛЬКО если приложение в fullscreen-режиме
// (иначе Telegram рисует собственную шапку и отступ не нужен).
// ───────────────────────────────────────────────────────────────────────────
function applyTelegramSafeAreas(tg: any): void {
  const platform: string = tg?.platform ?? 'unknown';
  const isDesktop = ['tdesktop', 'weba', 'macos', 'unknown'].includes(platform);
  const root = document.documentElement;

  if (isDesktop) {
    root.style.setProperty('--safe-top', '0px');
    root.style.setProperty('--safe-bottom', '0px');
    return;
  }

  const style = getComputedStyle(root);
  const tgContentTop = parseFloat(style.getPropertyValue('--tg-content-safe-area-inset-top').trim()) || 0;
  const tgTop        = parseFloat(style.getPropertyValue('--tg-safe-area-inset-top').trim()) || 0;
  const tgBottom     = parseFloat(style.getPropertyValue('--tg-safe-area-inset-bottom').trim()) || 0;
  const totalTop     = tgContentTop + tgTop;

  // Используем 44px fallback только при подтверждённом fullscreen
  const isFullscreen = tg.isFullscreen === true;
  root.style.setProperty('--safe-top', totalTop > 0 ? `${totalTop}px` : (isFullscreen ? '44px' : '0px'));
  root.style.setProperty('--safe-bottom', `${tgBottom}px`);
}

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
    // ── Инициализация темы ────────────────────────────
    const savedTheme = localStorage.getItem('theme') || 'dark';
    const root = document.documentElement;
    root.classList.remove('dark', 'bright');
    if (savedTheme === 'dark')   root.classList.add('dark');
    if (savedTheme === 'bright') root.classList.add('dark', 'bright');

    // ── Проверка авторизации ───────────────────────────
    const initAuth = () => {
      const storedAuthed = localStorage.getItem('is_authed') === 'true';
      const demoMode   = localStorage.getItem('demo_mode') === 'true';
      const demoStart  = localStorage.getItem('demo_start');
      const demoUsed   = localStorage.getItem('demo_used') === 'true';

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
        const interval = setInterval(() => { checkDemoStatus(); }, 1000);
        return () => clearInterval(interval);
      }

      if (demoUsed && !storedAuthed) { setIsAuthenticated(false); setIsLoading(false); return; }

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

    // ── Инициализация Telegram Mini App ───────────────
    if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
      const tg = (window as any).Telegram.WebApp;

      tg.ready();

      // Полноэкранный режим
      tg.expand();
      try { tg.requestFullscreen(); } catch {}

      // ▶ ГЛАВНОЕ: запрет свайпа вниз
      try { tg.disableVerticalSwipes(); } catch {}

      // Подтверждение перед закрытием (резервная защита)
      try { tg.enableClosingConfirmation(); } catch {}

      // Цвет шапки/фона под текущую тему
      const headerBg = savedTheme === 'light' ? '#EDE9E0' : '#111318';
      tg.setHeaderColor(headerBg);
      tg.setBackgroundColor(headerBg);
      try { tg.setBottomBarColor(headerBg); } catch {}

      // Пересчёт safe areas
      applyTelegramSafeAreas(tg);
      setTimeout(() => applyTelegramSafeAreas(tg), 150);
      setTimeout(() => applyTelegramSafeAreas(tg), 600);

      // Повторный запрет свайпа после паузы (некоторые версии TG требуют этого)
      setTimeout(() => { try { tg.disableVerticalSwipes(); } catch {} }, 300);

      // При возврате в приложение — снова блокировать свайп
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          try { (window as any).Telegram?.WebApp?.disableVerticalSwipes?.(); } catch {}
          applyTelegramSafeAreas((window as any).Telegram.WebApp);
        }
      });
    }
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthScreen onAuthenticated={() => setIsAuthenticated(true)} />;
  }

  return (
    <main className="flex flex-col h-[100dvh] w-full relative overflow-hidden animate-in fade-in duration-700">
      {/* Скрытая зона для сброса данных (8 сек удержание) */}
      <div
        className="absolute top-0 right-0 w-16 h-16 z-50"
        onTouchStart={handleLongPressStart}
        onTouchEnd={handleLongPressEnd}
        onTouchCancel={handleLongPressEnd}
        onMouseDown={handleLongPressStart}
        onMouseUp={handleLongPressEnd}
        onMouseLeave={handleLongPressEnd}
      />
      <div className="flex-1 overflow-hidden relative">
        {activeTab === 'questions' && <QuestionsTab />}
        {activeTab === 'tests'     && <TestsTab />}
        {activeTab === 'tasks'     && <TasksTab />}
        {activeTab === 'stats'     && <StatsTab />}
      </div>
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
    </main>
  );
}
