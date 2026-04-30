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

// ─────────────────────────────────────────────────────────────────────────────
// Telegram Mini App инициализация.
// Safe areas живут ТОЛЬКО в CSS (globals.css через --tg-safe-area-inset-*).
// Здесь только: ready, expand, fullscreen, disableVerticalSwipes, цвета.
// ─────────────────────────────────────────────────────────────────────────────
function initTelegramApp(): () => void {
  if (typeof window === 'undefined') return () => {};
  const tg = (window as any).Telegram?.WebApp;
  if (!tg) return () => {};

  tg.ready();
  tg.expand();
  try { tg.requestFullscreen(); } catch {}

  const disableSwipe = () => { try { tg.disableVerticalSwipes(); } catch {} };
  disableSwipe();
  const t1 = setTimeout(disableSwipe, 200);
  const t2 = setTimeout(disableSwipe, 700);
  const t3 = setTimeout(disableSwipe, 1500);

  try { tg.enableClosingConfirmation(); } catch {}

  const theme = localStorage.getItem('theme') || 'dark';
  const bg = theme === 'light' ? '#F0EDE4' : '#111318';
  try { tg.setHeaderColor(bg); } catch {}
  try { tg.setBackgroundColor(bg); } catch {}
  try { tg.setBottomBarColor(bg); } catch {}

  const onVisible = () => {
    if (document.visibilityState === 'visible') disableSwipe();
  };
  document.addEventListener('visibilitychange', onVisible);

  return () => {
    clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
    document.removeEventListener('visibilitychange', onVisible);
  };
}

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading,       setIsLoading]       = useState<boolean>(true);
  const [activeTab,       setActiveTab]       = useState<TabType>('questions');
  const { toast } = useToast();
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Telegram: ТОЛЬКО ОДИН РАЗ при монтировании ───────────────────────────
  useEffect(() => initTelegramApp(), []);

  // ── Тема ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem('theme') || 'dark';
    const root = document.documentElement;
    root.classList.remove('dark', 'bright');
    if (saved === 'dark')   root.classList.add('dark');
    if (saved === 'bright') root.classList.add('dark', 'bright');
  }, []);

  // ── Авторизация ───────────────────────────────────────────────────────────
  useEffect(() => {
    const authed   = localStorage.getItem('is_authed') === 'true';
    const demo     = localStorage.getItem('demo_mode')  === 'true';
    const demoTs   = localStorage.getItem('demo_start');
    const demoUsed = localStorage.getItem('demo_used')  === 'true';

    if (demo && demoTs) {
      const LIMIT = 60_000;
      const check = () => {
        if (Date.now() - Number(demoTs) >= LIMIT) {
          ['is_authed','demo_mode','demo_start'].forEach(k => localStorage.removeItem(k));
          localStorage.setItem('demo_used','true');
          setIsAuthenticated(false);
          window.location.reload();
          return true;
        }
        return false;
      };
      if (check()) return;
      setIsAuthenticated(true);
      setIsLoading(false);
      const iv = setInterval(check, 1000);
      return () => clearInterval(iv);
    }

    if (demoUsed && !authed) { setIsAuthenticated(false); setIsLoading(false); return; }

    if (authed) {
      const storedId  = localStorage.getItem('user_tg_id');
      const currentId = (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id;
      if (currentId && storedId && String(currentId) !== storedId) {
        localStorage.removeItem('is_authed');
        setIsAuthenticated(false);
      } else {
        setIsAuthenticated(true);
      }
    } else {
      setIsAuthenticated(false);
    }
    setIsLoading(false);
  }, []);

  const pressStart = useCallback(() => {
    longPressRef.current = setTimeout(() => {
      localStorage.clear();
      toast({ title: 'Сброс', description: 'Данные очищены. Перезагрузка...' });
      setTimeout(() => window.location.reload(), 500);
    }, 8000);
  }, [toast]);

  const pressEnd = useCallback(() => {
    if (longPressRef.current) { clearTimeout(longPressRef.current); longPressRef.current = null; }
  }, []);

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
    <main className="flex flex-col h-[100dvh] w-full relative overflow-hidden">
      <div className="absolute top-0 right-0 w-16 h-16 z-50"
        onTouchStart={pressStart} onTouchEnd={pressEnd} onTouchCancel={pressEnd}
        onMouseDown={pressStart}  onMouseUp={pressEnd}  onMouseLeave={pressEnd} />
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
