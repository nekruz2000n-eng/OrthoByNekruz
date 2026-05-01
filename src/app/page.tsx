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
//  Режимы запуска Mini App:
//
//  FULLSIZE (BotFather → Fullsize):
//    Telegram рисует свой header сверху и сам обрезает viewport снизу
//    (home indicator уже учтён Telegram'ом).
//    contentSafeAreaInsets = {top:0, bottom:0}
//    safeAreaInsets        = {top:0, bottom:0}
//    → нам НЕ нужно добавлять отступ снизу — Telegram viewport уже обрезан.
//    → navBottom = 8px (минимальный зазор под пилюлей навигации)
//
//  FULLSCREEN (BotFather → Fullscreen):
//    Контент рисуется поверх шапки и home indicator.
//    contentSafeAreaInsets.top > 0  (высота overlay-шапки TG)
//    contentSafeAreaInsets.bottom может быть > 0 (bottom bar TG)
//    → navBottom = tgBottom + 24px
// ─────────────────────────────────────────────────────────────────────────────
function updateSafeAreas(tg: any): void {
  const root = document.documentElement;

  const sysTop   = tg?.safeAreaInsets?.top          ?? 0;
  const tgTop    = tg?.contentSafeAreaInsets?.top   ?? 0;
  const tgBottom = tg?.contentSafeAreaInsets?.bottom ?? 0;

  // В Fullsize-режиме Telegram сам обрезает viewport снизу —
  // home indicator уже НЕ входит в наш viewport.
  // Определяем режим: если isFullscreen=true ИЛИ tgTop>0 — fullscreen.
  // Иначе — fullsize/bottom-sheet, лишний отступ снизу не нужен.
  const isFullscreen = tg?.isFullscreen === true || tgTop > 0;

  const headerPt  = sysTop + tgTop + 44;
  // навбар ~52px высота + 8px paddingTop + navBottom paddingBottom
  // scroll-pb = навбар + запас чтобы последний элемент не прятался
  const scrollPb  = tgBottom + (isFullscreen ? 100 : 84);
  // Fullsize: 0px — контейнер навигации сам доходит до bottom:0,
  // полоса закрыта фоном навигационного div-а.
  // Fullscreen: tgBottom + 20px (под bottom bar TG).
  const navBottom = tgBottom + (isFullscreen ? 20 : 0);

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
  //
  //  Логика двухуровневая:
  //  A) Жёсткая блокировка — если касание НАЧАЛОСЬ в верхних 80px экрана
  //     И палец идёт вниз: блокируем немедленно, не ищем скролл-контейнер.
  //     Именно так Telegram в Fullsize перехватывает «закрывающий» жест.
  //
  //  B) Обычная блокировка — если скролл-контейнер найден и scrollTop=0:
  //     блокируем, т.к. скролить уже некуда, значит жест — для закрытия.
  //
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

    // Только свайп ВНИЗ (dy > 0)
    if (dy <= 5) return;

    // A) Жёсткая блокировка: касание началось в верхних 80px
    //    Telegram в этой зоне перехватывает жест для закрытия/сворачивания
    if (touchStartY < 80) {
      e.preventDefault();
      return;
    }

    // B) Ищем реальный прокручиваемый элемент (обходим DOM вверх)
    let el = e.target as HTMLElement | null;
    let scrollEl: HTMLElement | null = null;
    while (el && el !== document.body) {
      if (el.hasAttribute('data-radix-scroll-area-viewport')) { scrollEl = el; break; }
      if (el.classList.contains('scroll-container')) { scrollEl = el; break; }
      const oy = window.getComputedStyle(el).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight) { scrollEl = el; break; }
      el = el.parentElement;
    }

    // Скролл-контейнера нет — блокируем
    if (!scrollEl) { e.preventDefault(); return; }

    // Скролл-контейнер в самом верху — блокируем
    if (scrollEl.scrollTop <= 0) { e.preventDefault(); }
  };

  document.addEventListener('touchstart', onTouchStart, { passive: true });
  document.addEventListener('touchmove',  onTouchMove,  { passive: false });

  // ── 5. СЛОЙ 3: Кнопка «Назад» + подтверждение закрытия ─────────────────────
  //
  //  Два способа подписаться на BackButton — для разных версий TG:
  //  • tg.BackButton.onClick()  — новый API (TG 6.1+)
  //  • tg.onEvent('backButtonClicked') — событийный API, более надёжный
  //
  //  enableClosingConfirmation() — показывает диалог при попытке закрыть
  //  через X-кнопку или свайп (резервная защита).
  //
  const onBackButton = () => {
    try {
      tg.showConfirm(
        'Выйти из OrthoByNekruz?',
        (confirmed: boolean) => { if (confirmed) tg.close(); }
      );
    } catch {
      // Если showConfirm недоступен — просто не закрываем
    }
  };

  try { tg.BackButton.show(); }   catch {}
  try { tg.BackButton.onClick(onBackButton); } catch {}  // API-метод
  try { tg.onEvent('backButtonClicked', onBackButton); } catch {}  // событие

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
    try { tg.offEvent('backButtonClicked',      onBackButton);      } catch {}
    try { tg.BackButton.offClick(onBackButton); } catch {}
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
