"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { SubjectSelectScreen } from '@/components/SubjectSelectScreen';
import { PreviewOnboardingScreen } from '@/components/PreviewOnboardingScreen';
import { PreviewGroupScreen } from '@/components/PreviewGroupScreen';
import { PreviewPaymentTabPanel } from '@/components/PreviewPaymentTabPanel';
import { TrustAccessNotice } from '@/components/TrustAccessNotice';
import { ChannelCodeEntryScreen } from '@/components/ChannelCodeEntryScreen';
import { AccessWelcomeOverlay, PREVIEW_AWAITING_CONFIRM_KEY } from '@/components/AccessWelcomeOverlay';
import { AuthScreen }    from '@/components/AuthScreen';
import { Navigation, TabType, type BioGameMode } from '@/components/Navigation';
import { QuestionsTab }  from '@/components/QuestionsTab';
import { TestsTab }      from '@/components/TestsTab';
import { TasksTab }      from '@/components/TasksTab';
import { StatsTab }      from '@/components/StatsTab';
import { Loader2 }       from 'lucide-react';
import { useToast }      from '@/hooks/use-toast';
import { applyClientAccessCacheVersion, clearPreviewClientKeys } from '@/lib/accessCache';
import { getDefaultSubjectId, subjectHasQuestionGameModes } from '@/lib/subjects';
import { bustSubjectModuleCache, setOnSubjectDataUnavailable } from '@/lib/subjectData';
import {
  getPreviewRealWindowMs,
  getPreviewSyncIntervalMs,
  isPreviewShortDurationAccount,
  type PreviewActiveMsMap,
  type PreviewStatus,
} from '@/lib/preview';
import { firstPreviewModuleTab, normalizePreviewModules, type PreviewModule } from '@/lib/previewModules';
import {
  type PreviewModuleStatus,
  type PreviewModuleStatusMap,
  moduleShowsContent,
  moduleShowsPaymentEmbed,
  modulesAwaitingPayment,
  shouldBustPaymentFlowCache,
} from '@/lib/previewModuleStatus';
import type { SubjectCatalogEntry } from '@/lib/subjectCatalog';
import { persistFacultyId, USER_FACULTY_ID_KEY } from '@/lib/facultyCodes';

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
  'has_micro', 'preview_end', 'preview_start', 'last_subject', 'welcome_seen',
  PREVIEW_AWAITING_CONFIRM_KEY,
  USER_FACULTY_ID_KEY,
];

function clearLocalSession() {
  AUTH_STORAGE_KEYS.forEach(k => localStorage.removeItem(k));
}

