// ── TestsTab.tsx ──────────────────────────────────────────────────────────────
"use client";

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { SubjectType } from '@/components/SubjectSelectScreen';
import { getSubject } from '@/lib/subjects';
import { loadSubjectData } from '@/lib/subjectData';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import {
  CheckCircle2, XCircle, RotateCcw, Zap, ChevronLeft, Search, Check,
  Medal, Pencil, Trash2, FileText, Shuffle, AlertTriangle, Flame,
  Award, ArrowRight, ArrowLeft, ChevronDown, BookOpen, Lightbulb,
  X,
} from 'lucide-react';

import { ToothIcon } from './ToothIcon';
import ReactMarkdown from 'react-markdown';
import { RichText, GlossaryItem } from '@/components/RichText';

// ─── Types ────────────────────────────────────────────────────────────────────
type BlockId = number | 'mistakes' | 'exam' | 'favorites';

interface MistakeRecord {
  id: string;
  question: string;
  options: string[];
  correct: string;
  ts: number;
}

const LETTERS = ['А', 'Б', 'В', 'Г', 'Д', 'Е'];

const LONG_PRESS_MS = 500;

// ─── Block button (shared between flat and themed grids) ──────────────────────
const BlockButton = ({
  b, onSelect, onStudySelect,
}: {
  b: { id: number; localId: number; range: string; size: number; best: number; status: 'perfect' | 'started' | 'new' };
  onSelect: () => void;
  onStudySelect: () => void;
}) => {
  const isPerfect = b.status === 'perfect';
  const isStarted = b.status === 'started';
  const accent = isPerfect ? 'var(--c-primary)' : isStarted ? 'var(--c-amber)' : 'var(--c-text-faint)';
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);

  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    longPressTriggered.current = false;
    clearLongPress();
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      onStudySelect();
    }, LONG_PRESS_MS);
  };

  const handlePointerUp = () => clearLongPress();
  const handlePointerLeave = () => clearLongPress();

  const handleClick = () => {
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }
    onSelect();
  };

  return (
    <button
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onPointerCancel={handlePointerLeave}
      onContextMenu={e => e.preventDefault()}
      className="rounded-[13px] flex flex-col items-center justify-between transition-all active:scale-95 relative overflow-hidden select-none touch-manipulation"
      style={{
        width: '100%', aspectRatio: '1 / 1.12', padding: '7px 5px 6px',
        background: isPerfect ? 'var(--c-primary-soft)' : isStarted ? 'var(--c-amber-soft)' : 'var(--c-card)',
        border: `1.5px solid ${isPerfect ? 'var(--c-primary-br)' : isStarted ? 'var(--c-amber-br)' : 'var(--c-border)'}`,
      }}>
      {isPerfect && <div className="absolute top-1.5 right-1.5" style={{ color: 'var(--c-amber)' }}><Medal className="w-[11px] h-[11px]" /></div>}
      <div className="text-[20px] font-bold leading-none mt-1.5"
        style={{ color: isPerfect ? 'var(--c-primary)' : 'var(--c-text)', letterSpacing: -0.5 }}>{b.localId}</div>
      <div className="text-[8.5px] font-mono font-bold uppercase" style={{ color: 'var(--c-text-faint)' }}>{b.range}</div>
      <div className="w-full flex flex-col items-center gap-1">
        {b.best > 0 && (
          <span className="text-[9px] font-mono font-bold" style={{ color: accent }}>{b.best}/{b.size}</span>
        )}
        <div className="h-[3px] rounded-full overflow-hidden" style={{ width: 'calc(100% - 4px)', background: 'var(--c-bg-subtle)' }}>
          <div className="h-full rounded-full" style={{ width: `${(b.best / b.size) * 100}%`, background: accent }} />
        </div>
      </div>
    </button>
  );
};

