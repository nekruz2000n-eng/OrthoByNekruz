// ── TestsTab.tsx ──────────────────────────────────────────────────────────────
"use client";

import React, { useState, useMemo, useEffect, useRef } from 'react';
import orthoTestsData from '@/data/tests.json';
import { SubjectType } from '@/components/SubjectSelectScreen';
import { getSubject } from '@/lib/subjects';
import { loadSubjectData } from '@/lib/subjectData';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  CheckCircle2, XCircle, RotateCcw, Zap, ChevronLeft, Search, Check,
  Medal, Pencil, Trash2, FileText, Shuffle, AlertTriangle, Flame,
  Award, ArrowRight, ArrowLeft,
} from 'lucide-react';
import { ToothIcon } from './ToothIcon';
import ReactMarkdown from 'react-markdown';

// ─── Types ────────────────────────────────────────────────────────────────────
type BlockId = number | 'mistakes';

interface MistakeRecord {
  id: string;
  question: string;
  options: string[];
  correct: string;
  ts: number;
}

const LETTERS = ['А', 'Б', 'В', 'Г', 'Д', 'Е'];

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
  const isOrtho      = subject === 'ortho';

  // ── Data ──────────────────────────────────────────────────────────────────
  const [microTestsData, setMicroTestsData] = useState<any[]>([]);
  const [microLoading,   setMicroLoading]   = useState(false);
  const testsData = isOrtho ? orthoTestsData : microTestsData;

  // ── State ─────────────────────────────────────────────────────────────────
  const [selectedBlock,    setSelectedBlock]    = useState<BlockId | null>(null);
  const [currentTestIndex, setCurrentTestIndex] = useState(0);
  const [selectedOption,   setSelectedOption]   = useState<string | null>(null);
  const [showResult,       setShowResult]       = useState(false);
  const [score,            setScore]            = useState(0);
  const [completed,        setCompleted]        = useState(false);
  const [autoNext,         setAutoNext]         = useState(false);
  const [shuffleOptions,   setShuffleOptions]   = useState(false);
  const [search,           setSearch]           = useState('');
  const [bestScores,       setBestScores]       = useState<Record<number, number>>({});
  const [mistakes,         setMistakes]         = useState<MistakeRecord[]>([]);
  const [testsNote,        setTestsNote]        = useState('');
  const [isEditingNote,    setIsNoteEditing]    = useState(false);
  const [localTestsNote,   setLocalTestsNote]   = useState('');
  const [prevBest,         setPrevBest]         = useState(0);
  const noteRef = useRef<HTMLTextAreaElement>(null);

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
    setTestsNote(localStorage.getItem(lsNote) || '');
  }, [subject]);

  useEffect(() => {
    if (isOrtho) return;
    let cancelled = false;
    setMicroLoading(true);
    loadSubjectData(subject, 'tests')
      .then(d => { if (!cancelled) setMicroTestsData(d as any[]); })
      .finally(() => { if (!cancelled) setMicroLoading(false); });
    return () => { cancelled = true; };
  }, [subject]);

  // Сообщаем родителю про режим теста (открыт блок) — чтобы скрыть навигацию.
  useEffect(() => {
    onTestModeChange?.(selectedBlock !== null);
    return () => onTestModeChange?.(false);
  }, [selectedBlock, onTestModeChange]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const TESTS_PER_BLOCK = 20;
  const TOTAL_TESTS  = testsData.length;
  const TOTAL_BLOCKS = Math.ceil(TOTAL_TESTS / TESTS_PER_BLOCK);

  const blocks = useMemo(() => Array.from({ length: TOTAL_BLOCKS }, (_, i) => {
    const id = i + 1; const best = bestScores[id] || 0;
    return {
      id, range: `${i * TESTS_PER_BLOCK + 1}–${Math.min((i + 1) * TESTS_PER_BLOCK, TOTAL_TESTS)}`, best,
      status: best === 20 ? 'perfect' : best > 0 ? 'started' : 'new' as 'perfect' | 'started' | 'new',
    };
  }), [bestScores, TOTAL_BLOCKS, TOTAL_TESTS]);

  const perfectCount = useMemo(() => blocks.filter(b => b.status === 'perfect').length, [blocks]);
  const startedCount = useMemo(() => blocks.filter(b => b.status === 'started').length, [blocks]);

  const processed = useMemo(() =>
    testsData.map(t => ({ ...t, correctIndex: t.options.findIndex((o: string) => o === t.correct) })),
    [testsData]);

  const blockTests = useMemo(() => {
    if (selectedBlock === null) return [];
    if (selectedBlock === 'mistakes') return mistakes.slice(0, 100);
    return processed.slice((selectedBlock - 1) * TESTS_PER_BLOCK, selectedBlock * TESTS_PER_BLOCK);
  }, [selectedBlock, processed, mistakes]);

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

  const nextQuestion = () => {
    if (currentTestIndex < blockTests.length - 1) {
      setCurrentTestIndex(i => i + 1); setSelectedOption(null); setShowResult(false);
    } else {
      if (selectedBlock !== null && selectedBlock !== 'mistakes') {
        const nb = { ...bestScores };
        const cur = nb[selectedBlock as number] || 0;
        setPrevBest(cur);
        if (score > cur) {
          nb[selectedBlock as number] = score;
          setBestScores(nb);
          localStorage.setItem(lsScores, JSON.stringify(nb));
        }
      }
      setCompleted(true);
    }
  };

  const handleSelect = (opt: string) => {
    if (showResult) return;
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

  const resetTest = () => {
    setCurrentTestIndex(0); setSelectedOption(null);
    setShowResult(false); setScore(0); setCompleted(false);
  };

  const startFromQuestion = (id: string) => {
    const idx = processed.findIndex(t => t.id === id);
    if (idx !== -1) {
      setSelectedBlock(Math.floor(idx / TESTS_PER_BLOCK) + 1);
      resetTest();
      setCurrentTestIndex(idx % TESTS_PER_BLOCK);
    }
  };

  // ── Шапка (общая для экрана блоков) ──────────────────────────────────────
  const Header = () => (
    <div
      className="px-4 py-2.5 sticky top-0 z-10"
      style={{
        background: 'color-mix(in srgb, var(--c-bg) 92%, transparent)',
        backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--c-border)',
        paddingTop: 'var(--header-pt)',
      }}
    >
      <div className="flex items-center gap-3 px-1">
        <div className="w-9 h-9 rounded-[11px] flex items-center justify-center flex-shrink-0" style={{ background: 'var(--c-primary-dim)' }}>
          <ToothIcon className="w-6 h-6" style={{ color: accentColor }} variant={cfg?.iconVariant || 'perfect'} onClick={onSecretTap} />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-[16px] font-bold tracking-tight leading-tight" style={{ color: 'var(--c-text)' }}>
            {cfg?.brandName || 'OrthoByNekruz'}
          </h1>
          <p className="text-[10px] font-bold uppercase tracking-widest mt-0.5" style={{ color: accentColor }}>
            Тесты · {cfg?.label || subject}
          </p>
        </div>
        <span
          className="text-[11px] font-mono font-bold px-2.5 py-1 rounded-lg"
          style={{ background: 'var(--c-chip)', color: 'var(--c-muted)' }}
        >
          {TOTAL_TESTS} тестов
        </span>
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
            </div>

            {microLoading && !isOrtho ? (
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
                    onClick={() => { resetTest(); setSelectedBlock('mistakes'); }}
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

                {/* Заголовок «Блоки» */}
                <div className="flex items-baseline justify-between mb-2 px-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--c-muted)' }}>Блоки</span>
                  <span className="text-[11px] font-mono" style={{ color: 'var(--c-text-faint)' }}>
                    по 20 тестов · {blocks.length} шт
                  </span>
                </div>

                {/* Сетка блоков */}
                <div className="grid grid-cols-4 gap-2">
                  {blocks.map(b => {
                    const isPerfect = b.status === 'perfect';
                    const isStarted = b.status === 'started';
                    const accent = isPerfect ? 'var(--c-primary)' : isStarted ? 'var(--c-amber)' : 'var(--c-text-faint)';
                    return (
                      <button key={b.id} onClick={() => { resetTest(); setSelectedBlock(b.id); }}
                        className="rounded-[13px] flex flex-col items-center justify-between transition-all active:scale-95 relative overflow-hidden"
                        style={{
                          aspectRatio: '1 / 1.12', padding: '7px 5px 6px',
                          background: isPerfect ? 'var(--c-primary-soft)' : isStarted ? 'var(--c-amber-soft)' : 'var(--c-card)',
                          border: `1.5px solid ${isPerfect ? 'var(--c-primary-br)' : isStarted ? 'var(--c-amber-br)' : 'var(--c-border)'}`,
                        }}>
                        {isPerfect && <div className="absolute top-1.5 right-1.5" style={{ color: 'var(--c-amber)' }}><Medal className="w-[11px] h-[11px]" /></div>}
                        <div className="text-[20px] font-bold leading-none mt-1.5"
                          style={{ color: isPerfect ? 'var(--c-primary)' : 'var(--c-text)', letterSpacing: -0.5 }}>{b.id}</div>
                        <div className="text-[8.5px] font-mono font-bold uppercase" style={{ color: 'var(--c-text-faint)' }}>{b.range}</div>
                        <div className="w-full flex flex-col items-center gap-1">
                          {b.best > 0 && (
                            <span className="text-[9px] font-mono font-bold" style={{ color: accent }}>{b.best}/20</span>
                          )}
                          <div className="h-[3px] rounded-full overflow-hidden" style={{ width: 'calc(100% - 4px)', background: 'var(--c-bg-subtle)' }}>
                            <div className="h-full rounded-full" style={{ width: `${(b.best / 20) * 100}%`, background: accent }} />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
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
    if (!isMistakeMode) {
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
              ? (isMistakeMode ? 'Все ошибки исправлены!' : 'Идеально!')
              : isOk ? 'Отличный результат' : 'Можно лучше'}
          </h2>
          <p className="mt-1.5 text-[13.5px] leading-snug" style={{ color: 'var(--c-muted)', maxWidth: 300 }}>
            {isPerfect ? 'Знания крепкие, как здоровая эмаль'
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
            <button onClick={resetTest}
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
  const options = shuffleOptions ? shuffled : (currentTest?.options || []);

  return (
    <div className="flex flex-col h-full overflow-hidden max-w-full" style={{ background: 'var(--c-bg)' }}>

      {/* Compact top */}
      <div className="px-3.5 py-2.5 sticky top-0 z-20 flex items-center gap-2.5"
        style={{
          background: 'color-mix(in srgb, var(--c-bg) 95%, transparent)',
          backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid var(--c-border)',
          paddingTop: 'var(--header-pt)',
        }}>
        <button onClick={() => { resetTest(); setSelectedBlock(null); }}
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 active:scale-95"
          style={{ background: 'transparent', border: '1px solid var(--c-border)', color: 'var(--c-muted)' }}>
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11.5px] font-mono font-bold flex items-center gap-1.5"
              style={{ color: isMistakeMode ? 'var(--c-danger)' : 'var(--c-text)' }}>
              {isMistakeMode && <AlertTriangle className="w-3 h-3" />}
              {isMistakeMode ? 'Ошибки' : `Блок ${selectedBlock}`}
              <span style={{ color: 'var(--c-muted)' }}>{currentTestIndex + 1}/{blockTests.length}</span>
            </span>
            <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md inline-flex items-center gap-1"
              style={{ background: 'var(--c-primary-dim)', color: 'var(--c-primary)' }}>
              <Check className="w-2.5 h-2.5" /> {score}
            </span>
          </div>
          <div className="h-[3px] rounded-full overflow-hidden" style={{ background: 'var(--c-bg-subtle)' }}>
            <div className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${((currentTestIndex + 1) / blockTests.length) * 100}%`,
                background: isMistakeMode ? 'var(--c-danger)' : 'var(--c-primary)',
              }} />
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 scroll-container">
        <div className="px-4 pt-4 pb-44 mx-auto max-w-2xl flex flex-col gap-3.5">

          {/* Вопрос */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--c-muted)' }}>
              Вопрос {currentTestIndex + 1}
            </div>
            <div className="text-[16px] font-semibold leading-snug" style={{ color: 'var(--c-text)' }}>
              {currentTest?.question}
            </div>
          </div>

          {/* Варианты */}
          <div className="flex flex-col gap-2">
            {options.map((opt: string, idx: number) => {
              const correct  = opt === currentTest.correct;
              const selected = selectedOption === opt;
              const isWrong  = showResult && selected && !correct;
              const asCorrect = showResult && correct;
              const dimmed   = showResult && !correct && !selected;
              return (
                <button key={idx} onClick={() => handleSelect(opt)} disabled={showResult}
                  className="w-full rounded-[13px] p-3.5 flex items-center gap-3 text-left transition-all active:scale-[0.99]"
                  style={{
                    background: asCorrect ? 'var(--c-primary-dim)' : isWrong ? 'var(--c-danger-soft)' : 'var(--c-card)',
                    border: `1.5px solid ${asCorrect ? 'var(--c-primary-br)' : isWrong ? 'color-mix(in srgb, var(--c-danger) 45%, transparent)' : 'var(--c-border)'}`,
                    opacity: dimmed ? 0.5 : 1,
                  }}>
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-[12px] font-mono font-bold"
                    style={{
                      background: asCorrect ? 'var(--c-primary)' : isWrong ? 'var(--c-danger)' : 'var(--c-chip)',
                      color: (asCorrect || isWrong) ? 'var(--c-bg)' : 'var(--c-muted)',
                    }}>
                    {LETTERS[idx] || idx + 1}
                  </span>
                  <span className="flex-1 text-[14px] leading-snug"
                    style={{ color: asCorrect ? 'var(--c-primary)' : isWrong ? 'var(--c-danger)' : 'var(--c-text)', fontWeight: asCorrect ? 600 : 500 }}>
                    {opt}
                  </span>
                  {asCorrect && <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--c-primary)' }} />}
                  {isWrong   && <XCircle className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--c-danger)' }} />}
                </button>
              );
            })}
          </div>

          {/* Фидбэк */}
          {showResult && (() => {
            const right = selectedOption === currentTest.correct;
            return (
              <div className="rounded-[13px] p-3.5 flex items-start gap-3 animate-in fade-in slide-in-from-bottom-1 duration-200"
                style={{
                  background: right ? 'var(--c-primary-dim)' : 'var(--c-danger-soft)',
                  border: `1px solid ${right ? 'var(--c-primary-br)' : 'color-mix(in srgb, var(--c-danger) 33%, transparent)'}`,
                }}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: right ? 'var(--c-primary)' : 'var(--c-danger)', color: 'var(--c-bg)' }}>
                  {right ? <Check className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                </div>
                <div className="flex-1">
                  <div className="text-[13px] font-bold" style={{ color: right ? 'var(--c-primary)' : 'var(--c-danger)' }}>
                    {right ? 'Правильно' : 'Неправильно'}
                  </div>
                  {!right && (
                    <div className="text-[12px] mt-1 leading-snug" style={{ color: 'var(--c-muted)' }}>
                      Верный ответ: <span style={{ color: 'var(--c-text)', fontWeight: 600 }}>{currentTest.correct}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

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
      </ScrollArea>

      {/* Нижняя панель: тогглы + выход */}
      <div className="flex-shrink-0 px-4 flex flex-col gap-2"
        style={{
          background: 'var(--c-card)', borderTop: '1px solid var(--c-border)',
          paddingTop: 10, paddingBottom: 'calc(var(--nav-bottom, 12px) + 16px)',
        }}>
        <div className="flex gap-2">
          {([
            { on: autoNext,       label: 'Авто-переход', Icon: Zap,     toggle: () => setAutoNext(v => !v),                            disabled: false },
            { on: shuffleOptions, label: 'Перемешать',   Icon: Shuffle, toggle: () => { if (!showResult) setShuffleOptions(v => !v); }, disabled: showResult },
          ]).map(t => (
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
