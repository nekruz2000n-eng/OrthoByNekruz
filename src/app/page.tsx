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

// ─── Ядро исправления: вычисляет и записывает --safe-top и --safe-bottom ───────
//
// Проблема с CSS var() fallback:
//   var(--tg-safe-area-inset-top, 45px)  →  работает только если переменная
//   вообще НЕ ОПРЕДЕЛЕНА. Если Telegram установил её в "0px" — CSS считает это
//   валидным значением и fallback игнорируется. Поэтому мы читаем значение в JS,
//   проверяем его программно и пишем правильный результат в наши переменные.
//
// Алгоритм:
//   1. Десктоп (tdesktop/weba/macos/unknown) → 0px всегда.
//   2. iOS/Android → читаем TG-переменные. Если их сумма > 0 — используем.
//      Иначе → жёсткий fallback 44px (высота Telegram-шапки на мобильных).
// ─────────────────────────────────────────────────────────────────────────────
function applyTelegramSafeAreas(tg: any): void {
  const platform: string = tg?.platform ?? 'unknown';
  const isDesktop = ['tdesktop', 'weba', 'macos', 'unknown'].includes(platform);
  const root = document.documentElement;

  if (isDesktop) {
    // На десктопе safe area всегда 0 — Telegram не показывает мобильные кнопки
    root.style.setProperty('--safe-top', '0px');
    root.style.setProperty('--safe-bottom', '0px');
    return;
  }

  // На мобильных читаем CSS-переменные, которые TG SDK устанавливает после tg.ready()
  const style = getComputedStyle(root);

  // --tg-content-safe-area-inset-top: отступ ПОД кнопками Telegram (Закрыть / Меню).
  //   Это именно то, что нам нужно для шапки контента.
  const tgContentTop = parseFloat(
    style.getPropertyValue('--tg-content-safe-area-inset-top').trim()
  ) || 0;

  // --tg-safe-area-inset-top: отступ системного статус-бара (iOS notch и т.п.).
  //   На современных версиях TG SDK оба значения суммируются.
  const tgTop = parseFloat(
    style.getPropertyValue('--tg-safe-area-inset-top').trim()
  ) || 0;

  const tgBottom = parseFloat(
    style.getPropertyValue('--tg-safe-area-inset-bottom').trim()
  ) || 0;

  // Суммируем: контентный отступ + системный отступ
  const totalTop = tgContentTop + tgTop;

  // Если TG вернул 0 (старый Android TG не поддерживает эти переменные) —
  // используем фиксированный fallback 44px. Это высота стандартной шапки Telegram.
  root.style.setProperty('--safe-top', totalTop > 0 ? `${totalTop}px` : '44px');
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

    // ─── Инициализация Telegram Mini App ─────────────────────────────────────
    if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
      const tg = (window as any).Telegram.WebApp;

      tg.ready();
      tg.expand();
      tg.setHeaderColor('#0B0E14');
      tg.setBackgroundColor('#0B0E14');
      try { tg.setBottomBarColor('#0B0E14'); } catch {}

      // Первая попытка — сразу после tg.ready(). SDK мог уже выставить CSS-vars.
      applyTelegramSafeAreas(tg);

      // Повторная попытка через 150ms: некоторые версии TG SDK на Android
      // устанавливают --tg-content-safe-area-inset-top асинхронно.
      // Пересчёт CSS-переменных — это просто запись числа в style, визуально
      // незаметно даже если произошёл сдвиг на несколько пикселей.
      setTimeout(() => applyTelegramSafeAreas(tg), 150);
    }
    // ─────────────────────────────────────────────────────────────────────────
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
      {/* Невидимая зона для скрытого сброса (8-секундное удержание) */}
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
