// ── TestsTab.tsx ──────────────────────────────────────────────────────────────
"use client";

import React, { useState, useMemo, useEffect, useRef } from 'react';
import orthoTestsData from '@/data/tests.json';
import { SubjectType } from '@/components/SubjectSelectScreen';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  CheckCircle2, XCircle, RotateCcw, Zap, ChevronLeft, Search,
  Medal, Pencil, Trash2, FileText, Shuffle, AlertTriangle, Flame,
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
  ts: number; // timestamp для сортировки
}

// ─── Component ────────────────────────────────────────────────────────────────
export const TestsTab = ({ onSecretTap, subject = 'ortho' }: { onSecretTap?: () => void; subject?: SubjectType }) => {
  const accentColor  = subject === 'micro' ? 'var(--c-amber)' : 'var(--c-primary)';
  const lsScores     = subject === 'ortho' ? 'test_block_scores'    : 'micro_test_block_scores';
  const lsNote       = subject === 'ortho' ? 'tests_personal_note'  : 'micro_tests_personal_note';
  const lsMistakes   = subject === 'ortho' ? 'test_mistakes'        : 'micro_test_mistakes';
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
    setMicroLoading(true);
    const tgId    = localStorage.getItem('user_tg_id') || '';
    const initDat = (window as any).Telegram?.WebApp?.initData || '';
    fetch('/api/micro-data', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'tests', telegramId: tgId, initData: initDat }),
    })
      .then(r => r.json())
      .then(d => { if (d.data) setMicroTestsData(d.data); })
      .catch(() => {})
      .finally(() => setMicroLoading(false));
  }, [subject]);

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

  const processed = useMemo(() =>
    testsData.map(t => ({ ...t, correctIndex: t.options.findIndex((o: string) => o === t.correct) })),
    [testsData]);

  // Тесты для текущего блока: обычный блок ИЛИ блок ошибок
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

  // Перемешивание вариантов — сбрасывается при переходе на новый вопрос
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

  /** Записать ошибку в localStorage (не дублировать, макс 100) */
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

  /** Удалить ошибку после правильного ответа */
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
        if (score > (nb[selectedBlock as number] || 0)) {
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
      if (autoNext && currentTestIndex < blockTests.length - 1) setTimeout(nextQuestion, 800);
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

  // ══════════════════════════════════════════════════════════════════════════
  // ЭКРАН ВЫБОРА БЛОКА
  // ══════════════════════════════════════════════════════════════════════════
  if (selectedBlock === null) {
    return (
      <div className="flex flex-col h-full overflow-hidden max-w-full" style={{ background: 'var(--c-bg)' }}>

        {/* Шапка */}
        <div className="px-4 py-3 space-y-3 sticky top-0 z-10"
          style={{
            background: 'color-mix(in srgb, var(--c-bg) 92%, transparent)',
            backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
            borderBottom: '1px solid var(--c-border)',
            paddingTop: 'var(--header-pt)',
          }}>
          <div className="flex justify-between items-center px-1">
            <div className="flex items-center gap-3">
              <ToothIcon className="w-9 h-9" style={{ color: accentColor }} variant={subject === 'ortho' ? 'perfect' : 'normal'} />
              <div>
                <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--c-text)' }}>
                  {subject === 'micro' ? 'MicroByNekruz' : 'OrthoByNekruz'}
                </h1>
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: accentColor }}>
                  {subject === 'micro' ? 'Микробиология' : 'Ортопедия'}
                </p>
              </div>
            </div>
            <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: 'var(--c-muted)' }}>{TOTAL_TESTS} тестов</span>
          </div>

          {/* Поиск */}
          <div className="relative mx-1">
            <Input placeholder="Поиск по № или тексту..." value={search} onChange={e => setSearch(e.target.value)}
              className="pl-10 h-11 border-none focus-visible:ring-0 text-sm"
              style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)', color: 'var(--c-text)', caretColor: 'var(--c-primary)' }} />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--c-muted)' }} />
          </div>
        </div>

        <ScrollArea className="flex-1 scroll-container px-3">
          <div className="mx-auto max-w-2xl pt-3" style={{ paddingBottom: 'var(--scroll-pb)' }}>
            {search ? (
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
                {/* ══════════════════════════════════════════
                    БЛОК ПОСЛЕДНИХ ОШИБОК
                    ══════════════════════════════════════════ */}
                {mistakes.length > 0 && (
                  <button
                    onClick={() => { resetTest(); setSelectedBlock('mistakes'); }}
                    className="w-full mb-4 rounded-2xl transition-all active:scale-[0.99] relative overflow-hidden"
                    style={{
                      background: 'linear-gradient(135deg, hsl(var(--destructive) / 0.12) 0%, hsl(var(--destructive) / 0.06) 100%)',
                      border: '1.5px solid hsl(var(--destructive) / 0.35)',
                      padding: '16px 18px',
                    }}>
                    {/* Декоративный огонь */}
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-10 pointer-events-none select-none"
                      style={{ fontSize: '64px', lineHeight: 1 }}>🔥</div>

                    <div className="flex items-center gap-3">
                      {/* Иконка */}
                      <div className="flex items-center justify-center w-12 h-12 rounded-xl shrink-0"
                        style={{ background: 'hsl(var(--destructive) / 0.15)', border: '1.5px solid hsl(var(--destructive) / 0.3)' }}>
                        <Flame className="w-6 h-6" style={{ color: 'hsl(var(--destructive))' }} />
                      </div>

                      {/* Текст */}
                      <div className="flex-1 text-left">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[13px] font-bold" style={{ color: 'hsl(var(--destructive))' }}>
                            Работа над ошибками
                          </span>
                          <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md"
                            style={{ background: 'hsl(var(--destructive) / 0.15)', color: 'hsl(var(--destructive))' }}>
                            {Math.min(mistakes.length, 100)}/100
                          </span>
                        </div>
                        <p className="text-[11px] leading-snug" style={{ color: 'color-mix(in srgb, hsl(var(--destructive)) 70%, var(--c-muted))' }}>
                          Вопросы, на которых вы ошиблись — повторите и исправьте
                        </p>
                      </div>

                      {/* Стрелка */}
                      <ChevronLeft className="w-5 h-5 rotate-180 shrink-0" style={{ color: 'hsl(var(--destructive) / 0.5)' }} />
                    </div>

                    {/* Прогресс-бар: сколько уже исправлено */}
                    <div className="mt-3 h-1 rounded-full overflow-hidden" style={{ background: 'hsl(var(--destructive) / 0.15)' }}>
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(5, (100 - Math.min(mistakes.length, 100)))}%`, background: 'hsl(var(--destructive) / 0.6)' }} />
                    </div>
                    <p className="mt-1 text-[9px] font-mono text-right" style={{ color: 'hsl(var(--destructive) / 0.5)' }}>
                      {100 - Math.min(mistakes.length, 100)} из 100 исправлено
                    </p>
                  </button>
                )}

                {/* ══════════════════════════════════════════
                    ОБЫЧНЫЕ БЛОКИ (4 в ряд)
                    ══════════════════════════════════════════ */}
                <div className="grid grid-cols-4 gap-1.5">
                  {blocks.map(b => (
                    <button key={b.id} onClick={() => { resetTest(); setSelectedBlock(b.id); }}
                      className="flex flex-col items-center justify-center rounded-xl transition-all active:scale-95 relative overflow-hidden"
                      style={{
                        height: '72px', padding: '6px 4px',
                        background: b.status === 'perfect'
                          ? 'color-mix(in srgb, var(--c-primary) 10%, var(--c-card))'
                          : b.status === 'started'
                          ? 'color-mix(in srgb, var(--c-amber) 6%, var(--c-card))'
                          : 'var(--c-card)',
                        border: b.status === 'perfect'
                          ? '1.5px solid var(--c-primary-br)'
                          : b.status === 'started'
                          ? '1.5px solid var(--c-amber-br)'
                          : '1.5px solid var(--c-border)',
                      }}>
                      <div className="flex items-center gap-0.5 mb-0.5">
                        <span className="text-lg font-bold leading-none"
                          style={{ color: b.status === 'perfect' ? 'var(--c-primary)' : 'var(--c-text)' }}>{b.id}</span>
                        {b.status === 'perfect' && <Medal className="w-3 h-3" style={{ color: 'var(--c-amber)' }} />}
                      </div>
                      <span className="text-[8px] font-mono uppercase tracking-tight leading-none" style={{ color: 'var(--c-muted)' }}>{b.range}</span>
                      {b.best > 0 && (
                        <span className="text-[8px] mt-0.5 font-bold leading-none"
                          style={{ color: b.status === 'perfect' ? 'var(--c-primary)' : 'var(--c-amber)' }}>{b.best}/20</span>
                      )}
                    </button>
                  ))}

                  {/* Заметки */}
                  <Dialog>
                    <DialogTrigger asChild>
                      <button className="flex flex-col items-center justify-center rounded-xl transition-all active:scale-95 relative overflow-hidden"
                        style={{ height: '72px', padding: '6px 4px', background: 'color-mix(in srgb, var(--c-amber) 5%, var(--c-card))', border: '1.5px solid var(--c-amber-br)' }}>
                        <FileText className="w-5 h-5 mb-0.5" style={{ color: 'var(--c-amber)' }} />
                        <span className="text-[8px] font-mono uppercase tracking-tight leading-none" style={{ color: 'var(--c-amber)' }}>Заметки</span>
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
                                style={{ color: 'hsl(var(--destructive))' }}>
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
                                : <p className="italic" style={{ color: 'color-mix(in srgb, var(--c-amber) 35%, transparent)' }}>Нажмите «Править»...</p>}
                            </div>}
                      </div>
                    </DialogContent>
                  </Dialog>
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
    const total     = blockTests.length;
    const isMistakeMode = selectedBlock === 'mistakes';
    const ok  = score >= Math.ceil(total * 0.85);
    const bad = score < Math.ceil(total * 0.5);
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-6 animate-in fade-in zoom-in-95 duration-500"
        style={{ background: 'var(--c-bg)' }}>
        <ToothIcon
          variant={ok ? 'perfect' : bad ? 'broken' : 'normal'}
          className="w-32 h-32"
          style={{ color: ok ? accentColor : bad ? 'hsl(var(--destructive))' : 'hsl(210 80% 55%)' }} />
        <div className="space-y-2 px-4">
          <h2 className="text-3xl font-bold"
            style={{ color: ok ? accentColor : bad ? 'hsl(var(--destructive))' : 'hsl(210 80% 55%)' }}>
            {score === total ? (isMistakeMode ? 'Все ошибки исправлены! 🎉' : 'Идеально!') : (isMistakeMode ? 'Работа над ошибками' : `Блок ${selectedBlock} завершён!`)}
          </h2>
          <p style={{ color: 'var(--c-text)' }}>
            {ok ? 'Блестяще! Знания крепки, как здоровая эмаль!' : bad ? 'Нужно повторить теорию!' : 'Хороший результат!'}
          </p>
          <p className="text-sm" style={{ color: 'var(--c-muted)' }}>
            Результат: <span className="font-bold" style={{ color: 'var(--c-text)' }}>{score}</span> из {total}
          </p>
        </div>
        <div className="w-full max-w-sm space-y-3 pt-4 pb-32">
          <button onClick={resetTest}
            className="w-full h-14 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            style={{ background: 'var(--c-primary)', color: 'hsl(var(--primary-foreground))' }}>
            <RotateCcw className="w-5 h-5" /> Сначала
          </button>
          <button onClick={() => { resetTest(); setSelectedBlock(null); }}
            className="w-full h-14 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)', color: 'var(--c-muted)' }}>
            <ChevronLeft className="w-5 h-5" /> К выбору блоков
          </button>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ЭКРАН ТЕСТА
  // ══════════════════════════════════════════════════════════════════════════
  const isMistakeMode = selectedBlock === 'mistakes';

  return (
    <div className="flex flex-col h-full overflow-hidden max-w-full" style={{ background: 'var(--c-bg)' }}>

      {/* ── Шапка (только прогресс, без тоглов) ─────────────────────────── */}
      <div className="px-4 py-2.5 sticky top-0 z-20"
        style={{
          background: 'color-mix(in srgb, var(--c-bg) 95%, transparent)',
          backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid var(--c-border)',
          paddingTop: 'var(--header-pt)',
        }}>
        <div className="flex items-center gap-3">
          <button onClick={() => { resetTest(); setSelectedBlock(null); }}
            className="p-1.5 rounded-full transition-colors" style={{ color: 'var(--c-muted)' }}>
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <div className="flex justify-between items-center mb-1">
              <div className="flex items-center gap-1.5">
                {isMistakeMode && <AlertTriangle className="w-3 h-3" style={{ color: 'hsl(var(--destructive))' }} />}
                <span className="text-[10px] font-mono uppercase tracking-tighter" style={{ color: isMistakeMode ? 'hsl(var(--destructive))' : 'var(--c-muted)' }}>
                  {isMistakeMode ? 'Ошибки' : `Блок ${selectedBlock}`} · {currentTestIndex + 1}/{blockTests.length}
                </span>
              </div>
              <span className="text-[11px] font-mono font-bold" style={{ color: accentColor }}>✓ {score}</span>
            </div>
            <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--c-border)' }}>
              <div className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${((currentTestIndex + 1) / blockTests.length) * 100}%`,
                  background: isMistakeMode ? 'hsl(var(--destructive))' : 'var(--c-primary)',
                }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Вопрос + варианты ────────────────────────────────────────────── */}
      <ScrollArea className="flex-1 scroll-container">
        <div className="space-y-3 pt-5 px-4 pb-44 mx-auto max-w-2xl">

          {/* Метка режима ошибок */}
          {isMistakeMode && (
            <div className="flex items-center gap-2 px-1">
              <Flame className="w-4 h-4" style={{ color: 'hsl(var(--destructive))' }} />
              <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'hsl(var(--destructive) / 0.7)' }}>
                Работа над ошибками
              </span>
            </div>
          )}

          <h3 className="text-[17px] font-semibold leading-snug" style={{ color: 'var(--c-text)' }}>
            {currentTest.question}
          </h3>

          <div className="space-y-2 pt-1">
            {(shuffleOptions ? shuffled : currentTest.options).map((opt: string, idx: number) => {
              const correct  = opt === currentTest.correct;
              const selected = selectedOption === opt;
              return (
                <button key={idx} onClick={() => handleSelect(opt)} disabled={showResult}
                  className="w-full p-4 rounded-xl text-left flex items-center justify-between gap-3 transition-all active:scale-[0.99]"
                  style={{
                    border: showResult && correct
                      ? '1.5px solid var(--c-primary-br)'
                      : showResult && selected
                      ? '1.5px solid hsl(var(--destructive) / 0.4)'
                      : '1.5px solid var(--c-border)',
                    background: showResult && correct
                      ? 'var(--c-primary-dim)'
                      : showResult && selected
                      ? 'hsl(var(--destructive) / 0.08)'
                      : 'var(--c-card)',
                    opacity: showResult && !correct && !selected ? 0.4 : 1,
                  }}>
                  <span className="text-[14px] leading-tight flex-1"
                    style={{ color: showResult && correct ? 'var(--c-primary)' : showResult && selected ? 'hsl(var(--destructive))' : 'var(--c-text)' }}>
                    {opt}
                  </span>
                  {showResult && correct  && <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: 'var(--c-primary)' }} />}
                  {showResult && selected && !correct && <XCircle className="w-5 h-5 shrink-0" style={{ color: 'hsl(var(--destructive))' }} />}
                </button>
              );
            })}
          </div>

          {/* Кнопка «Следующий» */}
          {showResult && (
            <div className="pt-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <button onClick={nextQuestion}
                className="w-full h-14 rounded-xl font-bold text-base transition-all active:scale-[0.98]"
                style={{ background: 'var(--c-primary)', color: 'hsl(var(--primary-foreground))' }}>
                {currentTestIndex === blockTests.length - 1 ? 'Результаты →' : 'Следующий вопрос →'}
              </button>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* ── Фиксированная панель тоглов (снизу) ─────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-30 px-4 pb-safe"
        style={{
          background: 'color-mix(in srgb, var(--c-bg) 90%, transparent)',
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          borderTop: '1px solid var(--c-border)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)',
        }}>
        <div className="flex gap-2 py-3 mx-auto max-w-2xl">
          {/* Авто-переход */}
          <button
            onClick={() => setAutoNext(v => !v)}
            className="flex-1 flex items-center justify-center gap-1.5 h-10 rounded-xl text-[11px] font-bold transition-all active:scale-95"
            style={autoNext
              ? { background: 'var(--c-primary-dim)', border: '1px solid var(--c-primary-br)', color: 'var(--c-primary)' }
              : { background: 'var(--c-card)', border: '1px solid var(--c-border)', color: 'var(--c-muted)' }}>
            <Zap className="w-3.5 h-3.5" style={autoNext ? { fill: 'var(--c-primary)', color: 'var(--c-primary)' } : {}} />
            Авто-переход
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-md ml-0.5"
              style={autoNext
                ? { background: 'var(--c-primary-dim)', color: 'var(--c-primary)' }
                : { background: 'color-mix(in srgb, var(--c-border) 50%, transparent)', color: 'var(--c-muted)' }}>
              {autoNext ? 'ВКЛ' : 'ВЫКЛ'}
            </span>
          </button>

          {/* Перемешать */}
          <button
            onClick={() => !showResult && setShuffleOptions(v => !v)}
            disabled={showResult}
            className="flex-1 flex items-center justify-center gap-1.5 h-10 rounded-xl text-[11px] font-bold transition-all active:scale-95 disabled:opacity-40"
            style={shuffleOptions
              ? { background: 'var(--c-primary-dim)', border: '1px solid var(--c-primary-br)', color: 'var(--c-primary)' }
              : { background: 'var(--c-card)', border: '1px solid var(--c-border)', color: 'var(--c-muted)' }}>
            <Shuffle className="w-3.5 h-3.5" />
            Перемешать
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-md ml-0.5"
              style={shuffleOptions
                ? { background: 'var(--c-primary-dim)', color: 'var(--c-primary)' }
                : { background: 'color-mix(in srgb, var(--c-border) 50%, transparent)', color: 'var(--c-muted)' }}>
              {shuffleOptions ? 'ВКЛ' : 'ВЫКЛ'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};