"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { SubjectSelectScreen } from '@/components/SubjectSelectScreen';
import { AuthScreen }    from '@/components/AuthScreen';
import { Navigation, TabType } from '@/components/Navigation';
import { QuestionsTab }  from '@/components/QuestionsTab';
import { TestsTab }      from '@/components/TestsTab';
import { TasksTab }      from '@/components/TasksTab';
import { StatsTab }      from '@/components/StatsTab';
import { Loader2 }       from 'lucide-react';
import { useToast }      from '@/hooks/use-toast';
import { getDefaultSubjectId } from '@/lib/subjects';

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

  const headerPt  = sysTop + tgTop + (isFullscreen ? 65 : 12);
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
  const [subject,         setSubjectRaw]      = useState<string>(getDefaultSubjectId());
  const setSubject = useCallback((s: string) => { localStorage.setItem('last_subject', s); setSubjectRaw(s); }, []);
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
  const [navHidden, setNavHidden] = useState<Record<string, string[]>>({});
  const [showSubjectSelect, setShowSubjectSelect] = useState<boolean>(false);
  const [hasMicro,        setHasMicro]        = useState<boolean>(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading,       setIsLoading]       = useState<boolean>(true);
  const [activeTab,       setActiveTab]       = useState<TabType>('questions');
  const [testMode,        setTestMode]        = useState<boolean>(false);
  const { toast }    = useToast();

  // Если активный таб админ скрыл — переключаем на первый доступный
  useEffect(() => {
    const hidden = navHidden[subject] || [];
    if (!hidden.includes(activeTab)) return;
    const order: TabType[] = ['questions', 'tests', 'tasks', 'stats'];
    const next = order.find(t => !hidden.includes(t));
    if (next) setActiveTab(next);
  }, [subject, navHidden, activeTab]);
  
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Цвет глоссария: восстанавливаем из localStorage ──────────────────────
  useEffect(() => {
    const saved = localStorage.getItem('glossary_color');
    if (saved) document.documentElement.style.setProperty('--c-glossary', saved);
  }, []);

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
      })
        .then(r => r.json())
        .then(data => {
          if (data?.blocked === true) {
            // Пользователь заблокирован — сбрасываем localStorage и выкидываем
            localStorage.clear();
            setIsAuthenticated(false);
          }
        })
        .catch(() => {});
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
        const { collectFingerprint } = await import('@/lib/fingerprint-util');
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

  // ── Проверка доступных дисциплин ─────────────────────────────────────────
  //    Сервер — единственный источник истины.
  //    localStorage — только UI-кэш для быстрого отображения.
  //    При получении списка subjects решаем что показать:
  //      0 → экран "обратитесь к админу"
  //      1 → сразу пускаем в эту дисциплину
  //      2+ → показываем экран выбора (только если ещё не выбирали)
  useEffect(() => {
    if (!isAuthenticated) return;
    const tgId    = localStorage.getItem('user_tg_id');
    const initDat = (window as any).Telegram?.WebApp?.initData || '';
    if (!tgId) return;

    // Восстанавливаем кэш для мгновенного отображения
    try {
      const cached = JSON.parse(localStorage.getItem('available_subjects') || '[]');
      if (Array.isArray(cached)) {
        setAvailableSubjects(cached);
        setHasMicro(cached.includes('micro'));
      }
    } catch {}

    // Запрашиваем актуальный список с сервера
    fetch('/api/auth', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ telegramId: tgId, mode: 'check_subjects', initData: initDat }),
    })
      .then(async r => {
        const d = await r.json();
        // Отписался от канала — разлогиниваем и возвращаем на экран входа
        if (r.status === 403 && d.needSubscription) {
          ['is_authed', 'user_tg_id', 'available_subjects', 'subject_chosen', 'has_micro'].forEach(k => localStorage.removeItem(k));
          setIsAuthenticated(false);
          return null;
        }
        return d;
      })
      .then(d => {
        if (!d) return;
        // Пользователь был удалён — сбрасываем авторизацию и отправляем на ввод ключа
        if (d.registered === false) {
          ['is_authed', 'user_tg_id', 'available_subjects', 'subject_chosen', 'has_micro'].forEach(k => localStorage.removeItem(k));
          setIsAuthenticated(false);
          return;
        }
        const list: string[] = Array.isArray(d.subjects) ? d.subjects : [];
        setAvailableSubjects(list);
        setHasMicro(list.includes('micro'));
        setNavHidden(d.navHidden && typeof d.navHidden === 'object' ? d.navHidden : {});
        localStorage.setItem('available_subjects', JSON.stringify(list));
        // Legacy: для совместимости
        if (list.includes('micro')) localStorage.setItem('has_micro', 'true');
        else localStorage.removeItem('has_micro');

        // Если у юзера 0 открытых дисциплин — сбрасываем выбор
        if (list.length === 0) return;

        // Если текущая выбранная дисциплина закрыта — переключаемся на первую доступную
        if (!list.includes(subject)) {
          setSubject(list[0]);
        }

        // Логика показа экрана выбора:
        //   - Если выбора ещё не было И открыто 2+ дисциплин — показываем
        //   - Если открыта только 1 — сразу пускаем (выбор не нужен)
        const alreadyChosen = localStorage.getItem('subject_chosen') === 'true';
        if (!alreadyChosen && list.length >= 2) {
          setShowSubjectSelect(true);
        } else if (list.length === 1) {
          // Автоматически выбираем единственную доступную
          setSubject(list[0]);
          localStorage.setItem('subject_chosen', 'true');
        }
      })
      .catch(() => {});
  }, [isAuthenticated]);

  // ── Восстановление последнего предмета из localStorage (только на клиенте) ──
  useEffect(() => {
    const saved = localStorage.getItem('last_subject');
    if (saved) setSubjectRaw(saved);
  }, []);

  // ── Авторизация ───────────────────────────────────────────────────────────
  useEffect(() => {
    const authed   = localStorage.getItem('is_authed') === 'true';
    const demo     = localStorage.getItem('demo_mode')  === 'true';
    const demoTs   = localStorage.getItem('demo_start');
    const demoUsed = localStorage.getItem('demo_used')  === 'true';

    if (demo && demoTs) {
      const LIMIT = 5*60_000;
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

  // ── Если у пользователя нет ни одной открытой дисциплины ─────────────────
  //    Это случается когда ключ активирован, но админ ещё не открыл предметы.
  //    Демо-пользователи всегда имеют ortho, поэтому сюда не попадают.
  if (availableSubjects.length === 0 && !localStorage.getItem('demo_mode')) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-6">
        <div className="max-w-sm text-center">
          <div className="text-5xl mb-4">🔒</div>
          <h1 className="text-xl font-bold mb-3" style={{ color: 'var(--c-text)' }}>
            Доступ ещё не открыт
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--c-muted)' }}>
            Ключ успешно принят, но дисциплины пока не активированы.
            Свяжитесь с администратором.
          </p>
        </div>
      </div>
    );
  }

  // ── Экран выбора дисциплины (только когда открыто 2+ и юзер ещё не выбирал) ──
  if (showSubjectSelect) {
    return (
      <SubjectSelectScreen
        availableSubjects={availableSubjects}
        onSelect={(s: string) => {
          setSubject(s);
          setShowSubjectSelect(false);
          localStorage.setItem('subject_chosen', 'true');
        }}
      />
    );
  }

  return (
    <main className="flex flex-col h-[100dvh] w-full relative overflow-hidden">
      <div className="flex-1 overflow-hidden relative">
        {activeTab === 'questions' && <QuestionsTab subject={subject} />}
        {activeTab === 'tests'     && <TestsTab     subject={subject} onTestModeChange={setTestMode} />}
        {activeTab === 'tasks'     && <TasksTab     subject={subject} onSecretTap={handleSecretTap} />}
        {activeTab === 'stats'     && (
          <StatsTab
            subject={subject}
            onSubjectChange={setSubject}
            availableSubjects={availableSubjects}
            hasMicro={hasMicro}
            examHidden={(navHidden[subject] || []).includes('exam')}
            materialsHidden={(navHidden[subject] || []).includes('materials')}
            onMicroUnlocked={() => {
              setHasMicro(true);
              localStorage.setItem('has_micro', 'true');
            }}
          />
        )}
      </div>
      {/* В режиме решения теста навигация скрыта — она перекрывала панель тогглов */}
      {!testMode && (
        <Navigation
          activeTab={activeTab}
          onTabChange={setActiveTab}
          hiddenTabs={(navHidden[subject] || []) as TabType[]}
        />
      )}
    </main>
  );
}