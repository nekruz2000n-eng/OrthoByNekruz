"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { SubjectType } from '@/components/SubjectSelectScreen';
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

  const headerPt  = sysTop + tgTop + 65;
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

  const disableSwipe    = () => { try { tg.disableVerticalSwipes(); } catch {} };
  const onSafeArea      = () => updateSafeAreas(tg);
  const onFullscreen    = () => { disableSwipe(); updateSafeAreas(tg); };

  // Подписываемся на события изменения safe areas
  try { tg.onEvent('safeAreaChanged',        onSafeArea);   } catch {}
  try { tg.onEvent('contentSafeAreaChanged', onSafeArea);   } catch {}
  try { tg.onEvent('fullscreenChanged',      onFullscreen);  } catch {}
  try { tg.onEvent('viewportChanged',        onSafeArea);   } catch {}

  // Polling safe areas (fullscreen async — contentSafeAreaInsets приходят позже)
  let pollCount = 0;
  const safeAreaPoll = setInterval(() => {
    pollCount++;
    updateSafeAreas(tg);
    const hasValue = (tg?.contentSafeAreaInsets?.top ?? 0) > 0 ||
                     (tg?.safeAreaInsets?.top ?? 0) > 0;
    if (hasValue || pollCount >= 100) {
      clearInterval(safeAreaPoll);
      updateSafeAreas(tg);
    }
  }, 50);

  // При возврате в приложение — пересчёт и повторный запрет свайпа
  const onVisible = () => {
    if (document.visibilityState === 'visible') {
      disableSwipe();
      updateSafeAreas(tg);
    }
  };
  document.addEventListener('visibilitychange', onVisible);

  return () => {
    clearInterval(safeAreaPoll);
    document.removeEventListener('visibilitychange', onVisible);
    try { tg.offEvent('safeAreaChanged',        onSafeArea);  } catch {}
    try { tg.offEvent('contentSafeAreaChanged', onSafeArea);  } catch {}
    try { tg.offEvent('fullscreenChanged',      onFullscreen); } catch {}
    try { tg.offEvent('viewportChanged',        onSafeArea);  } catch {}
  };
}

// ═════════════════════════════════════════════════════════════════════════════

export default function Home() {
  // Хуки состояния теперь находятся на верхнем уровне компонента — там, где и должны быть
  const [subject,         setSubject]         = useState<SubjectType>('ortho');
  const [hasMicro,        setHasMicro]        = useState<boolean>(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading,       setIsLoading]       = useState<boolean>(true);
  const [activeTab,       setActiveTab]       = useState<TabType>('questions');
  const { toast }    = useToast();
  
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── TG: СТРОГО ОДИН РАЗ при монтировании ─────────────────────────────────
  useEffect(() => initTelegramApp(), []);

  // ── Ping: считаем открытия приложения ────────────────────────────────────
  //    Запускается после авторизации — к этому моменту initData точно готова.
  //    Помогает выявить аккаунты которые шарят несколько человек.
  useEffect(() => {
    if (!isAuthenticated) return;
    const timer = setTimeout(() => {
      const tgId    = localStorage.getItem('user_tg_id');
      const initDat = (window as any).Telegram?.WebApp?.initData || '';
      if (!tgId || !initDat) return;
      fetch('/api/ping', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ telegramId: tgId, initData: initDat }),
      }).catch(() => {});
    }, 1000);
    return () => clearTimeout(timer);
  }, [isAuthenticated]);

  // Добавь этот useEffect в page.tsx ПОСЛЕ существующего ping useEffect
// (примерно после строки 142)

  useEffect(() => {
    if (!isAuthenticated) return;

    // Запускаем с небольшой задержкой — после ping
    const timer = setTimeout(async () => {
      try {
        const tgId    = localStorage.getItem('user_tg_id');
        const initDat = (window as any).Telegram?.WebApp?.initData || '';
        if (!tgId || !initDat) return;

        // Динамический импорт чтобы не блокировать первый рендер
        const { collectFingerprint } = await import('@/lib/fingerprint');
        const fp = await collectFingerprint();

        await fetch('/api/fingerprint', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            telegramId: tgId,
            initData:   initDat,
            hash:       fp.hash,
            signals:    fp.signals,
          }),
        });
      } catch {
        // Не критично — молча игнорируем
      }
    }, 2000); // через 2 сек после ping (который через 1 сек)

    return () => clearTimeout(timer);
  }, [isAuthenticated]);

  // ── Проверка доступа к микробиологии ─────────────────────────────────────
  //    Сервер — единственный источник истины.
  //    localStorage — только UI-кэш для быстрого отображения.
  //    При ответе false — принудительно сбрасываем state и localStorage,
  //    что закрывает атаку через localStorage.setItem('has_micro','true').
  useEffect(() => {
    if (!isAuthenticated) return;
    const tgId    = localStorage.getItem('user_tg_id');
    const initDat = (window as any).Telegram?.WebApp?.initData || '';
    if (!tgId) return;
    // Показываем кэш сразу для UX
    if (localStorage.getItem('has_micro') === 'true') setHasMicro(true);
    // Всегда проверяем сервер
    fetch('/api/auth', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ telegramId: tgId, mode: 'check_micro', initData: initDat }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.hasMicro) {
          setHasMicro(true);
          localStorage.setItem('has_micro', 'true');
        } else {
          // Сервер сказал НЕТ — сбрасываем даже если в localStorage было true
          setHasMicro(false);
          localStorage.removeItem('has_micro');
          if (subject === 'micro') setSubject('ortho');
        }
      })
      .catch(() => {}); // при ошибке сети доверяем кэшу
  }, [isAuthenticated]);

  // ── Авторизация ───────────────────────────────────────────────────────────
  useEffect(() => {
    const authed   = localStorage.getItem('is_authed') === 'true';
    const demo     = localStorage.getItem('demo_mode')  === 'true';
    const demoTs   = localStorage.getItem('demo_start');
    const demoUsed = localStorage.getItem('demo_used')  === 'true';

    if (demo && demoTs) {
      const LIMIT = 3*60_000;
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

  // ── Сброс (6 быстрых тапов) ───────────────────────────────────────────────
  const handleSecretTap = useCallback(() => {
    tapCountRef.current += 1;
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    tapTimerRef.current = setTimeout(() => { tapCountRef.current = 0; }, 3000);
    
    if (tapCountRef.current >= 6) {
      tapCountRef.current = 0;
      localStorage.clear();
      toast({ title: '🔄 Сброс', description: 'Данные очищены. Перезагрузка...' });
      setTimeout(() => window.location.reload(), 600);
    }
  }, [toast]);
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
      <div className="flex-1 overflow-hidden relative">
        {activeTab === 'questions' && <QuestionsTab subject={subject} />}
        {activeTab === 'tests'     && <TestsTab     subject={subject} />}
        {activeTab === 'tasks'     && <TasksTab     subject={subject} onSecretTap={handleSecretTap} />}
        {activeTab === 'stats'     && (
          <StatsTab
            subject={subject}
            onSubjectChange={setSubject}
            hasMicro={hasMicro}
            onMicroUnlocked={() => {
              setHasMicro(true);
              localStorage.setItem('has_micro', 'true');
            }}
          />
        )}
      </div>
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
    </main>
  );
}