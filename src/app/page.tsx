"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { SubjectSelectScreen } from '@/components/SubjectSelectScreen';
import { PreviewOnboardingScreen } from '@/components/PreviewOnboardingScreen';
import { PreviewGroupScreen } from '@/components/PreviewGroupScreen';
import { PreviewAwaitingScreen } from '@/components/PreviewAwaitingScreen';
import { ChannelCodeEntryScreen } from '@/components/ChannelCodeEntryScreen';
import { AuthScreen }    from '@/components/AuthScreen';
import { Navigation, TabType } from '@/components/Navigation';
import { QuestionsTab }  from '@/components/QuestionsTab';
import { TestsTab }      from '@/components/TestsTab';
import { TasksTab }      from '@/components/TasksTab';
import { StatsTab }      from '@/components/StatsTab';
import { Loader2 }       from 'lucide-react';
import { useToast }      from '@/hooks/use-toast';
import { getDefaultSubjectId } from '@/lib/subjects';
import type { PreviewStatus } from '@/lib/preview';
import type { SubjectCatalogEntry } from '@/lib/subjectCatalog';

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

const AUTH_STORAGE_KEYS = [
  'is_authed', 'user_tg_id', 'available_subjects', 'subject_chosen',
  'has_micro', 'preview_end', 'last_subject', 'welcome_seen',
];

