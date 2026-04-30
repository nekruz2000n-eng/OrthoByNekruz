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

// ─── updateSafeAreas ─────────────────────────────────────────────────────────
//
//  sysTop  = статус-бар (notch, Dynamic Island) — из safeAreaInsets.top
//  tgTop   = Telegram overlay header — из contentSafeAreaInsets.top
//            В fullscreen-режиме > 0 (TG рисует шапку поверх нашего контента).
//            В bottom-sheet = 0 (TG шапка вне нашего viewport).
//
//  ДЛЯ НИЗА используем ТОЛЬКО contentSafeAreaInsets.bottom, НЕ safeAreaInsets.bottom:
//  В bottom-sheet Telegram сам обрезает viewport выше home indicator —
//  если добавить safeAreaInsets.bottom, получим двойной отступ (баг на фото 1).
// ─────────────────────────────────────────────────────────────────────────────
function updateSafeAreas(tg: any): void {
  const root = document.documentElement;

  const sysTop    = tg?.safeAreaInsets?.top         ?? 0;
  const tgTop     = tg?.contentSafeAreaInsets?.top  ?? 0;
  // contentSafeAreaInsets.bottom = Telegram bottom bar в fullscreen.
  // В bottom-sheet = 0. Не используем safeAreaInsets.bottom — двойной счёт!
  const tgBottom  = tg?.contentSafeAreaInsets?.bottom ?? 0;

  const headerPt  = sysTop + tgTop + 16;
  const scrollPb  = tgBottom + 96;
  const navBottom = tgBottom + 24;

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

  // ── 1. Готовность ──────────────────────────────────────────────────────────
  tg.ready();

  // ── 2. Полный экран ────────────────────────────────────────────────────────
  //    BotFather уже выставил Fullscreen — expand() достаточно.
  //    requestFullscreen() вызываем на случай запуска через inline-кнопку.
  tg.expand();
  try { tg.requestFullscreen(); } catch {}

  // ── 3. СЛОЙ 1: Telegram API — disableVerticalSwipes ────────────────────────
  const disableSwipe = () => { try { tg.disableVerticalSwipes(); } catch {} };
  disableSwipe();
  const swipeTimers = [
    setTimeout(disableSwipe, 150),
    setTimeout(disableSwipe, 500),
    setTimeout(disableSwipe, 1200),
    setTimeout(disableSwipe, 3000),
  ];

  // ── 4. СЛОЙ 2: DOM touchmove-перехватчик ───────────────────────────────────
  //    Ищем реальный скролл-элемент: Radix UI ScrollArea использует
  //    data-radix-scroll-area-viewport, а не сам .scroll-container.
  //    Также обрабатываем обычные overflow:auto контейнеры.
  let touchStartY = 0;
  let touchStartX = 0;

  const onTouchStart = (e: TouchEvent) => {
    touchStartY = e.touches[0].clientY;
    touchStartX = e.touches[0].clientX;
  };

  const onTouchMove = (e: TouchEvent) => {
    const dy = e.touches[0].clientY - touchStartY;
    const dx = e.touches[0].clientX - touchStartX;

    // Горизонтальный свайп — не блокируем
    if (Math.abs(dx) > Math.abs(dy) + 5) return;

    // Только свайп ВНИЗ
    if (dy <= 8) return;

    // Ищем реальный прокручиваемый элемент (обходим дерево вверх)
    let el = e.target as HTMLElement | null;
    let scrollEl: HTMLElement | null = null;
    while (el && el !== document.body) {
      // Radix UI ScrollArea viewport
      if (el.hasAttribute('data-radix-scroll-area-viewport')) {
        scrollEl = el;
        break;
      }
      // Наш кастомный скролл
      if (el.classList.contains('scroll-container')) {
        scrollEl = el;
        break;
      }
      // Любой overflow-y: auto/scroll элемент
      const style = window.getComputedStyle(el);
      const oy = style.overflowY;
      if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight) {
        scrollEl = el;
        break;
      }
      el = el.parentElement;
    }

    // Если скролл-контейнер не найден — однозначно блокируем
    if (!scrollEl) {
      e.preventDefault();
      return;
    }

    // Если скролл-контейнер в самом верху — блокируем (нет куда скролить вверх)
    if (scrollEl.scrollTop <= 0) {
      e.preventDefault();
    }
    // Если есть куда скролить — позволяем скролл, не блокируем
  };

  document.addEventListener('touchstart', onTouchStart, { passive: true });
  document.addEventListener('touchmove',  onTouchMove,  { passive: false });

  // ── 5. СЛОЙ 3: BackButton (Android «Назад») + ClosingConfirmation ───────────
  try {
    tg.BackButton.show();
    tg.BackButton.onClick(() => {
      tg.showConfirm(
        'Выйти из OrthoByNekruz?',
        (confirmed: boolean) => { if (confirmed) tg.close(); }
      );
    });
  } catch {}
  try { tg.enableClosingConfirmation(); } catch {}

  // ── 6. Цвет шапки/фона ────────────────────────────────────────────────────
  const theme = localStorage.getItem('theme') || 'dark';
  const bg = theme === 'light' ? '#F0EDE4' : '#111318';
  try { tg.setHeaderColor(bg); }     catch {}
  try { tg.setBackgroundColor(bg); } catch {}
  try { tg.setBottomBarColor(bg); }  catch {}

  // ── 7. Safe areas — СРАЗУ, до polling ─────────────────────────────────────
  //    В BotFather-fullscreen режиме contentSafeAreaInsets доступны
  //    сразу после tg.ready(). Вызываем немедленно.
  updateSafeAreas(tg);

  // ── 8. Polling safe areas (50мс, макс 5 сек) ──────────────────────────────
  //    Для случая inline-кнопки: requestFullscreen() async,
  //    contentSafeAreaInsets появляются позже.
  let pollCount = 0;
  const safeAreaPoll = setInterval(() => {
    pollCount++;
    updateSafeAreas(tg);
    const hasValue =
      (tg?.contentSafeAreaInsets?.top ?? 0) > 0 ||
      (tg?.safeAreaInsets?.top        ?? 0) > 0;
    if (hasValue || pollCount >= 100) {
      clearInterval(safeAreaPoll);
      updateSafeAreas(tg);
    }
  }, 50);

  // ── 9. События Telegram ────────────────────────────────────────────────────
  const onSafeArea        = () => updateSafeAreas(tg);
  const onContentSafeArea = () => updateSafeAreas(tg);
  const onFullscreen      = () => { disableSwipe(); updateSafeAreas(tg); };

  try { tg.onEvent('safeAreaChanged',        onSafeArea);        } catch {}
  try { tg.onEvent('contentSafeAreaChanged', onContentSafeArea); } catch {}
  try { tg.onEvent('fullscreenChanged',      onFullscreen);      } catch {}
  try { tg.onEvent('viewportChanged',        onSafeArea);        } catch {}

  // ── 10. visibilitychange ───────────────────────────────────────────────────
  const onVisible = () => {
    if (document.visibilityState === 'visible') {
      disableSwipe();
      updateSafeAreas(tg);
    }
  };
  document.addEventListener('visibilitychange', onVisible);

  // ── 11. Cleanup ────────────────────────────────────────────────────────────
  return () => {
    swipeTimers.forEach(clearTimeout);
    clearInterval(safeAreaPoll);
    document.removeEventListener('touchstart',       onTouchStart);
    document.removeEventListener('touchmove',        onTouchMove);
    document.removeEventListener('visibilitychange', onVisible);
    try { tg.offEvent('safeAreaChanged',        onSafeArea);        } catch {}
    try { tg.offEvent('contentSafeAreaChanged', onContentSafeArea); } catch {}
    try { tg.offEvent('fullscreenChanged',      onFullscreen);      } catch {}
    try { tg.offEvent('viewportChanged',        onSafeArea);        } catch {}
    try { tg.BackButton.hide(); } catch {}
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