// ─── Component ────────────────────────────────────────────────────────────────
export const TestsTab = ({
  onSecretTap,
  subject = 'ortho',
  onTestModeChange,
}: {
  onSecretTap?: () => void;
  subject?: SubjectType;
  /** Сообщает родителю, что открыт блок теста (чтобы скрыть навигацию) */
  onTestModeChange?: (active: boolean) => void;
}) => {
  const cfg          = getSubject(subject);
  const accentColor  = cfg?.color || 'var(--c-primary)';
  const lsScores     = subject === 'ortho' ? 'test_block_scores'    : `${cfg?.lsPrefix || subject}_test_block_scores`;
  const lsNote       = subject === 'ortho' ? 'tests_personal_note'  : `${cfg?.lsPrefix || subject}_tests_personal_note`;
  const lsMistakes   = subject === 'ortho' ? 'test_mistakes'        : `${cfg?.lsPrefix || subject}_test_mistakes`;
  const lsFavorites  = subject === 'ortho' ? 'test_favorites'       : `${cfg?.lsPrefix || subject}_test_favorites`;
  const lsAttempts   = subject === 'ortho' ? 'test_block_attempts'  : `${cfg?.lsPrefix || subject}_test_block_attempts`;
  const lsOnboarding = 'tests_mode_onboarding_dismissed';
  // ── Data ──────────────────────────────────────────────────────────────────
  const [loadedTestsData, setLoadedTestsData] = useState<any[]>([]);
  const [microLoading,    setMicroLoading]    = useState(false);
  const testsData = loadedTestsData;
  const [dynamicGlossary, setDynamicGlossary] = useState<GlossaryItem[]>([]);

  // ── State ─────────────────────────────────────────────────────────────────
  const [selectedBlock,    setSelectedBlock]    = useState<BlockId | null>(null);
  const [currentTestIndex, setCurrentTestIndex] = useState(0);
  const [selectedOption,   setSelectedOption]   = useState<string | null>(null);
  const [showResult,       setShowResult]       = useState(false);
  const [score,            setScore]            = useState(0);
  const [completed,        setCompleted]        = useState(false);
  const [autoNext,         setAutoNext]         = useState(false);
  const [shuffleOptions,   setShuffleOptions]   = useState(false);
  const [studyMode,        setStudyMode]        = useState(false);
  const [hintLevel,        setHintLevel]        = useState(0);
  const [hidden5050,       setHidden5050]       = useState<string[]>([]);
  const [blockAttempts,    setBlockAttempts]    = useState<Record<number, number>>({});
  const [showOnboarding,   setShowOnboarding]    = useState(false);
  const [onboardingDismiss,setOnboardingDismiss]= useState(false);
  const [search,           setSearch]           = useState('');
  const [bestScores,       setBestScores]       = useState<Record<number, number>>({});
  const [mistakes,         setMistakes]         = useState<MistakeRecord[]>([]);
  const [favorites,        setFavorites]        = useState<MistakeRecord[]>([]);
  const [examQuestions,    setExamQuestions]    = useState<any[]>([]);
  const [testSnapshot,     setTestSnapshot]     = useState<any[]>([]);
  const [testsNote,        setTestsNote]        = useState('');
  const [isEditingNote,    setIsNoteEditing]    = useState(false);
  const [localTestsNote,   setLocalTestsNote]   = useState('');
  const [prevBest,         setPrevBest]         = useState(0);
  const [expandedThemes,   setExpandedThemes]   = useState<Set<string>>(new Set());
  const [showByTheme,      setShowByTheme]      = useState(false);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const testScrollRef = useRef<HTMLDivElement>(null);
  const showResultRef = useRef(false);

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => { setLocalTestsNote(testsNote); }, [testsNote]);

  useEffect(() => {
    if (isEditingNote && noteRef.current) {
      noteRef.current.focus();
      noteRef.current.setSelectionRange(noteRef.current.value.length, noteRef.current.value.length);
    }
  }, [isEditingNote]);

  useEffect(() => {
    try { setBestScores(JSON.parse(localStorage.getItem(lsScores) || '{}')); } catch {}
    try { setMistakes(JSON.parse(localStorage.getItem(lsMistakes) || '[]')); }  catch {}
    try { setFavorites(JSON.parse(localStorage.getItem(lsFavorites) || '[]')); } catch {}
    try { setBlockAttempts(JSON.parse(localStorage.getItem(lsAttempts) || '{}')); } catch {}
    setTestsNote(localStorage.getItem(lsNote) || '');
  }, [subject, lsScores, lsMistakes, lsFavorites, lsAttempts, lsNote]);

  useEffect(() => {
    let cancelled = false;
    setMicroLoading(true);
    setLoadedTestsData([]);
    loadSubjectData(subject, 'tests')
      .then(d => { if (!cancelled) setLoadedTestsData(d as any[]); })
      .finally(() => { if (!cancelled) setMicroLoading(false); });
    return () => { cancelled = true; };
  }, [subject]);

  useEffect(() => {
    let cancelled = false;
    loadSubjectData(subject, 'glossary')
      .then(d => { if (!cancelled) setDynamicGlossary(d as GlossaryItem[]); });
    return () => { cancelled = true; };
  }, [subject]);

  // Сообщаем родителю про режим теста (открыт блок) — чтобы скрыть навигацию.
  useEffect(() => {
    onTestModeChange?.(selectedBlock !== null);
    return () => onTestModeChange?.(false);
  }, [selectedBlock, onTestModeChange]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const TESTS_PER_BLOCK = 25;
  const TOTAL_TESTS  = testsData.length;
  const TOTAL_BLOCKS = Math.ceil(TOTAL_TESTS / TESTS_PER_BLOCK);

  const processed = useMemo(() =>
    testsData.map(t => ({ ...t, correctIndex: t.options.findIndex((o: string) => o === t.correct) })),
    [testsData]);

  const hasThemes = useMemo(() => processed.some((t: any) => t.theme), [processed]);

  // Плоские глобальные блоки — всегда 25 вопросов подряд, ID 1..N
  const blocks = useMemo(() => Array.from({ length: TOTAL_BLOCKS }, (_, i) => {
    const id = i + 1; const best = bestScores[id] || 0;
    const questions = processed.slice(i * TESTS_PER_BLOCK, (i + 1) * TESTS_PER_BLOCK);
    const size = questions.length;
    return {
      id, localId: id,
      range: `${i * TESTS_PER_BLOCK + 1}–${Math.min((i + 1) * TESTS_PER_BLOCK, TOTAL_TESTS)}`,
      questions, size, best,
      status: (best === size ? 'perfect' : best > 0 ? 'started' : 'new') as 'perfect' | 'started' | 'new',
    };
  }), [bestScores, TOTAL_BLOCKS, TOTAL_TESTS, processed, TESTS_PER_BLOCK]);

  // Тема-блоки — отдельно, используют отрицательные ID чтобы не конфликтовать с плоскими
  const themeGroups = useMemo(() => {
    if (!hasThemes) return null;
    const groups: { theme: string; questions: any[] }[] = [];
    const themeIndex = new Map<string, number>();
    for (const q of processed) {
      const theme = (q as any).theme || 'Общий раздел';
      if (!themeIndex.has(theme)) {
        themeIndex.set(theme, groups.length);
        groups.push({ theme, questions: [] });
      }
      groups[themeIndex.get(theme)!].questions.push(q);
    }
    let blockId = -1;
    return groups.map(g => {
      const tblocks: { id: number; localId: number; range: string; questions: any[]; size: number; best: number; status: 'perfect' | 'started' | 'new' }[] = [];
      for (let i = 0; i < g.questions.length; i += TESTS_PER_BLOCK) {
        const chunk = g.questions.slice(i, i + TESTS_PER_BLOCK);
        const size = chunk.length;
        tblocks.push({
          id: blockId--, localId: tblocks.length + 1,
          range: `${i + 1}–${Math.min(i + TESTS_PER_BLOCK, g.questions.length)}`,
          questions: chunk, size, best: 0,
          status: 'new',
        });
      }
      return { theme: g.theme, blocks: tblocks };
    });
  }, [hasThemes, processed, TESTS_PER_BLOCK]);

  const perfectCount = useMemo(() => blocks.filter(b => b.status === 'perfect').length, [blocks]);
  const startedCount = useMemo(() => blocks.filter(b => b.status === 'started').length, [blocks]);

  const blockTests = testSnapshot;

  const questionBlockMap = useMemo(() => {
    const map = new Map<string, { blockId: number; indexInBlock: number }>();
    for (const block of blocks) {
      block.questions.forEach((q: any, idx: number) => {
        map.set(q.id, { blockId: block.id, indexInBlock: idx });
      });
    }
    return map;
  }, [blocks]);

  const searchResults = useMemo(() => {
    if (!search) return [];
    const t = search.toLowerCase();
    return processed.filter(x => x.id.toString().includes(t) || x.question.toLowerCase().includes(t)).slice(0, 50);
  }, [search, processed]);

  const currentTest = blockTests[currentTestIndex];

  const shuffled = useMemo(() => {
    if (!shuffleOptions || !currentTest) return currentTest?.options || [];
    const s = [...currentTest.options];
    for (let i = s.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [s[i], s[j]] = [s[j], s[i]];
    }
    return s;
  }, [currentTest?.options, shuffleOptions, currentTestIndex]);

  const isRegularBlock = (id: BlockId | null): id is number =>
    id !== null && id !== 'mistakes' && id !== 'exam' && id !== 'favorites';

  const resetQuestionHints = () => {
    setHintLevel(0);
    setHidden5050([]);
  };

  const resetTest = () => {
    showResultRef.current = false;
    setCurrentTestIndex(0);
    setSelectedOption(null);
    setShowResult(false);
    setScore(0);
    setCompleted(false);
    resetQuestionHints();
  };

  const maybeShowOnboarding = () => {
    if (!localStorage.getItem(lsOnboarding)) setShowOnboarding(true);
  };

  const dismissOnboarding = () => {
    if (onboardingDismiss) localStorage.setItem(lsOnboarding, '1');
    setShowOnboarding(false);
  };

  const recordBlockAttempt = (blockId: number) => {
    setBlockAttempts(prev => {
      const updated = { ...prev, [blockId]: (prev[blockId] || 0) + 1 };
      localStorage.setItem(lsAttempts, JSON.stringify(updated));
      return updated;
    });
  };

  const openBlock = (
    b: { id: number; questions: any[] },
    entry: 'tap' | 'study',
  ) => {
    setTestSnapshot(b.questions || []);
    resetTest();
    if (entry === 'study') {
      setStudyMode(true);
    } else {
      setStudyMode((blockAttempts[b.id] || 0) === 0);
    }
    setSelectedBlock(b.id);
    maybeShowOnboarding();
  };

  const use5050Hint = () => {
    if (!currentTest || showResultRef.current || studyMode || hintLevel >= 1) return;
    const wrong = currentTest.options.filter((o: string) => o !== currentTest.correct);
    const toHide = [...wrong].sort(() => Math.random() - 0.5).slice(0, Math.min(2, wrong.length));
    setHidden5050(toHide);
    setHintLevel(1);
  };

  const useAnswerHint = () => {
    if (!currentTest || showResultRef.current || studyMode || hintLevel >= 2) return;
    setHintLevel(2);
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const saveNote = (t: string) => {
    const s = t.replace(/<[^>]*>?/gm, '');
    setTestsNote(s); localStorage.setItem(lsNote, s);
  };

  const recordMistake = (test: any) => {
    setMistakes(prev => {
      const filtered = prev.filter(m => m.id !== test.id);
      const updated: MistakeRecord[] = [
        { id: test.id, question: test.question, options: test.options, correct: test.correct, ts: Date.now() },
        ...filtered,
      ].slice(0, 100);
      localStorage.setItem(lsMistakes, JSON.stringify(updated));
      return updated;
    });
  };

  const clearMistake = (test: any) => {
    setMistakes(prev => {
      const updated = prev.filter(m => m.id !== test.id);
      localStorage.setItem(lsMistakes, JSON.stringify(updated));
      return updated;
    });
  };

  const toggleFavorite = (test: any) => {
    setFavorites(prev => {
      const exists = prev.some(f => f.id === test.id);
      const updated = exists
        ? prev.filter(f => f.id !== test.id)
        : [{ id: test.id, question: test.question, options: test.options, correct: test.correct, ts: Date.now() }, ...prev];
      localStorage.setItem(lsFavorites, JSON.stringify(updated));
      return updated;
    });
  };
  const isFavorite = (test: any) => favorites.some(f => f.id === test?.id);

  const startExam = () => {
    const all = [...processed];
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }
    const qs = all.slice(0, 100);
    setExamQuestions(qs);
    setTestSnapshot(qs);
    resetTest();
    setStudyMode(false);
    setSelectedBlock('exam');
    maybeShowOnboarding();
  };

  const nextQuestion = () => {
    if (currentTestIndex < blockTests.length - 1) {
      showResultRef.current = false;
      setCurrentTestIndex(i => i + 1);
      setSelectedOption(null);
      setShowResult(false);
      resetQuestionHints();
      testScrollRef.current?.scrollTo({ top: 0, behavior: 'instant' });
    } else {
      if (isRegularBlock(selectedBlock)) {
        recordBlockAttempt(selectedBlock);
        if (!studyMode && selectedBlock > 0) {
          const nb = { ...bestScores };
          const cur = nb[selectedBlock] || 0;
          setPrevBest(cur);
          if (score > cur) {
            nb[selectedBlock] = score;
            setBestScores(nb);
            localStorage.setItem(lsScores, JSON.stringify(nb));
          }
        } else if (selectedBlock > 0) {
          setPrevBest(bestScores[selectedBlock] || 0);
        }
      }
      setCompleted(true);
    }
  };

  const handleSelect = (opt: string) => {
    if (showResultRef.current) return;
    showResultRef.current = true;
    setSelectedOption(opt);
    setShowResult(true);
    const correct = opt === currentTest.correct;
    if (correct) {
      setScore(s => s + 1);
      clearMistake(currentTest);
      if (autoNext && currentTestIndex < blockTests.length - 1) setTimeout(nextQuestion, 450);
    } else {
      recordMistake(currentTest);
    }
  };

  const startFromQuestion = (id: string) => {
    const info = questionBlockMap.get(id);
    if (!info) return;
    const b = blocks.find(bl => bl.id === info.blockId);
    if (!b) return;
    setTestSnapshot(b.questions || []);
    resetTest();
    setStudyMode((blockAttempts[b.id] || 0) === 0);
    setSelectedBlock(info.blockId);
    setCurrentTestIndex(info.indexInBlock);
    maybeShowOnboarding();
  };

  // ── Шапка (общая для экрана блоков) ──────────────────────────────────────
  const Header = () => (
  <div
    className="px-4 pt-1 pb-3 sticky top-0 z-10"
    style={{
      background: 'color-mix(in srgb, var(--c-bg) 92%, transparent)',
      backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
      borderBottom: '1px solid var(--c-border)',
      /* Тот же уменьшенный отступ, что и во вкладке вопросов */
      paddingTop: 'max(12px, calc(var(--header-pt) - 24px))',
    }}
  >
    <div className="flex items-start justify-between px-1">
      {/* 1. Левая безопасная зона */}
      <div className="w-[75px] flex-shrink-0" />

      {/* 2. Центрированный блок */}
      <div className="flex flex-col items-center justify-center flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-[10px] flex items-center justify-center flex-shrink-0" style={{ background: 'var(--c-primary-dim)' }}>
            <ToothIcon className="w-5 h-5" style={{ color: accentColor }} variant={cfg?.iconVariant || 'perfect'} onClick={onSecretTap} />
          </div>
          <h1 className="text-[16px] font-bold tracking-tight leading-tight truncate" style={{ color: 'var(--c-text)' }}>
            {cfg?.brandName || 'OrthoByNekruz'}
          </h1>
        </div>
        
        <div className="flex flex-col items-center mt-1">
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5 text-center" style={{ color: accentColor }}>
            Тесты · {cfg?.label || subject}
          </p>
          
          {/* Плашка (pill) с количеством тестов вместо прогресс-бара */}
          <span
            className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full"
            style={{ background: 'var(--c-chip)', color: 'var(--c-muted)' }}
          >
            {TOTAL_TESTS} тестов
          </span>
        </div>
      </div>

      {/* 3. Правая безопасная зона */}
      <div className="w-[75px] flex-shrink-0" />
    </div>
  </div>
);

  // ══════════════════════════════════════════════════════════════════════════
  // ЭКРАН ВЫБОРА БЛОКА
  // ══════════════════════════════════════════════════════════════════════════
  if (selectedBlock === null) {
    const statTiles = [
      { label: 'Пройдено', value: perfectCount + startedCount, total: blocks.length, color: 'var(--c-primary)', Icon: Check },
      { label: 'Идеально', value: perfectCount,                 total: blocks.length, color: 'var(--c-amber)',   Icon: Medal },
      { label: 'Ошибок',   value: mistakes.length,              total: null,          color: 'var(--c-danger)',  Icon: Flame },
    ];

    return (
      <div className="flex flex-col h-full overflow-hidden max-w-full" style={{ background: 'var(--c-bg)' }}>
        <Header />

        <ScrollArea className="flex-1 scroll-container">
          <div className="px-4 pt-3 mx-auto max-w-2xl w-full" style={{ paddingBottom: 'var(--scroll-pb)' }}>

            {/* Поиск */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--c-muted)' }} />
              <Input
                placeholder="Поиск по № или тексту…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10 h-11 border focus-visible:ring-0 focus-visible:ring-offset-0 text-sm rounded-xl"
                style={{ background: 'var(--c-card)', borderColor: 'var(--c-border)', color: 'var(--c-text)', caretColor: 'var(--c-primary)' }}
              />
              {search && (
                      <button
                        onClick={() => setSearch('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2"
                        style={{ color: 'var(--c-muted)' }}
                        type="button"
                        aria-label="Очистить поиск"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
            </div>

            {microLoading && testsData.length === 0 ? (
              <div className="flex items-center justify-center py-24" style={{ color: 'var(--c-primary)' }}>
                <svg className="animate-spin w-8 h-8" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
              </div>
            ) : search ? (
              /* Результаты поиска */
              <div className="space-y-2">
                {searchResults.length > 0 ? searchResults.map(t => (
                  <button key={t.id} onClick={() => startFromQuestion(t.id)}
                    className="w-full p-4 rounded-2xl text-left transition-all active:scale-[0.98] flex gap-3"
                    style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
                    <span className="text-[10px] font-mono font-bold px-2 py-1 rounded h-fit shrink-0"
                      style={{ background: 'var(--c-primary-dim)', color: 'var(--c-primary)', border: '1px solid var(--c-primary-br)' }}>{t.id}</span>
                    <span className="text-sm line-clamp-2" style={{ color: 'var(--c-text)' }}>{t.question}</span>
                  </button>
                )) : (
                  <p className="text-center py-10 text-sm" style={{ color: 'var(--c-muted)' }}>Ничего не найдено</p>
                )}
              </div>
            ) : (
              <>
                {/* 3 плитки статистики */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {statTiles.map(s => (
                    <div key={s.label} className="rounded-[14px] p-2.5 flex flex-col gap-2"
                      style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
                      <div className="w-[26px] h-[26px] rounded-lg flex items-center justify-center"
                        style={{ background: `color-mix(in srgb, ${s.color} 16%, transparent)`, color: s.color }}>
                        <s.Icon className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="text-[18px] font-bold leading-none" style={{ color: 'var(--c-text)', letterSpacing: -0.5 }}>
                          {s.value}{s.total !== null && <span className="text-[11px] font-normal" style={{ color: 'var(--c-text-faint)' }}>/{s.total}</span>}
                        </div>
                        <div className="text-[10px] font-semibold uppercase tracking-wide mt-1" style={{ color: 'var(--c-muted)' }}>{s.label}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Работа над ошибками */}
                {mistakes.length > 0 && (
                  <button
                    onClick={() => { setTestSnapshot(mistakes.slice(0, 100)); resetTest(); setStudyMode(false); setSelectedBlock('mistakes'); maybeShowOnboarding(); }}
                    className="w-full mb-3 rounded-[18px] p-4 flex items-center gap-3 text-left transition-all active:scale-[0.99] relative overflow-hidden"
                    style={{
                      background: 'linear-gradient(135deg, var(--c-danger-soft) 0%, var(--c-amber-soft) 100%)',
                      border: '1px solid color-mix(in srgb, var(--c-danger) 40%, transparent)',
                    }}>
                    <div className="absolute right-1 bottom-[-10px] pointer-events-none select-none" style={{ fontSize: 72, opacity: 0.07, lineHeight: 1 }}>🔥</div>
                    <div className="w-11 h-11 rounded-[13px] flex items-center justify-center flex-shrink-0"
                      style={{ background: 'color-mix(in srgb, var(--c-danger) 18%, transparent)', color: 'var(--c-danger)' }}>
                      <Flame className="w-[22px] h-[22px]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[14px] font-bold" style={{ color: 'var(--c-danger)' }}>Работа над ошибками</span>
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md"
                          style={{ background: 'color-mix(in srgb, var(--c-danger) 18%, transparent)', color: 'var(--c-danger)' }}>
                          {Math.min(mistakes.length, 100)}/100
                        </span>
                      </div>
                      <p className="text-[11.5px] leading-snug" style={{ color: 'var(--c-muted)' }}>
                        Повторите вопросы, на которых ошиблись
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--c-danger)' }} />
                  </button>
                )}

                {/* Экзамен */}
                {processed.length >= 10 && (
                  <button
                    onClick={startExam}
                    className="w-full mb-3 rounded-[18px] p-4 flex items-center gap-3 text-left transition-all active:scale-[0.99] relative overflow-hidden"
                    style={{
                      background: 'linear-gradient(135deg, color-mix(in srgb, var(--c-primary) 12%, transparent) 0%, color-mix(in srgb, var(--c-primary) 6%, transparent) 100%)',
                      border: '1px solid color-mix(in srgb, var(--c-primary) 35%, transparent)',
                    }}>
                    <div className="absolute right-1 bottom-[-10px] pointer-events-none select-none" style={{ fontSize: 72, opacity: 0.07, lineHeight: 1 }}>🎓</div>
                    <div className="w-11 h-11 rounded-[13px] flex items-center justify-center flex-shrink-0"
                      style={{ background: 'color-mix(in srgb, var(--c-primary) 18%, transparent)', color: 'var(--c-primary)' }}>
                      <Award className="w-[22px] h-[22px]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[14px] font-bold" style={{ color: 'var(--c-primary)' }}>Экзамен</span>
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md"
                          style={{ background: 'color-mix(in srgb, var(--c-primary) 18%, transparent)', color: 'var(--c-primary)' }}>
                          100 вопросов
                        </span>
                      </div>
                      <p className="text-[11.5px] leading-snug" style={{ color: 'var(--c-muted)' }}>
                        Случайные вопросы из всей базы
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--c-primary)' }} />
                  </button>
                )}

                {/* Избранные */}
                {favorites.length > 0 && (
                  <button
                    onClick={() => { setTestSnapshot([...favorites]); resetTest(); setStudyMode(false); setSelectedBlock('favorites'); maybeShowOnboarding(); }}
                    className="w-full mb-3 rounded-[18px] p-4 flex items-center gap-3 text-left transition-all active:scale-[0.99] relative overflow-hidden"
                    style={{
                      background: 'linear-gradient(135deg, color-mix(in srgb, var(--c-amber) 12%, transparent) 0%, color-mix(in srgb, var(--c-amber) 6%, transparent) 100%)',
                      border: '1px solid color-mix(in srgb, var(--c-amber) 35%, transparent)',
                    }}>
                    <div className="absolute right-1 bottom-[-10px] pointer-events-none select-none" style={{ fontSize: 72, opacity: 0.07, lineHeight: 1 }}>⭐</div>
                    <div className="w-11 h-11 rounded-[13px] flex items-center justify-center flex-shrink-0"
                      style={{ background: 'color-mix(in srgb, var(--c-amber) 18%, transparent)', color: 'var(--c-amber)' }}>
                      <Zap className="w-[22px] h-[22px]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[14px] font-bold" style={{ color: 'var(--c-amber)' }}>Избранное</span>
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md"
                          style={{ background: 'color-mix(in srgb, var(--c-amber) 18%, transparent)', color: 'var(--c-amber)' }}>
                          {favorites.length}
                        </span>
                      </div>
                      <p className="text-[11.5px] leading-snug" style={{ color: 'var(--c-muted)' }}>
                        Вопросы, которые вы отметили
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--c-amber)' }} />
                  </button>
                )}

                {/* Заметки */}
                <Dialog>
                  <DialogTrigger asChild>
                    <button className="w-full mb-4 rounded-[12px] p-2.5 px-3.5 flex items-center gap-2.5 text-left transition-all active:scale-[0.99]"
                      style={{ background: 'var(--c-amber-soft)', border: '1px solid color-mix(in srgb, var(--c-amber) 33%, transparent)' }}>
                      <div className="w-[30px] h-[30px] rounded-[9px] flex items-center justify-center flex-shrink-0"
                        style={{ background: 'color-mix(in srgb, var(--c-amber) 22%, transparent)', color: 'var(--c-amber)' }}>
                        <FileText className="w-[15px] h-[15px]" />
                      </div>
                      <div className="flex-1">
                        <div className="text-[13px] font-bold" style={{ color: 'var(--c-amber)' }}>Мои заметки</div>
                        <div className="text-[11px] mt-0.5" style={{ color: 'var(--c-muted)' }}>Откройте, чтобы посмотреть</div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5" style={{ color: 'var(--c-amber)' }} />
                    </button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg w-[95vw] rounded-3xl p-6" style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2 text-sm uppercase tracking-wider" style={{ color: 'var(--c-amber)' }}>
                        <Pencil className="w-4 h-4" /> Мои заметки
                      </DialogTitle>
                    </DialogHeader>
                    <div className="mt-4 p-4 rounded-2xl" style={{ background: 'var(--c-amber-dim)', border: '1px solid var(--c-amber-br)' }}>
                      <div className="flex justify-between mb-3">
                        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--c-amber)' }}>Текст</span>
                        <div className="flex gap-3">
                          {testsNote && (
                            <button onClick={() => { setTestsNote(''); setLocalTestsNote(''); localStorage.removeItem(lsNote); }}
                              style={{ color: 'var(--c-danger)' }}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button onClick={() => { if (isEditingNote) saveNote(localTestsNote); setIsNoteEditing(v => !v); }}
                            className="text-xs font-semibold" style={{ color: 'var(--c-amber)' }}>
                            {isEditingNote ? 'Готово' : 'Править'}
                          </button>
                        </div>
                      </div>
                      {isEditingNote
                        ? <textarea ref={noteRef} value={localTestsNote} onChange={e => setLocalTestsNote(e.target.value)} onBlur={() => saveNote(localTestsNote)}
                            className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm resize-none min-h-[150px]"
                            style={{ color: 'var(--c-text)', caretColor: 'var(--c-amber)' }} autoFocus />
                        : <div className="text-sm prose prose-invert max-w-none break-words whitespace-pre-wrap min-h-[100px]" onClick={() => setIsNoteEditing(true)}>
                            {testsNote
                              ? <ReactMarkdown>{testsNote}</ReactMarkdown>
                              : <p className="italic" style={{ color: 'color-mix(in srgb, var(--c-amber) 35%, transparent)' }}>Нажмите «Править»…</p>}
                          </div>}
                    </div>
                  </DialogContent>
                </Dialog>

                {/* Заголовок «Блоки» + переключатель по темам */}
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--c-muted)' }}>Блоки</span>
                  <div className="flex items-center gap-2">
                    {hasThemes && (
                      <button
                        onClick={() => { setShowByTheme(v => !v); setExpandedThemes(new Set()); }}
                        className="text-[10px] font-bold px-2 py-1 rounded-lg transition-all active:scale-95"
                        style={showByTheme
                          ? { background: 'var(--c-primary-dim)', color: 'var(--c-primary)', border: '1px solid var(--c-primary-br)' }
                          : { background: 'var(--c-chip)', color: 'var(--c-muted)', border: '1px solid var(--c-border)' }}
                      >
                        По темам
                      </button>
                    )}
                    <span className="text-[11px] font-mono" style={{ color: 'var(--c-text-faint)' }}>
                      {showByTheme && themeGroups ? `${themeGroups.length} тем` : `${blocks.length} шт`}
                    </span>
                  </div>
                </div>
                <p className="text-[10.5px] leading-snug mb-2.5 px-1" style={{ color: 'var(--c-text-faint)' }}>
                  Нажмите — проверка · удерживайте — обучение с ответами
                </p>

                {/* Сетка блоков — с группировкой по темам или без */}
                {hasThemes && showByTheme && themeGroups ? themeGroups.map(g => {
                  const isExpanded = expandedThemes.has(g.theme);
                  const themePerfect = g.blocks.filter(b => b.status === 'perfect').length;
                  const themeTotal   = g.blocks.length;
                  return (
                    <div key={g.theme} style={{ marginBottom: 4, maxWidth: 'calc(100vw - 32px)', overflow: 'hidden' }}>
                      <button
                        onClick={() => setExpandedThemes(prev => {
                          const next = new Set(prev);
                          if (next.has(g.theme)) next.delete(g.theme); else next.add(g.theme);
                          return next;
                        })}
                        style={{ width: 'calc(100vw - 32px)', maxWidth: '100%', display: 'flex', alignItems: 'center', gap: 6, padding: '6px 4px', boxSizing: 'border-box' }}
                        className="active:opacity-70"
                      >
                        <ChevronDown
                          className="w-3 h-3 flex-shrink-0 transition-transform duration-200"
                          style={{ color: 'var(--c-muted)', transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}
                        />
                        <span style={{ flex: 1, minWidth: 0, textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--c-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {g.theme}
                        </span>
                        <span style={{ fontSize: 10, fontFamily: 'monospace', flexShrink: 0, marginLeft: 4, color: themePerfect === themeTotal && themeTotal > 0 ? 'var(--c-primary)' : 'var(--c-text-faint)' }}>
                          {themePerfect}/{themeTotal}
                        </span>
                      </button>
                      {isExpanded && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                          {g.blocks.map(b => (
                            <div key={b.id} style={{ width: 'calc((100vw - 56px) / 4)' }}>
                              <BlockButton b={b} onSelect={() => openBlock(b, 'tap')} onStudySelect={() => openBlock(b, 'study')} />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }) : (
                  <div className="grid grid-cols-4 gap-2">
                    {blocks.map((b, i) => (
                      <BlockButton
                        key={b.id}
                        b={{ ...b, localId: i + 1, range: `${i * TESTS_PER_BLOCK + 1}–${Math.min((i + 1) * TESTS_PER_BLOCK, TOTAL_TESTS)}` }}
                        onSelect={() => openBlock(b, 'tap')}
                        onStudySelect={() => openBlock(b, 'study')}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ЭКРАН РЕЗУЛЬТАТОВ
  // ══════════════════════════════════════════════════════════════════════════
  if (completed) {
    const total = blockTests.length;
    const isMistakeMode = selectedBlock === 'mistakes';
    const isExamMode = selectedBlock === 'exam';
    const isFavoritesMode = selectedBlock === 'favorites';
    const pct = total ? Math.round((score / total) * 100) : 0;
    const isPerfect = score === total && total > 0;
    const isOk = score >= Math.ceil(total * 0.85);
    const color = isPerfect ? 'var(--c-amber)' : isOk ? 'var(--c-primary)' : 'var(--c-danger)';
    const wrong = total - score;

    const ringSize = 150, ringStroke = 13;
    const r = (ringSize - ringStroke) / 2;
    const c = 2 * Math.PI * r;
    const off = c * (1 - pct / 100);

    const cards: { lbl: string; v: React.ReactNode; color: string; Icon: React.ComponentType<{ className?: string }> }[] = [
      { lbl: 'Верно',  v: score, color: 'var(--c-primary)', Icon: CheckCircle2 },
      { lbl: 'Ошибок', v: wrong, color: 'var(--c-danger)',  Icon: XCircle },
    ];
    if (!isMistakeMode && !isExamMode && !isFavoritesMode && !studyMode) {
      cards.push({ lbl: 'Лучший', v: `${Math.max(prevBest, score)}/${total}`, color: 'var(--c-amber)', Icon: Medal });
    }

    return (
      <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--c-bg)' }}>
        <div className="flex-1 overflow-y-auto scroll-container flex flex-col items-center text-center px-6"
          style={{ paddingTop: 'calc(var(--header-pt) + 8px)', paddingBottom: 'var(--scroll-pb)' }}>

          {/* Кольцо */}
          <div className="relative mt-2" style={{ width: ringSize, height: ringSize }}>
            <svg width={ringSize} height={ringSize} style={{ transform: 'rotate(-90deg)' }}>
              <circle cx={ringSize / 2} cy={ringSize / 2} r={r} stroke="var(--c-border)" strokeWidth={ringStroke} fill="none" />
              <circle cx={ringSize / 2} cy={ringSize / 2} r={r} stroke={color} strokeWidth={ringStroke} fill="none"
                strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.9s ease' }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
              <div className="font-bold leading-none" style={{ fontSize: 38, color: 'var(--c-text)', letterSpacing: -1.5 }}>
                {score}<span style={{ fontSize: 18, color: 'var(--c-text-faint)', fontWeight: 500 }}>/{total}</span>
              </div>
              <div className="text-[11px] font-bold uppercase tracking-widest" style={{ color }}>{pct}%</div>
            </div>
          </div>

          {/* Заголовок */}
          <h2 className="mt-5 text-[22px] font-bold leading-tight" style={{ color: 'var(--c-text)', letterSpacing: -0.5 }}>
            {isPerfect
              ? (isExamMode ? 'Экзамен сдан на отлично!' : isMistakeMode ? 'Все ошибки исправлены!' : 'Идеально!')
              : isOk ? (isExamMode ? 'Хороший результат на экзамене' : 'Отличный результат') : 'Можно лучше'}
          </h2>
          <p className="mt-1.5 text-[13.5px] leading-snug" style={{ color: 'var(--c-muted)', maxWidth: 300 }}>
            {studyMode && isRegularBlock(selectedBlock)
              ? 'Учебный проход — лучший счёт не обновляется'
              : isPerfect ? 'Знания крепкие, как здоровая эмаль'
              : isOk ? 'Несколько ошибок — посмотри их в «Работе над ошибками»'
              : 'Стоит повторить теорию по этому блоку'}
          </p>

          {/* Мини-карточки */}
          <div className="grid gap-2 mt-5 w-full max-w-sm" style={{ gridTemplateColumns: `repeat(${cards.length}, 1fr)` }}>
            {cards.map(m => (
              <div key={m.lbl} className="rounded-[13px] py-3 px-2 flex flex-col items-center gap-1.5"
                style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
                <div className="w-[26px] h-[26px] rounded-lg flex items-center justify-center"
                  style={{ background: `color-mix(in srgb, ${m.color} 16%, transparent)`, color: m.color }}>
                  <m.Icon className="w-[13px] h-[13px]" />
                </div>
                <div className="font-bold leading-none" style={{ fontSize: typeof m.v === 'number' ? 20 : 14, color: 'var(--c-text)', letterSpacing: -0.3 }}>
                  {m.v}
                </div>
                <div className="text-[9.5px] font-bold uppercase tracking-wide" style={{ color: 'var(--c-muted)' }}>{m.lbl}</div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="flex flex-col gap-2.5 w-full max-w-sm mt-6">
            <button onClick={() => {
              resetTest();
              if (isRegularBlock(selectedBlock)) setStudyMode((blockAttempts[selectedBlock] || 0) === 0);
            }}
              className="h-[52px] rounded-[13px] font-bold text-[14px] inline-flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              style={{ background: 'var(--c-primary)', color: 'var(--c-bg)', boxShadow: '0 6px 18px var(--c-primary-dim)' }}>
              <RotateCcw className="w-[15px] h-[15px]" /> Пройти ещё раз
            </button>
            <button onClick={() => { resetTest(); setSelectedBlock(null); }}
              className="h-[52px] rounded-[13px] font-semibold text-[14px] inline-flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)', color: 'var(--c-muted)' }}>
              <ArrowLeft className="w-[15px] h-[15px]" /> К выбору блоков
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ЭКРАН ТЕСТА
  // ══════════════════════════════════════════════════════════════════════════
  const isMistakeMode = selectedBlock === 'mistakes';
  const isExamModeTest = selectedBlock === 'exam';
  const isFavoritesModeTest = selectedBlock === 'favorites';
  const isBlockMode = isRegularBlock(selectedBlock);
  const options = shuffleOptions ? shuffled : (currentTest?.options || []);
  const visibleOptions = options.filter((opt: string) => !hidden5050.includes(opt));
  const answerRevealed = studyMode || hintLevel >= 2;
  const hintsAvailable = isBlockMode && !studyMode && !showResult;

  return (
    <div className="flex flex-col h-full overflow-hidden max-w-full" style={{ background: 'var(--c-bg)' }}>

      {/* Онбординг при первом входе в режим теста */}
      <Dialog open={showOnboarding} onOpenChange={open => { if (!open) dismissOnboarding(); }}>
        <DialogContent className="max-w-md w-[92vw] rounded-3xl p-6" style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
          <DialogHeader>
            <DialogTitle className="text-[15px] font-bold leading-snug" style={{ color: 'var(--c-text)' }}>
              Как проходить тесты
            </DialogTitle>
          </DialogHeader>
          <div className="mt-3 space-y-3 text-[13px] leading-relaxed" style={{ color: 'var(--c-muted)' }}>
            <p><strong style={{ color: 'var(--c-text)' }}>Нажмите на блок</strong> — режим проверки. При первом проходе включится «Обучение» с подсветкой ответов; при повторе — строгий режим.</p>
            <p><strong style={{ color: 'var(--c-text)' }}>Удерживайте блок</strong> — сразу открыть все 25 вопросов с видимыми правильными ответами.</p>
            <p><strong style={{ color: 'var(--c-text)' }}>Подсказки 50/50 и «Ответ»</strong> — доступны в режиме проверки, если «Обучение» выключено.</p>
          </div>
          <label className="flex items-center gap-2.5 mt-4 cursor-pointer">
            <Checkbox
              checked={onboardingDismiss}
              onCheckedChange={v => setOnboardingDismiss(v === true)}
              className="border-[var(--c-border)] data-[state=checked]:bg-[var(--c-primary)]"
            />
            <span className="text-[12.5px]" style={{ color: 'var(--c-muted)' }}>Больше не показывать</span>
          </label>
          <button
            onClick={dismissOnboarding}
            className="w-full h-11 rounded-[12px] font-bold text-[13.5px] mt-4 transition-all active:scale-[0.98]"
            style={{ background: 'var(--c-primary)', color: 'var(--c-bg)' }}
          >
            Понятно
          </button>
        </DialogContent>
      </Dialog>

      {/* Compact top */}
      <div className="px-3.5 py-2.5 sticky top-0 z-20 flex items-center gap-2.5"
        style={{
          background: 'color-mix(in srgb, var(--c-bg) 95%, transparent)',
          backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid var(--c-border)',
          paddingTop: 'calc(var(--header-pt) + 20px)',
        }}>
        <button onClick={() => { resetTest(); setSelectedBlock(null); }}
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 active:scale-95"
          style={{ background: 'transparent', border: '1px solid var(--c-border)', color: 'var(--c-muted)' }}>
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11.5px] font-mono font-bold flex items-center gap-1.5"
              style={{ color: selectedBlock === 'mistakes' ? 'var(--c-danger)' : selectedBlock === 'exam' ? 'var(--c-primary)' : selectedBlock === 'favorites' ? 'var(--c-amber)' : 'var(--c-text)' }}>
              {isMistakeMode && <AlertTriangle className="w-3 h-3" />}
              {selectedBlock === 'mistakes' ? 'Ошибки' : selectedBlock === 'exam' ? 'Экзамен' : selectedBlock === 'favorites' ? 'Избранное' : `Блок ${selectedBlock}`}
              <span style={{ color: 'var(--c-muted)' }}>{currentTestIndex + 1}/{blockTests.length}</span>
              {studyMode && isBlockMode && (
                <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md"
                  style={{ background: 'color-mix(in srgb, var(--c-amber) 18%, transparent)', color: 'var(--c-amber)' }}>
                  Обучение
                </span>
              )}
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md inline-flex items-center gap-1"
                style={{ background: 'var(--c-primary-dim)', color: 'var(--c-primary)' }}>
                <Check className="w-2.5 h-2.5" /> {score}
              </span>
              <button
                onClick={() => currentTest && toggleFavorite(currentTest)}
                className="w-7 h-7 flex items-center justify-center rounded-lg transition-all active:scale-90"
                style={{ background: isFavorite(currentTest) ? 'color-mix(in srgb, var(--c-amber) 18%, transparent)' : 'var(--c-card)', border: '1px solid var(--c-border)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill={isFavorite(currentTest) ? 'var(--c-amber)' : 'none'} stroke={isFavorite(currentTest) ? 'var(--c-amber)' : 'var(--c-muted)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </button>
            </div>
          </div>
          <div className="h-[3px] rounded-full overflow-hidden" style={{ background: 'var(--c-bg-subtle)' }}>
            <div className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${((currentTestIndex + 1) / blockTests.length) * 100}%`,
                background: selectedBlock === 'mistakes' ? 'var(--c-danger)' : 'var(--c-primary)',
              }} />
          </div>
        </div>
      </div>

      <div ref={testScrollRef} className="flex-1 overflow-y-auto scroll-container">
        <div className="px-4 pt-4 pb-44 mx-auto max-w-2xl flex flex-col gap-3.5">

          {/* Вопрос */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--c-muted)' }}>
              Вопрос {currentTestIndex + 1}
            </div>
            <RichText
              text={currentTest?.question || ''}
              relatedTerms={(currentTest as any)?.relatedTerms}
              glossaryTerms={dynamicGlossary}
              fontSize={16}
              className="font-semibold"
            />
          </div>

          {/* Подсказки 50/50 и полный ответ */}
          {hintsAvailable && (
            <div className="flex gap-2">
              <button
                onClick={use5050Hint}
                disabled={hintLevel >= 1}
                className="flex-1 h-10 rounded-[11px] inline-flex items-center justify-center gap-1.5 text-[11.5px] font-bold transition-all active:scale-95 disabled:opacity-40"
                style={{
                  background: hintLevel >= 1 ? 'var(--c-primary-dim)' : 'var(--c-card)',
                  border: `1px solid ${hintLevel >= 1 ? 'var(--c-primary-br)' : 'var(--c-border)'}`,
                  color: hintLevel >= 1 ? 'var(--c-primary)' : 'var(--c-muted)',
                }}
              >
                <Lightbulb className="w-3.5 h-3.5" />
                50/50
              </button>
              <button
                onClick={useAnswerHint}
                disabled={hintLevel >= 2}
                className="flex-1 h-10 rounded-[11px] inline-flex items-center justify-center gap-1.5 text-[11.5px] font-bold transition-all active:scale-95 disabled:opacity-40"
                style={{
                  background: hintLevel >= 2 ? 'var(--c-primary-dim)' : 'var(--c-card)',
                  border: `1px solid ${hintLevel >= 2 ? 'var(--c-primary-br)' : 'var(--c-border)'}`,
                  color: hintLevel >= 2 ? 'var(--c-primary)' : 'var(--c-muted)',
                }}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Ответ
              </button>
            </div>
          )}

          {/* Варианты */}
          <div className="flex flex-col gap-2">
            {visibleOptions.map((opt: string, idx: number) => {
              const correct        = opt === currentTest.correct;
              const selected       = selectedOption === opt;
              const isWrong        = showResult && selected && !correct;
              const selectedRight  = showResult && selected && correct;
              const revealCorrect  = (showResult && correct && !selected) || (answerRevealed && correct && !showResult);
              const dimmed         = showResult && !correct && !selected;
              return (
                <button key={opt} onClick={() => handleSelect(opt)} disabled={showResult}
                  className="w-full rounded-[13px] p-3.5 flex items-center gap-3 text-left transition-all active:scale-[0.99]"
                  style={{
                    background: selectedRight ? 'var(--c-primary-dim)' : isWrong ? 'var(--c-danger-soft)' : revealCorrect ? 'transparent' : 'var(--c-card)',
                    border: `1.5px solid ${selectedRight ? 'var(--c-primary-br)' : isWrong ? 'color-mix(in srgb, var(--c-danger) 45%, transparent)' : revealCorrect ? 'var(--c-primary-br)' : 'var(--c-border)'}`,
                    opacity: dimmed ? 0.5 : 1,
                  }}>
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-[12px] font-mono font-bold"
                    style={{
                      background: selectedRight ? 'var(--c-primary)' : isWrong ? 'var(--c-danger)' : 'var(--c-chip)',
                      color: (selectedRight || isWrong) ? 'var(--c-bg)' : 'var(--c-muted)',
                    }}>
                    {LETTERS[idx] || idx + 1}
                  </span>
                  <span className="flex-1 text-[14px] leading-snug"
                    style={{ color: selectedRight ? 'var(--c-primary)' : isWrong ? 'var(--c-danger)' : revealCorrect ? 'var(--c-primary)' : 'var(--c-text)', fontWeight: (selectedRight || revealCorrect) ? 600 : 500 }}>
                    {opt}
                  </span>
                  {selectedRight  && <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--c-primary)' }} />}
                  {revealCorrect && !showResult && <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--c-primary)' }} />}
                  {isWrong        && <XCircle className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--c-danger)' }} />}
                </button>
              );
            })}
          </div>

          

          {/* Кнопка «Следующий» */}
          {showResult && (
            <button onClick={nextQuestion}
              className="h-[52px] rounded-[13px] font-bold text-[14px] inline-flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              style={{ background: 'var(--c-primary)', color: 'var(--c-bg)', boxShadow: '0 6px 18px var(--c-primary-dim)' }}>
              {currentTestIndex === blockTests.length - 1 ? 'Результаты' : 'Следующий вопрос'}
              <ArrowRight className="w-[15px] h-[15px]" />
            </button>
          )}
        </div>
      </div>

      {/* Нижняя панель: тогглы + выход */}
      <div className="flex-shrink-0 px-4 flex flex-col gap-2"
        style={{
          background: 'var(--c-card)', borderTop: '1px solid var(--c-border)',
          paddingTop: 10, paddingBottom: 'calc(var(--nav-bottom, 12px) + 16px)',
        }}>
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            {([
              { on: autoNext,       label: 'Авто-переход', Icon: Zap,     toggle: () => setAutoNext(v => !v),                            disabled: false, show: true },
              { on: shuffleOptions, label: 'Перемешать',   Icon: Shuffle, toggle: () => { if (!showResult) setShuffleOptions(v => !v); }, disabled: showResult, show: true },
              { on: studyMode,      label: 'Обучение',     Icon: BookOpen, toggle: () => { if (!showResult) setStudyMode(v => !v); },     disabled: showResult, show: isBlockMode },
            ] as const).filter(t => t.show).map(t => (
            <button key={t.label} onClick={t.toggle} disabled={t.disabled}
              className="flex-1 h-10 rounded-[10px] inline-flex items-center justify-center gap-1.5 text-[11.5px] font-bold transition-all active:scale-95 disabled:opacity-40"
              style={t.on
                ? { background: 'var(--c-primary-dim)', border: '1px solid var(--c-primary-br)', color: 'var(--c-primary)' }
                : { background: 'var(--c-bg-subtle)',   border: '1px solid var(--c-border)',     color: 'var(--c-muted)' }}>
              <t.Icon className="w-3 h-3" />
              {t.label}
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ml-0.5"
                style={t.on
                  ? { background: 'color-mix(in srgb, var(--c-primary) 25%, transparent)', color: 'var(--c-primary)' }
                  : { background: 'var(--c-chip)', color: 'var(--c-text-faint)' }}>
                {t.on ? 'ВКЛ' : 'ВЫК'}
              </span>
            </button>
          ))}
          </div>
        </div>
        <button
          onClick={() => { resetTest(); setSelectedBlock(null); }}
          className="h-10 rounded-[10px] inline-flex items-center justify-center gap-2 text-[12.5px] font-bold transition-all active:scale-95"
          style={{ background: 'var(--c-danger-soft)', border: '1px solid color-mix(in srgb, var(--c-danger) 33%, transparent)', color: 'var(--c-danger)' }}
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Выйти из теста
        </button>
      </div>
    </div>
  );
};