function clearLocalSession() {
  AUTH_STORAGE_KEYS.forEach(k => localStorage.removeItem(k));
}

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
  const [previewStatus,   setPreviewStatus]   = useState<PreviewStatus | null>(null);
  const [pickSubjects,    setPickSubjects]     = useState<string[]>([]);
  const [previewChosen,   setPreviewChosen]    = useState<string | null>(null);
  const [previewModules,  setPreviewModules]     = useState<string[]>([]);
  const [needsStudyGroup, setNeedsStudyGroup]   = useState<boolean>(false);
  const [groupSaving,     setGroupSaving]       = useState<boolean>(false);
  const [showChannelCode, setShowChannelCode]   = useState<boolean>(false);
  const [subjectCatalog,  setSubjectCatalog]   = useState<SubjectCatalogEntry[]>([]);
  const [previewEndsAt,   setPreviewEndsAt]    = useState<string | null>(null);
  const [previewPicking,  setPreviewPicking]   = useState<boolean>(false);
  const [statusChecking,  setStatusChecking]  = useState<boolean>(false);
  const [accessChecked,   setAccessChecked]   = useState<boolean>(false);
  const { toast }    = useToast();

  /** Поздний ответ check_subjects не должен затирать свежий ответ после кода/группы. */
  const accessRequestGen = useRef(0);

  const logoutLocal = useCallback(() => {
    clearLocalSession();
    setIsAuthenticated(false);
    setAccessChecked(false);
    setAvailableSubjects([]);
    setPreviewStatus(null);
    setShowSubjectSelect(false);
  }, []);

  const applyAccessPayload = useCallback((d: any) => {
    const list: string[] = Array.isArray(d?.subjects) ? d.subjects : [];
    setAvailableSubjects(list);
    setHasMicro(list.includes('micro'));
    setNavHidden(d?.navHidden && typeof d.navHidden === 'object' ? d.navHidden : {});
    localStorage.setItem('available_subjects', JSON.stringify(list));
    if (list.includes('micro')) localStorage.setItem('has_micro', 'true');
    else localStorage.removeItem('has_micro');

    const ps = d?.previewStatus ?? null;
    setPreviewStatus(ps);
    setPreviewChosen(d?.previewChosenSubject ?? null);
    setPreviewModules(Array.isArray(d?.previewChosenModules) ? d.previewChosenModules : []);
    setNeedsStudyGroup(d?.needsStudyGroup === true);
    setPreviewEndsAt(d?.previewEndsAt ?? null);

    if (Array.isArray(d?.subjectCatalog)) setSubjectCatalog(d.subjectCatalog);
    if (Array.isArray(d?.pickSubjects)) setPickSubjects(d.pickSubjects);

    if (ps === 'active' && d?.previewEndsAt) {
      localStorage.setItem('preview_end', d.previewEndsAt);
    } else {
      localStorage.removeItem('preview_end');
    }

    if (ps === 'expired') {
      localStorage.removeItem('preview_end');
    }

    if (list.length === 0) return;

    const alreadyChosen = localStorage.getItem('subject_chosen') === 'true';
    const saved = localStorage.getItem('last_subject');
    const preferred = (saved && list.includes(saved)) ? saved : list[0];

    if (!alreadyChosen && list.length >= 2 && ps !== 'active' && ps !== 'confirmed') {
      setShowSubjectSelect(true);
      return;
    }

    setShowSubjectSelect(false);
    localStorage.setItem('subject_chosen', 'true');
    setSubjectRaw(current => {
      const next = list.includes(current) ? current : preferred;
      localStorage.setItem('last_subject', next);
      return next;
    });
  }, [setSubjectRaw]);

  const refreshAccess = useCallback(() => {
    const tgId    = localStorage.getItem('user_tg_id');
    const initDat = (window as any).Telegram?.WebApp?.initData || '';
    if (!tgId) { logoutLocal(); return Promise.resolve(); }

    setAccessChecked(false);
    const gen = ++accessRequestGen.current;
    return fetch('/api/auth', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ telegramId: tgId, mode: 'check_subjects', initData: initDat }),
    })
      .then(async r => {
        const d = await r.json();
        if (r.status === 403 && d.needSubscription) {
          logoutLocal();
          return null;
        }
        return d;
      })
      .then(d => {
        if (!d || gen !== accessRequestGen.current) return;
        if (d.registered === false) {
          logoutLocal();
          return;
        }
        applyAccessPayload(d);
      })
      .finally(() => {
        if (gen === accessRequestGen.current) setAccessChecked(true);
      });
  }, [applyAccessPayload, logoutLocal]);

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

  // ── Проверка доступных дисциплин ─────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) {
      setAccessChecked(false);
      return;
    }
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

    const gen = ++accessRequestGen.current;
    fetch('/api/auth', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ telegramId: tgId, mode: 'check_subjects', initData: initDat }),
    })
      .then(async r => {
        const d = await r.json();
        // Отписался от канала — разлогиниваем и возвращаем на экран входа
        if (r.status === 403 && d.needSubscription) {
          logoutLocal();
          return null;
        }
        return d;
      })
      .then(d => {
        if (!d || gen !== accessRequestGen.current) return;
        if (d.registered === false) {
          logoutLocal();
          setAccessChecked(true);
          return;
        }
        applyAccessPayload(d);
        setAccessChecked(true);
      })
      .catch(() => {
        if (gen === accessRequestGen.current) setAccessChecked(true);
      });
  }, [isAuthenticated, applyAccessPayload, logoutLocal]);

  // ── Восстановление последнего предмета из localStorage (только на клиенте) ──
  useEffect(() => {
    const saved = localStorage.getItem('last_subject');
    if (saved) setSubjectRaw(saved);
  }, []);

  // ── Авторизация ───────────────────────────────────────────────────────────
  useEffect(() => {
    const authed = localStorage.getItem('is_authed') === 'true';

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

  // ── Таймер сессии витрины (без отображения пользователю) ─────────────────
  useEffect(() => {
    if (!isAuthenticated || previewStatus !== 'active') return;
    const endIso = previewEndsAt || localStorage.getItem('preview_end');
    if (!endIso) return;

    const tick = () => {
      if (Date.now() >= Date.parse(endIso)) {
        setPreviewStatus('expired');
        localStorage.removeItem('preview_end');
        setAvailableSubjects([]);
        fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            telegramId: localStorage.getItem('user_tg_id'),
            mode: 'check_subjects',
            initData: (window as any).Telegram?.WebApp?.initData || '',
          }),
        })
          .then(r => r.json())
          .then(d => applyAccessPayload(d))
          .catch(() => {});
        return true;
      }
      return false;
    };

    if (tick()) return;
    const iv = setInterval(() => { if (tick()) clearInterval(iv); }, 1000);
    return () => clearInterval(iv);
  }, [isAuthenticated, previewStatus, previewEndsAt, applyAccessPayload]);

  const handleChannelCodeSuccess = useCallback((data: Record<string, unknown>) => {
    accessRequestGen.current += 1;
    setShowChannelCode(false);
    applyAccessPayload(data);
    setAccessChecked(true);
  }, [applyAccessPayload]);

  const handleSetStudyGroup = useCallback(async (group: string) => {
    const tgId    = localStorage.getItem('user_tg_id');
    const initDat = (window as any).Telegram?.WebApp?.initData || '';
    if (!tgId) return;
    setGroupSaving(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramId: tgId,
          mode: 'set_study_group',
          studyGroup: group,
          initData: initDat,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Ошибка', description: data.error || 'Не удалось сохранить группу' });
        return;
      }
      accessRequestGen.current += 1;
      applyAccessPayload(data);
    } catch {
      toast({ variant: 'destructive', title: 'Ошибка', description: 'Проблемы с соединением' });
    } finally {
      setGroupSaving(false);
    }
  }, [applyAccessPayload, toast]);

  const handlePreviewPick = useCallback(async (subjectId: string, modules: string[]) => {
    const tgId    = localStorage.getItem('user_tg_id');
    const initDat = (window as any).Telegram?.WebApp?.initData || '';
    if (!tgId) return;
    setPreviewPicking(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramId: tgId,
          mode: 'pick_preview_subject',
          subjectId,
          modules,
          initData: initDat,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Ошибка', description: data.error || 'Не удалось сохранить выбор' });
        return;
      }
      localStorage.setItem('is_authed', 'true');
      localStorage.setItem('subject_chosen', 'true');
      accessRequestGen.current += 1;
      applyAccessPayload(data);
      if (data.facultyRecorded) {
        toast({ title: 'Готово', description: 'Факультет сохранён — можно продолжать' });
      } else {
        toast({ title: 'Доступ открыт', description: 'Можно начинать' });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Ошибка', description: 'Проблемы с соединением' });
    } finally {
      setPreviewPicking(false);
    }
  }, [applyAccessPayload, toast]);

  const handleCheckPreviewStatus = useCallback(async () => {
    const tgId    = localStorage.getItem('user_tg_id');
    const initDat = (window as any).Telegram?.WebApp?.initData || '';
    if (!tgId) return;
    setStatusChecking(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramId: tgId, mode: 'check_preview_status', initData: initDat }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Статус', description: data.error || 'Заявка не найдена' });
        return;
      }
      if (data.previewStatus === 'confirmed') {
        localStorage.setItem('is_authed', 'true');
        applyAccessPayload(data);
        toast({ title: 'Доступ открыт', description: 'Можно продолжать обучение' });
      } else {
        applyAccessPayload(data);
      }
    } catch {
      toast({ variant: 'destructive', title: 'Ошибка', description: 'Проблемы с соединением' });
    } finally {
      setStatusChecking(false);
    }
  }, [applyAccessPayload, toast]);

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

  if (showChannelCode) {
    return (
      <ChannelCodeEntryScreen
        onSuccess={handleChannelCodeSuccess}
        onCancel={() => setShowChannelCode(false)}
      />
    );
  }

  if (!accessChecked && previewStatus !== 'expired') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (previewStatus === 'selecting' && needsStudyGroup) {
    return (
      <PreviewGroupScreen
        loading={groupSaving}
        onSubmit={handleSetStudyGroup}
      />
    );
  }

  if (previewStatus === 'selecting') {
    if (!accessChecked || subjectCatalog.length === 0) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-background">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      );
    }
    return (
      <PreviewOnboardingScreen
        subjectCatalog={subjectCatalog}
        loading={previewPicking}
        onConfirm={handlePreviewPick}
      />
    );
  }

  if (previewStatus === 'expired' && availableSubjects.length === 0) {
    return (
      <PreviewAwaitingScreen
        chosenSubject={previewChosen}
        chosenModules={previewModules}
        checking={statusChecking}
        onCheckStatus={handleCheckPreviewStatus}
      />
    );
  }

  if (availableSubjects.length === 0 && previewStatus !== 'active') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-6">
        <div className="max-w-sm text-center space-y-4">
          <div className="text-5xl">🔒</div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--c-text)' }}>
            Доступ пока не открыт
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--c-muted)' }}>
            Войди заново ключом или кодом из канала. Если уже оплатил — напиши админу, он откроет доступ.
          </p>
          <button
            type="button"
            onClick={() => refreshAccess()}
            className="w-full h-12 rounded-2xl text-sm font-semibold"
            style={{ background: 'var(--c-primary)', color: 'var(--c-bg)' }}
          >
            Обновить
          </button>
          <button
            type="button"
            onClick={logoutLocal}
            className="w-full h-12 rounded-2xl text-sm font-semibold"
            style={{ background: 'var(--c-card)', color: 'var(--c-text)', border: '1px solid var(--c-border)' }}
          >
            Войти заново
          </button>
        </div>
      </div>
    );
  }

  // ── Экран выбора дисциплины (только когда открыто 2+ и юзер ещё не выбирал) ──
  if (showSubjectSelect) {
    return (
      <SubjectSelectScreen
        availableSubjects={availableSubjects}
        onBrowseCatalog={() => setShowChannelCode(true)}
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
            onBrowseCatalog={() => setShowChannelCode(true)}
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