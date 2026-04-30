"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AuthScreen }    from '@/components/AuthScreen';
import { Navigation, TabType } from '@/components/Navigation';
import { QuestionsTab }  from '@/components/QuestionsTab';
import { TestsTab }      from '@/components/TestsTab';
import { TasksTab }      from '@/components/TasksTab';
import { StatsTab }      from '@/components/StatsTab';
import { Loader2 }       from 'lucide-react';
import { useToast }      from '@/hooks/use-toast';

// ─────────────────────────────────────────────────────────────────────────────
//  updateSafeAreas
//
//  Читает tg.safeAreaInsets и tg.contentSafeAreaInsets как JS-ОБЪЕКТЫ
//  (не через getComputedStyle!), и пишет итоговые значения напрямую
//  в style на <html>.
//
//  Почему именно так:
//  • CSS-переменные --tg-safe-area-inset-* Telegram может установить
//    с задержкой после requestFullscreen — layout к тому моменту уже
//    нарисован с fallback 0px.
//  • JS-объект tg.safeAreaInsets всегда актуален в момент вызова.
//  • События safeAreaChanged / contentSafeAreaChanged стреляют именно
//    тогда, когда Telegram меняет эти значения (fullscreen-переход,
//    поворот экрана, etc.).
// ─────────────────────────────────────────────────────────────────────────────
function updateSafeAreas(tg: any): void {
  const root = document.documentElement;

  // safeAreaInsets — системная строка статуса (notch, Dynamic Island)
  const sysTop    = tg?.safeAreaInsets?.top    ?? 0;
  const sysBottom = tg?.safeAreaInsets?.bottom ?? 0;

  // contentSafeAreaInsets — шапка Telegram (header Mini App)
  // В fullscreen-режиме это высота overlay Telegram.
  // В bottom-sheet режиме = 0 (Telegram рисует header отдельно).
  const tgTop = tg?.contentSafeAreaInsets?.top ?? 0;

  const headerPt  = sysTop + tgTop + 16;  // 16px = базовый padding
  const scrollPb  = sysBottom + 96;
  const navBottom = sysBottom + 24;

  root.style.setProperty('--header-pt',  `${headerPt}px`);
  root.style.setProperty('--scroll-pb',  `${scrollPb}px`);
  root.style.setProperty('--nav-bottom', `${navBottom}px`);
}

// ─────────────────────────────────────────────────────────────────────────────
//  initTelegramApp — вызывается СТРОГО ОДИН РАЗ при монтировании.
//  Возвращает cleanup-функцию.
// ─────────────────────────────────────────────────────────────────────────────
function initTelegramApp(): () => void {
  if (typeof window === 'undefined') return () => {};
  const tg = (window as any).Telegram?.WebApp;
  if (!tg) return () => {};

  // 1. Сигнализируем что приложение готово
  tg.ready();

  // 2. Разворачиваем на весь экран
  tg.expand();
  try { tg.requestFullscreen(); } catch {}

  // 3. Запрет свайпа вниз — главная защита от сворачивания
  const disableSwipe = () => { try { tg.disableVerticalSwipes(); } catch {} };
  disableSwipe();
  const swipeTimers = [
    setTimeout(disableSwipe, 200),
    setTimeout(disableSwipe, 700),
    setTimeout(disableSwipe, 1500),
    setTimeout(disableSwipe, 3000),
  ];

  // 4. Диалог подтверждения перед закрытием — резервная защита
  try { tg.enableClosingConfirmation(); } catch {}

  // 5. Цвет системной шапки и фона
  const theme = localStorage.getItem('theme') || 'dark';
  const bg = theme === 'light' ? '#F0EDE4' : '#111318';
  try { tg.setHeaderColor(bg); }    catch {}
  try { tg.setBackgroundColor(bg); } catch {}
  try { tg.setBottomBarColor(bg); }  catch {}

  // 6. Safe areas — первый вызов сразу
  updateSafeAreas(tg);

  // 7. Повторный вызов через паузы:
  //    requestFullscreen() — async, Telegram обновит contentSafeAreaInsets
  //    только после того как fullscreen реально granted (~100-500мс).
  const safeTimers = [
    setTimeout(() => updateSafeAreas(tg), 100),
    setTimeout(() => updateSafeAreas(tg), 400),
    setTimeout(() => updateSafeAreas(tg), 900),
    setTimeout(() => updateSafeAreas(tg), 2000),
  ];

  // 8. Слушаем события изменения safe areas.
  //    Они стреляют при: fullscreen-переходе, повороте экрана,
  //    появлении/скрытии клавиатуры, переходе между режимами.
  const onSafeArea        = () => updateSafeAreas(tg);
  const onContentSafeArea = () => updateSafeAreas(tg);
  const onFullscreen      = () => { disableSwipe(); updateSafeAreas(tg); };

  try { tg.onEvent('safeAreaChanged',        onSafeArea);        } catch {}
  try { tg.onEvent('contentSafeAreaChanged', onContentSafeArea); } catch {}
  try { tg.onEvent('fullscreenChanged',      onFullscreen);      } catch {}
  try { tg.onEvent('viewportChanged',        onSafeArea);        } catch {}

  // 9. При возврате в приложение — пересчёт safe areas и swipe
  const onVisible = () => {
    if (document.visibilityState === 'visible') {
      disableSwipe();
      updateSafeAreas(tg);
    }
  };
  document.addEventListener('visibilitychange', onVisible);

  // 10. Cleanup
  return () => {
    [...swipeTimers, ...safeTimers].forEach(clearTimeout);
    document.removeEventListener('visibilitychange', onVisible);
    try { tg.offEvent('safeAreaChanged',        onSafeArea);        } catch {}
    try { tg.offEvent('contentSafeAreaChanged', onContentSafeArea); } catch {}
    try { tg.offEvent('fullscreenChanged',      onFullscreen);      } catch {}
    try { tg.offEvent('viewportChanged',        onSafeArea);        } catch {}
  };
}

// ═════════════════════════════════════════════════════════════════════════════

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading,       setIsLoading]       = useState<boolean>(true);
  const [activeTab,       setActiveTab]       = useState<TabType>('questions');
  const { toast }    = useToast();
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── TG: СТРОГО ОДИН РАЗ при монтировании ─────────────────────────────────
  useEffect(() => initTelegramApp(), []);

  // ── Тема ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem('theme') || 'dark';
    const root  = document.documentElement;
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
          ['is_authed', 'demo_mode', 'demo_start'].forEach(k => localStorage.removeItem(k));
          localStorage.setItem('demo_used', 'true');
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

  // ── Сброс (8 сек удержание) ───────────────────────────────────────────────
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

  // ─────────────────────────────────────────────────────────────────────────
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
      {/* Скрытая зона 8-сек сброса */}
      <div
        className="absolute top-0 right-0 w-16 h-16 z-50"
        onTouchStart={pressStart} onTouchEnd={pressEnd} onTouchCancel={pressEnd}
        onMouseDown={pressStart}  onMouseUp={pressEnd}  onMouseLeave={pressEnd}
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