function getTgId(): string | null {
  const fromLs = localStorage.getItem('user_tg_id');
  if (fromLs) return fromLs.trim();
  const fromTg = (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id;
  return fromTg != null ? String(fromTg).trim() : null;
}

function resolvePreviewEndIso(
  endsAt: string | null,
  startedAt: string | null,
  tgId: string | null,
): string | null {
  const id = tgId || getTgId();
  const started = startedAt || localStorage.getItem('preview_start');
  if (started && id) {
    const fromStart = Date.parse(started) + getPreviewRealWindowMs(id);
    if (endsAt) {
      return new Date(Math.min(Date.parse(endsAt), fromStart)).toISOString();
    }
    return new Date(fromStart).toISOString();
  }
  return endsAt || localStorage.getItem('preview_end');
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
  const [bioQuestionsSection, setBioQuestionsSection] = useState<BioGameMode>('list');
  const [testMode,        setTestMode]        = useState<boolean>(false);
  const [previewStatus,   setPreviewStatus]   = useState<PreviewStatus | null>(null);
  const [pickSubjects,    setPickSubjects]     = useState<string[]>([]);
  const [previewChosen,   setPreviewChosen]    = useState<string | null>(null);
  const [previewModules,  setPreviewModules]     = useState<string[]>([]);
  const [groupSaving,     setGroupSaving]       = useState<boolean>(false);
  const [showChannelCode, setShowChannelCode]   = useState<boolean>(false);
  const [catalogBrowseLoading, setCatalogBrowseLoading] = useState(false);
  const [subjectCatalog,  setSubjectCatalog]   = useState<SubjectCatalogEntry[]>([]);
  const [catalogGrantedSubjects, setCatalogGrantedSubjects] = useState<string[]>([]);
  const [previewEndsAt,   setPreviewEndsAt]    = useState<string | null>(null);
  const [previewStartedAt, setPreviewStartedAt] = useState<string | null>(null);
  const [previewPicking,  setPreviewPicking]   = useState<boolean>(false);
  const [statusChecking,  setStatusChecking]  = useState<boolean>(false);
  const [previewQuotedPrice, setPreviewQuotedPrice] = useState<number | null>(null);
  const [receiptClaimedAt, setReceiptClaimedAt] = useState<string | null>(null);
  const [previewConfirmedAt, setPreviewConfirmedAt] = useState<string | null>(null);
  const [canReturnToPurchased, setCanReturnToPurchased] = useState(false);
  const [canAbandonPending, setCanAbandonPending] = useState(false);
  const [previewGrantedModules, setPreviewGrantedModules] = useState<string[]>([]);
  const [paymentGrantedSubjects, setPaymentGrantedSubjects] = useState<string[]>([]);
  const [abandonPreviewBusy, setAbandonPreviewBusy] = useState(false);
  const [paymentModulesUpdating, setPaymentModulesUpdating] = useState(false);
  const [showAccessWelcome, setShowAccessWelcome] = useState(false);
  const [accessChecked,   setAccessChecked]   = useState<boolean>(false);
  const [previewModuleStatuses, setPreviewModuleStatuses] = useState<PreviewModuleStatusMap>({});
  const [previewRemainingMinByModule, setPreviewRemainingMinByModule] = useState<PreviewActiveMsMap>({});
  const [previewRemainingMsByModule, setPreviewRemainingMsByModule] = useState<PreviewActiveMsMap>({});
  const [previewModuleTrustExpiresAt, setPreviewModuleTrustExpiresAt] = useState<Record<string, string>>({});
  const [trustNoticeDismissed, setTrustNoticeDismissed] = useState(false);
  const [pendingPaymentSubject, setPendingPaymentSubject] = useState<string | null>(null);
  const [serviceDegraded, setServiceDegraded] = useState(false);
  const [showGroupForReceipt, setShowGroupForReceipt] = useState(false);
  const [retryClaimAfterGroup, setRetryClaimAfterGroup] = useState<PreviewModule[] | null>(null);
  const pendingReceiptModulesRef = useRef<PreviewModule[] | null>(null);
  const previewActiveDeltaRef = useRef(0);
  const previewSyncBusyRef    = useRef(false);
  const { toast }    = useToast();

  const PENDING_PAYMENT_SUBJECT_KEY = 'pending_payment_subject';

  const tabToModule = useCallback((tab: TabType): PreviewModule | null => {
    if (tab === 'questions') return 'questions';
    if (tab === 'tests') return 'tests';
    if (tab === 'tasks') return 'tasks';
    return null;
  }, []);

  const handleNavTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab);
    if (tab === 'questions') setBioQuestionsSection('list');
  }, []);

  const handlePaymentNavigateModule = useCallback((mod: PreviewModule) => {
    const tab: TabType = mod;
    handleNavTabChange(tab);
  }, [handleNavTabChange]);

  const handleBioModeCycle = useCallback(() => {
    setActiveTab('questions');
    setBioQuestionsSection(prev => {
      if (prev === 'list') return 'flashcards';
      if (prev === 'flashcards') return 'true_false';
      return 'list';
    });
  }, []);

  useEffect(() => {
    if (!subjectHasQuestionGameModes(subject)) setBioQuestionsSection('list');
  }, [subject]);

  const triggerAccessWelcomeIfPending = useCallback(() => {
    if (localStorage.getItem(PREVIEW_AWAITING_CONFIRM_KEY) === '1') {
      setShowAccessWelcome(true);
    }
  }, []);

  /** Поздний ответ check_subjects не должен затирать свежий ответ после кода/группы. */
  const accessRequestGen = useRef(0);
  const previewPollGen   = useRef(0);

  const PREVIEW_ADMIN_POLL_MS = 5_000;

  const logoutLocal = useCallback(() => {
    clearLocalSession();
    setIsAuthenticated(false);
    setAccessChecked(false);
    setAvailableSubjects([]);
    setPreviewStatus(null);
    setShowSubjectSelect(false);
  }, []);

  const applyAccessPayload = useCallback((d: any) => {
    if (d?.accessHealed === true || (
      typeof d?.accessCacheVersion === 'number'
      && d.accessCacheVersion > Number(localStorage.getItem('access_cache_v') || '0')
    )) {
      clearPreviewClientKeys();
      if (typeof d?.accessCacheVersion === 'number') {
        localStorage.setItem('access_cache_v', String(d.accessCacheVersion));
      }
    }
    if (d?.degraded === true) {
      try {
        const cached = JSON.parse(localStorage.getItem('available_subjects') || '[]');
        if (Array.isArray(cached) && cached.length) {
          setAvailableSubjects(cached);
          setHasMicro(cached.includes('micro'));
        }
      } catch { /* оставляем текущее состояние */ }
      setServiceDegraded(true);
      return;
    }
    setServiceDegraded(false);
    const pendingSubjectEarly = d?.previewChosenSubject as string | null | undefined;
    let list: string[] = Array.isArray(d?.subjects) ? d.subjects : [];
    if (
      list.length === 0
      && pendingSubjectEarly
      && (d?.accessGranted === true || d?.previewConfirmedAt)
    ) {
      list = [pendingSubjectEarly];
    }
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
    setPreviewEndsAt(d?.previewEndsAt ?? null);
    setPreviewStartedAt(d?.previewStartedAt ?? null);
    setPreviewQuotedPrice(typeof d?.previewQuotedPrice === 'number' ? d.previewQuotedPrice : null);
    setReceiptClaimedAt(d?.receiptClaimedAt ?? null);
    setPreviewConfirmedAt(d?.previewConfirmedAt ?? null);
    setCanReturnToPurchased(d?.canReturnToPurchasedAccess === true);
    setCanAbandonPending(d?.canAbandonPendingPreview === true);
    setPreviewGrantedModules(
      Array.isArray(d?.previewGrantedModules) ? d.previewGrantedModules : [],
    );
    setPaymentGrantedSubjects(
      Array.isArray(d?.paymentGrantedSubjects) ? d.paymentGrantedSubjects : [],
    );
    if (d?.previewRemainingMinByModule && typeof d.previewRemainingMinByModule === 'object') {
      setPreviewRemainingMinByModule(d.previewRemainingMinByModule as PreviewActiveMsMap);
    } else if (ps !== 'active') {
      setPreviewRemainingMinByModule({});
    }
    if (d?.previewRemainingMsByModule && typeof d.previewRemainingMsByModule === 'object') {
      setPreviewRemainingMsByModule(d.previewRemainingMsByModule as PreviewActiveMsMap);
    } else if (ps !== 'active') {
      setPreviewRemainingMsByModule({});
    }
    if (d?.previewModuleTrustExpiresAt && typeof d.previewModuleTrustExpiresAt === 'object') {
      setPreviewModuleTrustExpiresAt(d.previewModuleTrustExpiresAt as Record<string, string>);
    } else if (!d?.receiptClaimedAt) {
      setPreviewModuleTrustExpiresAt({});
    }
    if (d?.previewModuleStatuses && typeof d.previewModuleStatuses === 'object') {
      const nextStatuses = d.previewModuleStatuses as PreviewModuleStatusMap;
      const remMsMap = d?.previewRemainingMsByModule as PreviewActiveMsMap | undefined;
      setPreviewModuleStatuses(prev => {
        const merged: PreviewModuleStatusMap = { ...nextStatuses };
        for (const m of ['questions', 'tests', 'tasks'] as PreviewModule[]) {
          if (prev[m] === 'awaiting_payment' && merged[m] === 'trial') {
            const rem = remMsMap?.[m];
            if (rem == null || rem <= 0) merged[m] = 'awaiting_payment';
          }
        }
        const subjectId = (d?.previewChosenSubject as string | null) ?? null;
        if (subjectId) {
          const rejected: PreviewModule[] = (['questions', 'tests', 'tasks'] as PreviewModule[]).filter(
            m => merged[m] === 'rejected' && prev[m] !== 'rejected',
          );
          if (rejected.length > 0) {
            void bustSubjectModuleCache(subjectId, rejected);
            if (rejected.some(m => m === 'questions' || m === 'tests' || m === 'tasks')) {
              void bustSubjectModuleCache(subjectId, ['glossary']);
            }
          }
        }
        return merged;
      });
    } else if (ps !== 'expired' && ps !== 'active' && !d?.receiptClaimedAt) {
      setPreviewModuleStatuses({});
    }

    if (pendingSubjectEarly && (ps === 'expired' || ps === 'active' || d?.receiptClaimedAt)) {
      const psid = String(pendingSubjectEarly);
      localStorage.setItem(PENDING_PAYMENT_SUBJECT_KEY, psid);
      setPendingPaymentSubject(psid);
    }
    if (d?.previewConfirmedAt || d?.previewStatus === 'confirmed') {
      localStorage.removeItem(PENDING_PAYMENT_SUBJECT_KEY);
      setPendingPaymentSubject(null);
    }

    if (Array.isArray(d?.subjectCatalog)) setSubjectCatalog(d.subjectCatalog);
    if (Array.isArray(d?.catalogGrantedSubjects)) {
      setCatalogGrantedSubjects(d.catalogGrantedSubjects);
    } else if (ps !== 'selecting') {
      setCatalogGrantedSubjects([]);
    }
    if (Array.isArray(d?.pickSubjects)) setPickSubjects(d.pickSubjects);

    if (d?.facultyId) persistFacultyId(String(d.facultyId));

    if (ps === 'active') {
      const endIso = resolvePreviewEndIso(d?.previewEndsAt ?? null, d?.previewStartedAt ?? null, getTgId());
      if (endIso) localStorage.setItem('preview_end', endIso);
      else localStorage.removeItem('preview_end');
      if (d?.previewStartedAt) localStorage.setItem('preview_start', d.previewStartedAt);
      else localStorage.removeItem('preview_start');
    } else {
      localStorage.removeItem('preview_end');
      localStorage.removeItem('preview_start');
    }

    const pendingSubject = d?.previewChosenSubject as string | null | undefined;
    const wasAwaitingConfirm = localStorage.getItem(PREVIEW_AWAITING_CONFIRM_KEY) === '1';
    const accessJustOpened = wasAwaitingConfirm
      && !!pendingSubject
      && list.includes(pendingSubject)
      && ps !== 'active'
      && ps !== 'expired'
      && ps !== 'selecting';

    if (
      pendingSubject
      && (ps === 'active' || ps === 'expired' || (d?.receiptClaimedAt && !d?.previewConfirmedAt))
    ) {
      localStorage.setItem(PREVIEW_AWAITING_CONFIRM_KEY, '1');
    }

    const receiptAccessOpened = !!d?.previewConfirmedAt
      && !!pendingSubject
      && list.includes(pendingSubject)
      && ps !== 'active'
      && ps !== 'expired'
      && ps !== 'selecting';

    if (receiptAccessOpened || accessJustOpened || ps === 'confirmed') {
      triggerAccessWelcomeIfPending();
      if ((receiptAccessOpened || accessJustOpened) && pendingSubject) {
        setSubjectRaw(pendingSubject);
        localStorage.setItem('last_subject', pendingSubject);
        localStorage.setItem('subject_chosen', 'true');
      }
    }

    const savedSubject = localStorage.getItem('last_subject');
    const userKeptOtherSubject = (previewId: string) =>
      !!savedSubject && list.includes(savedSubject) && savedSubject !== previewId;

    if (ps === 'active' && pendingSubject) {
      if (!userKeptOtherSubject(pendingSubject)) {
        setSubjectRaw(pendingSubject);
        localStorage.setItem('last_subject', pendingSubject);
        localStorage.setItem('subject_chosen', 'true');
      }
    }

    if (ps === 'expired') {
      localStorage.removeItem('preview_end');
      localStorage.removeItem('preview_start');
      const pending = d?.previewChosenSubject as string | null | undefined;
      if (pending && (!list.includes(pending) || !userKeptOtherSubject(pending))) {
        setSubjectRaw(pending);
        localStorage.setItem('last_subject', pending);
        localStorage.setItem('subject_chosen', 'true');
      }
    }

    if (ps === 'selecting') return;

    if (list.length === 0) return;

    /** Докупка: предмет пробы ещё не в купленных — не уводить на старый предмет после таймера/sync. */
    const isCatalogAddonPreview = !!pendingSubject && !list.includes(pendingSubject);
    if (
      isCatalogAddonPreview
      && (ps === 'active' || ps === 'expired' || (d?.receiptClaimedAt && !d?.previewConfirmedAt))
    ) {
      setShowSubjectSelect(false);
      localStorage.setItem('subject_chosen', 'true');
      localStorage.setItem('last_subject', pendingSubject);
      setSubjectRaw(pendingSubject);
      return;
    }

    const alreadyChosen = localStorage.getItem('subject_chosen') === 'true';
    const preferred = (savedSubject && list.includes(savedSubject)) ? savedSubject : list[0];

    if (!alreadyChosen && list.length >= 2 && ps !== 'active' && ps !== 'confirmed') {
      setShowSubjectSelect(true);
      return;
    }

    setShowSubjectSelect(false);
    localStorage.setItem('subject_chosen', 'true');
    setSubjectRaw(current => {
      if (savedSubject && list.includes(savedSubject)) {
        return savedSubject;
      }
      const next = list.includes(current) ? current : preferred;
      localStorage.setItem('last_subject', next);
      return next;
    });
  }, [setSubjectRaw, triggerAccessWelcomeIfPending]);

  const pollAccessForAdminConfirm = useCallback(async () => {
    if (typeof document !== 'undefined' && document.hidden) return;
    if (localStorage.getItem(PREVIEW_AWAITING_CONFIRM_KEY) !== '1') return;

    const tgId    = localStorage.getItem('user_tg_id');
    const initDat = (window as any).Telegram?.WebApp?.initData || '';
    if (!tgId || !initDat) return;

    const gen = ++previewPollGen.current;
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramId: tgId, mode: 'check_subjects', initData: initDat }),
      });
      const d = await res.json();
      if (gen !== previewPollGen.current) return;
      if (res.status === 403 && d.needSubscription) {
        logoutLocal();
        return;
      }
      if (d.registered === false) {
        logoutLocal();
        return;
      }
      applyAccessPayload(d);
    } catch { /* сеть — повторим на следующем интервале */ }
  }, [applyAccessPayload, logoutLocal]);

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
        if (d.degraded === true) {
          applyAccessPayload(d);
          return;
        }
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

  const dismissAccessWelcome = useCallback(() => {
    setShowAccessWelcome(false);
    localStorage.removeItem(PREVIEW_AWAITING_CONFIRM_KEY);
    void refreshAccess();
  }, [refreshAccess]);

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

  useEffect(() => {
    setOnSubjectDataUnavailable(() => setServiceDegraded(true));
    return () => setOnSubjectDataUnavailable(null);
  }, []);

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
        if (d.degraded === true) {
          applyAccessPayload(d);
          setAccessChecked(true);
          return;
        }
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
    applyClientAccessCacheVersion();
    const saved = localStorage.getItem('last_subject');
    if (saved) setSubjectRaw(saved);
    const pending = localStorage.getItem(PENDING_PAYMENT_SUBJECT_KEY);
    if (pending) setPendingPaymentSubject(pending);
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

  // ── Активный таймер пробы: sync с API (тест — каждую сек, остальные — раз в минуту) ──
  const syncPreviewActive = useCallback(async (force = false) => {
    const delta = previewActiveDeltaRef.current;
    const tgId = getTgId();
    const syncIntervalMs = getPreviewSyncIntervalMs(tgId);
    if (!force && delta < syncIntervalMs) return;
    if (previewSyncBusyRef.current) return;
    const initDat = (window as any).Telegram?.WebApp?.initData || '';
    const testAccount = isPreviewShortDurationAccount(tgId);
    if (!tgId || (!initDat && !testAccount)) return;
    const activeModule = tabToModule(activeTab);
    previewSyncBusyRef.current = true;
    previewActiveDeltaRef.current = 0;
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramId: tgId,
          mode: 'sync_preview_active',
          deltaMs: delta,
          module: activeModule,
          initData: initDat,
        }),
      });
      const d = await res.json();
      if (res.ok) applyAccessPayload(d);
    } catch { /* повторим позже */ }
    finally { previewSyncBusyRef.current = false; }
  }, [applyAccessPayload, activeTab, tabToModule]);

  useEffect(() => {
    if (!isAuthenticated || previewStatus !== 'active') return;
    const chosen = normalizePreviewModules(previewModules);
    if (chosen.length === 0) return;

    const tgId = getTgId();
    const syncIntervalMs = getPreviewSyncIntervalMs(tgId);
    const testAccount = isPreviewShortDurationAccount(tgId);

    let last = Date.now();
    const isActiveNow = () => {
      if (!testAccount && typeof document !== 'undefined' && document.hidden) return false;
      const mod = tabToModule(activeTab);
      return mod != null && chosen.includes(mod);
    };

    const tick = () => {
      const now = Date.now();
      if (isActiveNow()) {
        previewActiveDeltaRef.current += now - last;
      }
      last = now;
      void syncPreviewActive(true);
    };

    tick();
    const iv = setInterval(tick, syncIntervalMs);

    const onVisible = () => {
      if (document.visibilityState === 'hidden') void syncPreviewActive(true);
      else last = Date.now();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(iv);
      document.removeEventListener('visibilitychange', onVisible);
      void syncPreviewActive(true);
    };
  }, [isAuthenticated, previewStatus, previewModules, activeTab, tabToModule, syncPreviewActive]);

  // Опрос: админ подтвердил до конца пробы — сразу приветствие и доступ (вкладка видима)
  useEffect(() => {
    if (!isAuthenticated) return;
    if (previewConfirmedAt) return;
    if (previewStatus !== 'active' && previewStatus !== 'expired' && !receiptClaimedAt) return;

    const awaitingAdmin = () =>
      localStorage.getItem(PREVIEW_AWAITING_CONFIRM_KEY) === '1';
    if (!awaitingAdmin()) return;

    const tick = () => {
      if (awaitingAdmin()) void pollAccessForAdminConfirm();
    };

    tick();

    const iv = setInterval(tick, PREVIEW_ADMIN_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(iv);
      document.removeEventListener('visibilitychange', onVisible);
      previewPollGen.current += 1;
    };
  }, [isAuthenticated, previewStatus, previewConfirmedAt, receiptClaimedAt, pollAccessForAdminConfirm]);

  const handleChannelCodeSuccess = useCallback((data: Record<string, unknown>) => {
    accessRequestGen.current += 1;
    setShowChannelCode(false);
    setShowSubjectSelect(false);
    applyAccessPayload(data);
    setAccessChecked(true);
    if (data.alreadyConfirmed) {
      toast({
        title: 'Доступ уже открыт',
        description: 'Код факультета сохранён — продолжай в приложении.',
      });
    }
  }, [applyAccessPayload, toast]);

  const hasFinalizedFromPayload = (d: any) =>
    !!d?.previewConfirmedAt && !d?.previewStatus;

  const handleCheckPaymentStatus = useCallback(async () => {
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
      if (res.ok) {
        accessRequestGen.current += 1;
        applyAccessPayload(data);
        setAccessChecked(true);
        if (data.previewConfirmedAt || data.previewStatus === 'confirmed' || hasFinalizedFromPayload(data)) {
          toast({ title: 'Доступ открыт', description: 'Админ подтвердил оплату — можно пользоваться.' });
        } else if (data.receiptClaimedAt || data.awaitingAdmin) {
          toast({ title: 'Заявка на проверке', description: 'Админ ещё не подтвердил — напиши в Telegram, если ждёшь долго.' });
        } else {
          toast({ title: 'Статус обновлён', description: 'Данные синхронизированы с сервером.' });
        }
      } else {
        toast({ variant: 'destructive', title: 'Статус', description: data.error || 'Заявка не найдена' });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Ошибка', description: 'Проблемы с соединением' });
    } finally {
      setStatusChecking(false);
    }
  }, [applyAccessPayload, toast]);

  const handleBrowseCatalog = useCallback(async () => {
    const tgId    = localStorage.getItem('user_tg_id');
    const initDat = (window as any).Telegram?.WebApp?.initData || '';
    if (!tgId) return;
    if (previewStatus === 'active' && paymentGrantedSubjects.length > 0) {
      toast({
        title: 'Проба идёт',
        description: 'Переключись на купленный предмет в «Мои предметы» или дождись окончания пробы.',
      });
    }
    setCatalogBrowseLoading(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramId: tgId,
          mode: 'start_catalog_browse',
          initData: initDat,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.needsFacultyCode) {
          setShowChannelCode(true);
          return;
        }
        toast({
          variant: 'destructive',
          title: 'Каталог',
          description: data.error || 'Не удалось открыть каталог',
        });
        return;
      }
      accessRequestGen.current += 1;
      setShowChannelCode(false);
      applyAccessPayload(data);
      setAccessChecked(true);
    } catch {
      toast({ variant: 'destructive', title: 'Ошибка', description: 'Проблемы с соединением' });
    } finally {
      setCatalogBrowseLoading(false);
    }
  }, [applyAccessPayload, toast, previewStatus, paymentGrantedSubjects]);

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
      if (pendingReceiptModulesRef.current?.length) {
        setRetryClaimAfterGroup([...pendingReceiptModulesRef.current]);
        pendingReceiptModulesRef.current = null;
        setShowGroupForReceipt(false);
      }
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
      localStorage.setItem('last_subject', subjectId);
      accessRequestGen.current += 1;
      setSubjectRaw(subjectId);
      const entryTab = firstPreviewModuleTab(modules);
      if (entryTab) setActiveTab(entryTab);
      setAccessChecked(true);
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

  const handleUpdatePaymentModules = useCallback(async (modules: PreviewModule[]) => {
    const tgId    = localStorage.getItem('user_tg_id');
    const initDat = (window as any).Telegram?.WebApp?.initData || '';
    if (!tgId || modules.length === 0) return;
    setPaymentModulesUpdating(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramId: tgId,
          mode: 'update_preview_payment_choice',
          modules,
          initData: initDat,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          variant: 'destructive',
          title: 'Ошибка',
          description: data.error || 'Не удалось обновить выбор',
        });
        return;
      }
      applyAccessPayload(data);
    } catch {
      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description: 'Проблемы с соединением',
      });
    } finally {
      setPaymentModulesUpdating(false);
    }
  }, [applyAccessPayload, toast]);

  const handleClaimReceipt = useCallback(async (modules: PreviewModule[]) => {
    const tgId    = localStorage.getItem('user_tg_id');
    const initDat = (window as any).Telegram?.WebApp?.initData || '';
    if (!tgId || modules.length === 0) return;
    setStatusChecking(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramId: tgId,
          mode: 'claim_preview_receipt',
          modules,
          initData: initDat,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.needsStudyGroup) {
          pendingReceiptModulesRef.current = modules;
          setShowGroupForReceipt(true);
          return;
        }
        toast({
          variant: 'destructive',
          title: 'Ошибка',
          description: data.error || 'Не удалось сохранить. Попробуй ещё раз.',
        });
        return;
      }
      localStorage.setItem(PREVIEW_AWAITING_CONFIRM_KEY, '1');
      localStorage.setItem('is_authed', 'true');
      applyAccessPayload(data);
      const grantedSubject = (data.previewChosenSubject as string | null) ?? previewChosen;
      if (grantedSubject) {
        setSubjectRaw(grantedSubject);
        localStorage.setItem('last_subject', grantedSubject);
        localStorage.setItem('subject_chosen', 'true');
        localStorage.setItem(PENDING_PAYMENT_SUBJECT_KEY, grantedSubject);
      }
      const entryTab = firstPreviewModuleTab(modules);
      if (entryTab) setActiveTab(entryTab);
      previewPollGen.current += 1;
      setAccessChecked(true);
      setTrustNoticeDismissed(false);
    } catch {
      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description: 'Проблемы с соединением. Проверь интернет и попробуй снова.',
      });
    } finally {
      setStatusChecking(false);
    }
  }, [applyAccessPayload, previewChosen, toast]);

  useEffect(() => {
    if (!retryClaimAfterGroup?.length) return;
    const mods = retryClaimAfterGroup;
    setRetryClaimAfterGroup(null);
    void handleClaimReceipt(mods);
  }, [retryClaimAfterGroup, handleClaimReceipt]);

  const handleAbandonPendingPreview = useCallback(async (switchTo?: string) => {
    const tgId    = localStorage.getItem('user_tg_id');
    const initDat = (window as any).Telegram?.WebApp?.initData || '';
    if (!tgId) return false;
    setAbandonPreviewBusy(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramId: tgId,
          mode: 'abandon_pending_preview',
          initData: initDat,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          variant: 'destructive',
          title: 'Ошибка',
          description: data.error || 'Не удалось вернуться к купленному.',
        });
        return false;
      }
      localStorage.removeItem(PREVIEW_AWAITING_CONFIRM_KEY);
      accessRequestGen.current += 1;
      applyAccessPayload(data);
      const list = Array.isArray(data.subjects) ? data.subjects as string[] : [];
      const target = switchTo && list.includes(switchTo)
        ? switchTo
        : list.find(s => s !== previewChosen) ?? list[0];
      if (target && list.includes(target)) {
        setSubjectRaw(target);
        localStorage.setItem('last_subject', target);
        localStorage.setItem('subject_chosen', 'true');
        const hidden = (data.navHidden as Record<string, string[]> | undefined)?.[target] || [];
        const tabOrder: TabType[] = ['questions', 'tests', 'tasks', 'stats'];
        const firstOpen = tabOrder.find(t => t === 'stats' || !hidden.includes(t));
        if (firstOpen) setActiveTab(firstOpen);
      }
      return true;
    } catch {
      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description: 'Проблемы с соединением. Попробуй ещё раз.',
      });
      return false;
    } finally {
      setAbandonPreviewBusy(false);
    }
  }, [applyAccessPayload, previewChosen, setSubjectRaw, toast]);

  const handleReturnToPurchased = useCallback(async () => {
    const ok = await handleAbandonPendingPreview();
    if (ok) {
      toast({ title: 'Докупка отменена', description: 'Открыты только ранее купленные разделы.' });
    }
  }, [handleAbandonPendingPreview, toast]);

  const handleBackFromPendingPreview = useCallback(async () => {
    const pending = previewChosen;
    const others = availableSubjects.filter(s => s !== pending);
    const next = others[0];
    if (!next) return;
    if (canAbandonPending) {
      const ok = await handleAbandonPendingPreview(next);
      if (ok) {
        toast({ title: 'Докупка отменена', description: 'Вернулся к уже открытым предметам.' });
      }
      return;
    }
    toast({
      variant: 'destructive',
      title: 'Сначала оплата',
      description: 'Заверши оплату на этом предмете.',
    });
  }, [availableSubjects, previewChosen, canAbandonPending, handleAbandonPendingPreview, toast]);

  const chosenPreviewModules = useMemo(
    () => normalizePreviewModules(previewModules),
    [previewModules],
  );

  const modulesNeedingPayment = useMemo(() => {
    const fromServer = modulesAwaitingPayment(previewModuleStatuses);
    if (previewStatus !== 'active') return fromServer;
    const localExpired = chosenPreviewModules.filter(mod => {
      if (fromServer.includes(mod)) return false;
      const rem = previewRemainingMsByModule[mod];
      return rem != null && rem <= 0;
    });
    return localExpired.length > 0 ? [...new Set([...fromServer, ...localExpired])] : fromServer;
  }, [previewModuleStatuses, previewStatus, chosenPreviewModules, previewRemainingMsByModule]);

  const inPendingPaymentFlow = !!previewChosen && (
    previewStatus === 'expired'
    || modulesNeedingPayment.length > 0
    || (!!receiptClaimedAt && !previewConfirmedAt)
  );

  /** Не новый гость: до пробы уже были купленные предметы (докупка). */
  const isEstablishedForStats = paymentGrantedSubjects.length > 0;

  /** Проба/оплата на предмете — нельзя уйти в другой предмет без явной отмены докупки. */
  const previewSubjectLocked = !!previewChosen && (
    inPendingPaymentFlow
    || (previewStatus === 'active' && !receiptClaimedAt && !previewConfirmedAt)
  );

  const statsAvailableSubjects = useMemo(() => {
    if (!previewChosen) return availableSubjects;
    if (previewSubjectLocked) {
      if (isEstablishedForStats && canAbandonPending) {
        return [...new Set([previewChosen, ...paymentGrantedSubjects])];
      }
      return [previewChosen];
    }
    if (isEstablishedForStats) {
      return [...new Set([...paymentGrantedSubjects, ...availableSubjects, previewChosen])];
    }
    if (previewChosen && !availableSubjects.includes(previewChosen)) {
      return [...availableSubjects, previewChosen];
    }
    return availableSubjects;
  }, [
    availableSubjects, previewChosen, previewSubjectLocked, isEstablishedForStats,
    paymentGrantedSubjects, canAbandonPending,
  ]);

  const handleSubjectChangeWithPending = useCallback((s: string) => {
    if (previewChosen && previewSubjectLocked && s !== previewChosen) {
      const switchingToPurchased = isEstablishedForStats && paymentGrantedSubjects.includes(s);
      if (switchingToPurchased && canAbandonPending) {
        void handleAbandonPendingPreview(s).then(ok => {
          if (ok) {
            toast({ title: 'Докупка отменена', description: 'Вернулся к уже открытым предметам.' });
          }
        });
        return;
      }
      toast({
        variant: 'destructive',
        title: 'Сначала оплата',
        description: 'Заверши пробу или оплату на этом предмете.',
      });
      return;
    }

    setSubject(s);
    localStorage.setItem('subject_chosen', 'true');
    if (pendingPaymentSubject && s === pendingPaymentSubject && previewChosen === s) {
      const unpaid = modulesAwaitingPayment(previewModuleStatuses);
      const localExpired = chosenPreviewModules.filter(mod => {
        if (unpaid.includes(mod)) return false;
        const rem = previewRemainingMsByModule[mod];
        return rem != null && rem <= 0;
      });
      const needing = [...new Set([...unpaid, ...localExpired])];
      const tabs = needing.length > 0 ? needing : normalizePreviewModules(previewModules);
      const first = firstPreviewModuleTab(tabs);
      if (first) setActiveTab(first);
    }
  }, [
    previewChosen, previewSubjectLocked, isEstablishedForStats, paymentGrantedSubjects,
    canAbandonPending, handleAbandonPendingPreview, pendingPaymentSubject,
    previewModuleStatuses, previewModules, chosenPreviewModules, previewRemainingMsByModule,
    setSubject, toast,
  ]);

  const grantedPreviewModules = useMemo(
    () => normalizePreviewModules(previewGrantedModules),
    [previewGrantedModules],
  );

  const resolveModuleStatus = useCallback((mod: PreviewModule): PreviewModuleStatus | undefined => {
    if (!previewChosen || !chosenPreviewModules.includes(mod)) return undefined;
    if (previewConfirmedAt) return 'confirmed';
    if (receiptClaimedAt && !previewConfirmedAt) return 'receipt_pending';

    const st = previewModuleStatuses[mod];
    if (st === 'awaiting_payment' || st === 'rejected' || st === 'confirmed' || st === 'receipt_pending') {
      return st;
    }

    if (previewStatus === 'expired') return 'awaiting_payment';

    if (previewStatus === 'active') {
      const remMs = previewRemainingMsByModule[mod];
      if (remMs != null && remMs <= 0) return 'awaiting_payment';
      return st || 'trial';
    }

    return st;
  }, [
    previewModuleStatuses, previewChosen, chosenPreviewModules,
    previewStatus, receiptClaimedAt, previewConfirmedAt, previewRemainingMsByModule,
  ]);

  const paymentModuleStatuses = useMemo(() => {
    const map: PreviewModuleStatusMap = {};
    for (const m of chosenPreviewModules) {
      const st = resolveModuleStatus(m);
      if (st) map[m] = st;
    }
    return map;
  }, [chosenPreviewModules, resolveModuleStatus]);

  const paymentFlowCacheBust = useMemo(
    () => shouldBustPaymentFlowCache(subject, previewChosen, previewModuleStatuses, previewStatus)
      || modulesNeedingPayment.length > 0,
    [
      subject, previewChosen, previewModuleStatuses, previewStatus,
      modulesNeedingPayment.length,
    ],
  );

  // Локальный отсчёт per-module + мгновенный sync при нуле (до ответа сервера — экран оплаты)
  useEffect(() => {
    if (!isAuthenticated || previewStatus !== 'active') return;
    const mod = tabToModule(activeTab);
    if (!mod || !chosenPreviewModules.includes(mod)) return;
    if (resolveModuleStatus(mod) !== 'trial') return;

    const iv = setInterval(() => {
      setPreviewRemainingMsByModule(prev => {
        const cur = prev[mod];
        if (cur == null || cur <= 0) return prev;
        const nextMs = Math.max(0, cur - 1000);
        const next = { ...prev, [mod]: nextMs };
        setPreviewRemainingMinByModule(m => ({
          ...m,
          [mod]: Math.max(0, Math.ceil(nextMs / 60_000)),
        }));
        if (nextMs === 0) void syncPreviewActive(true);
        return next;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [
    isAuthenticated, previewStatus, chosenPreviewModules, activeTab,
    tabToModule, resolveModuleStatus, syncPreviewActive,
  ]);

  // При смене вкладки — сразу sync (фиксируем время прошлого раздела)
  useEffect(() => {
    if (!isAuthenticated || previewStatus !== 'active') return;
    void syncPreviewActive(true);
  }, [activeTab, isAuthenticated, previewStatus, syncPreviewActive]);

  const paymentExitProps = useMemo(() => ({
    onBackToPurchased: canReturnToPurchased ? handleReturnToPurchased : undefined,
    onBackToAvailable: (canAbandonPending || availableSubjects.some(s => s !== previewChosen))
      ? handleBackFromPendingPreview
      : undefined,
    backBusy: abandonPreviewBusy,
  }), [
    canReturnToPurchased, handleReturnToPurchased, canAbandonPending,
    availableSubjects, previewChosen, handleBackFromPendingPreview, abandonPreviewBusy,
  ]);

  const renderModuleTab = useCallback((tab: TabType, content: React.ReactNode) => {
    if (!previewChosen || subject !== previewChosen) return content;
    const mod = tabToModule(tab);
    if (!mod || !chosenPreviewModules.includes(mod)) return content;

    const st = resolveModuleStatus(mod);
    if (st === 'awaiting_payment' || st === 'rejected') {
      return (
        <PreviewPaymentTabPanel
          subjectId={previewChosen}
          module={mod}
          chosenModules={chosenPreviewModules}
          grantedModules={grantedPreviewModules}
          moduleStatuses={paymentModuleStatuses}
          status={st}
          checking={statusChecking}
          modulesUpdating={paymentModulesUpdating}
          onUpdateModules={handleUpdatePaymentModules}
          onClaimReceipt={handleClaimReceipt}
          onNavigateModule={handlePaymentNavigateModule}
          {...paymentExitProps}
        />
      );
    }
    if (st === 'receipt_pending') return content;
    if (st === 'trial' || (!st && previewStatus === 'active')) return content;
    if (st && moduleShowsContent(st)) return content;
    return content;
  }, [
    previewChosen, subject, tabToModule, chosenPreviewModules, grantedPreviewModules,
    paymentModuleStatuses, resolveModuleStatus, previewStatus, statusChecking, paymentModulesUpdating,
    handleUpdatePaymentModules, handleClaimReceipt, handlePaymentNavigateModule, paymentExitProps,
  ]);

  const trustPendingModule = useMemo(() => {
    if (!previewChosen || subject !== previewChosen) return null;
    return chosenPreviewModules.find(m => resolveModuleStatus(m) === 'receipt_pending') ?? null;
  }, [previewChosen, subject, chosenPreviewModules, resolveModuleStatus]);

  const trustExpiresIso = trustPendingModule
    ? previewModuleTrustExpiresAt[trustPendingModule]
    : null;
  const trustNoticeVisible = !trustNoticeDismissed && !!trustPendingModule && !testMode;

  useEffect(() => {
    setTrustNoticeDismissed(false);
  }, [trustPendingModule, trustExpiresIso]);

  /** Витрина: купленные аккаунты — и при активной пробе; expired без чека — выбор другого предмета. */
  const canBrowseCatalog = previewStatus == null
    || previewStatus === 'confirmed'
    || (previewStatus === 'active' && isEstablishedForStats && !previewSubjectLocked)
    || (previewStatus === 'expired' && (!receiptClaimedAt || canAbandonPending));

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

  const withAccessWelcome = (node: React.ReactNode) => (
    <>
      {showAccessWelcome && <AccessWelcomeOverlay onContinue={dismissAccessWelcome} />}
      {node}
    </>
  );
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
    return withAccessWelcome(
      <ChannelCodeEntryScreen
        onSuccess={handleChannelCodeSuccess}
        onCancel={() => setShowChannelCode(false)}
      />,
    );
  }

  if (!accessChecked && previewStatus !== 'expired' && previewStatus !== 'active' && !receiptClaimedAt) {
    return withAccessWelcome(
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>,
    );
  }

  if (previewStatus === 'selecting') {
    if (!accessChecked || subjectCatalog.length === 0) {
      return withAccessWelcome(
        <div className="flex items-center justify-center min-h-screen bg-background">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>,
      );
    }
    return withAccessWelcome(
      <PreviewOnboardingScreen
        subjectCatalog={subjectCatalog}
        catalogGrantedSubjects={catalogGrantedSubjects}
        navHidden={navHidden}
        loading={previewPicking}
        onConfirm={handlePreviewPick}
      />,
    );
  }

  if (
    availableSubjects.length === 0
    && previewStatus !== 'active'
    && previewStatus !== 'expired'
    && !previewConfirmedAt
    && !inPendingPaymentFlow
  ) {
    return withAccessWelcome(
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
      </div>,
    );
  }

  // ── Экран выбора дисциплины (только когда открыто 2+ и юзер ещё не выбирал) ──
  if (showSubjectSelect) {
    return withAccessWelcome(
      <SubjectSelectScreen
        availableSubjects={availableSubjects}
        onBrowseCatalog={canBrowseCatalog ? handleBrowseCatalog : undefined}
        browseCatalogBusy={catalogBrowseLoading}
        onSelect={(s: string) => {
          setSubject(s);
          setShowSubjectSelect(false);
          localStorage.setItem('subject_chosen', 'true');
        }}
      />,
    );
  }

  return withAccessWelcome(
    <>
    {showGroupForReceipt && (
      <div className="fixed inset-0 z-[200]">
        <PreviewGroupScreen
          loading={groupSaving}
          onSubmit={handleSetStudyGroup}
          context="payment"
        />
      </div>
    )}
    <main className="flex flex-col h-[100dvh] w-full relative overflow-hidden">
      {serviceDegraded && (
        <div
          className="flex-shrink-0 px-4 py-2.5 text-center text-[12px] font-medium leading-snug"
          style={{
            background: 'color-mix(in srgb, #f59e0b 18%, var(--c-card))',
            color: 'var(--c-text)',
            borderBottom: '1px solid color-mix(in srgb, #f59e0b 35%, var(--c-border))',
          }}
        >
          Временные проблемы с сервером — показываем сохранённые данные. Попробуй обновить через минуту.
        </div>
      )}
      <div className="flex-1 overflow-hidden relative">
        {activeTab === 'questions' && renderModuleTab('questions', (
          <QuestionsTab
            subject={subject}
            bustDataCache={paymentFlowCacheBust}
            bioSection={subjectHasQuestionGameModes(subject) ? bioQuestionsSection : undefined}
            onBioSectionChange={subjectHasQuestionGameModes(subject) ? setBioQuestionsSection : undefined}
          />
        ))}
        {activeTab === 'tests'     && renderModuleTab('tests', (
          <TestsTab subject={subject} onTestModeChange={setTestMode} bustDataCache={paymentFlowCacheBust} />
        ))}
        {activeTab === 'tasks'     && renderModuleTab('tasks', (
          <TasksTab subject={subject} onSecretTap={handleSecretTap} bustDataCache={paymentFlowCacheBust} />
        ))}
        {activeTab === 'stats'     && (
          <StatsTab
            subject={subject}
            onSubjectChange={handleSubjectChangeWithPending}
            availableSubjects={statsAvailableSubjects}
            pendingPaymentSubject={pendingPaymentSubject}
            hasMicro={hasMicro}
            onBrowseCatalog={canBrowseCatalog ? handleBrowseCatalog : undefined}
            browseCatalogBusy={catalogBrowseLoading}
            onCheckPaymentStatus={
              (previewStatus === 'expired' || receiptClaimedAt) ? handleCheckPaymentStatus : undefined
            }
            checkPaymentBusy={statusChecking}
            examHidden={(navHidden[subject] || []).includes('exam')}
            materialsHidden={(navHidden[subject] || []).includes('materials')}
            onMicroUnlocked={() => {
              setHasMicro(true);
              localStorage.setItem('has_micro', 'true');
            }}
          />
        )}
      </div>
      <TrustAccessNotice
        visible={trustNoticeVisible}
        expiresAtIso={trustExpiresIso}
        onDismiss={() => setTrustNoticeDismissed(true)}
      />
      {/* В режиме решения теста навигация скрыта — она перекрывала панель тогглов */}
      {!testMode && (
        <Navigation
          activeTab={activeTab}
          onTabChange={handleNavTabChange}
          hiddenTabs={(navHidden[subject] || []) as TabType[]}
          subject={subject}
          onBioModeCycle={subjectHasQuestionGameModes(subject) ? handleBioModeCycle : undefined}
          bioGameMode={subjectHasQuestionGameModes(subject) ? bioQuestionsSection : 'list'}
          gameModesSubject={subjectHasQuestionGameModes(subject) ? subject : undefined}
        />
      )}
    </main>
    </>,
  );
}