// ── TestsTab.tsx ──────────────────────────────────────────────────────────────
"use client";

import React, { useState, useMemo, useEffect, useRef } from 'react';
import testsData from '@/data/tests.json';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { CheckCircle2, XCircle, RotateCcw, Zap, ChevronLeft, LayoutGrid, Search, Medal, Pencil, Trash2, FileText, Shuffle } from 'lucide-react';
import { ToothIcon } from './ToothIcon';
import ReactMarkdown from 'react-markdown';

export const TestsTab = () => {
  const [selectedBlock, setSelectedBlock] = useState<number | null>(null);
  const [currentTestIndex, setCurrentTestIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [autoNext, setAutoNext] = useState(false);
  const [search, setSearch] = useState('');
  const [bestScores, setBestScores] = useState<Record<number, number>>({});
  const [testsNote, setTestsNote] = useState('');
  const [isEditingNote, setIsNoteEditing] = useState(false);
  const [shuffleOptions, setShuffleOptions] = useState(false);
  const [localTestsNote, setLocalTestsNote] = useState('');
  const noteRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setLocalTestsNote(testsNote); }, [testsNote]);
  useEffect(() => {
    if (isEditingNote && noteRef.current) { noteRef.current.focus(); noteRef.current.setSelectionRange(noteRef.current.value.length, noteRef.current.value.length); }
  }, [isEditingNote]);

  useEffect(() => {
    try { setBestScores(JSON.parse(localStorage.getItem('test_block_scores') || '{}')); } catch {}
    setTestsNote(localStorage.getItem('tests_personal_note') || '');
  }, []);

  const saveNote = (t: string) => {
    const s = t.replace(/<[^>]*>?/gm, '');
    setTestsNote(s); localStorage.setItem('tests_personal_note', s);
  };

  const TESTS_PER_BLOCK = 20;
  const TOTAL_TESTS  = testsData.length;
  const TOTAL_BLOCKS = Math.ceil(TOTAL_TESTS / TESTS_PER_BLOCK);

  const blocks = useMemo(() => Array.from({ length: TOTAL_BLOCKS }, (_, i) => {
    const id = i + 1; const best = bestScores[id] || 0;
    return { id, range: `${i * TESTS_PER_BLOCK + 1}–${Math.min((i + 1) * TESTS_PER_BLOCK, TOTAL_TESTS)}`, best,
      status: best === 20 ? 'perfect' : best > 0 ? 'started' : 'new' as 'perfect' | 'started' | 'new' };
  }), [bestScores, TOTAL_BLOCKS, TOTAL_TESTS]);

  const processed = useMemo(() => testsData.map(t => ({ ...t, correctIndex: t.options.findIndex(o => o === t.correct) })), []);
  const blockTests = useMemo(() => {
    if (selectedBlock === null) return [];
    return processed.slice((selectedBlock - 1) * TESTS_PER_BLOCK, selectedBlock * TESTS_PER_BLOCK);
  }, [selectedBlock, processed]);

  const searchResults = useMemo(() => {
    if (!search) return [];
    const t = search.toLowerCase();
    return processed.filter(x => x.id.toString().includes(t) || x.question.toLowerCase().includes(t)).slice(0, 50);
  }, [search, processed]);

  const currentTest = blockTests[currentTestIndex];

  const shuffled = useMemo(() => {
    if (!shuffleOptions || !currentTest) return currentTest?.options || [];
    const s = [...currentTest.options];
    for (let i = s.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [s[i], s[j]] = [s[j], s[i]]; }
    return s;
  }, [currentTest?.options, shuffleOptions, currentTestIndex]);

  const nextQuestion = () => {
    if (currentTestIndex < blockTests.length - 1) { setCurrentTestIndex(i => i + 1); setSelectedOption(null); setShowResult(false); }
    else {
      if (selectedBlock !== null) {
        const nb = { ...bestScores }; if (score > (nb[selectedBlock] || 0)) { nb[selectedBlock] = score; setBestScores(nb); localStorage.setItem('test_block_scores', JSON.stringify(nb)); }
      }
      setCompleted(true);
    }
  };

  const handleSelect = (opt: string) => {
    if (showResult) return;
    setSelectedOption(opt); setShowResult(true);
    if (opt === currentTest.correct) { setScore(s => s + 1); if (autoNext && currentTestIndex < blockTests.length - 1) setTimeout(nextQuestion, 800); }
  };

  const resetTest = () => { setCurrentTestIndex(0); setSelectedOption(null); setShowResult(false); setScore(0); setCompleted(false); };

  const startFromQuestion = (id: string) => {
    const idx = processed.findIndex(t => t.id === id);
    if (idx !== -1) { setSelectedBlock(Math.floor(idx / TESTS_PER_BLOCK) + 1); resetTest(); setCurrentTestIndex(idx % TESTS_PER_BLOCK); }
  };

  /* ВЫБОР БЛОКА */
  if (selectedBlock === null) {
    return (
      <div className="flex flex-col h-full overflow-hidden max-w-full" style={{ background: 'var(--c-bg)' }}>
        <div className="px-4 py-3 space-y-3 sticky top-0 z-10"
          style={{ background: 'color-mix(in srgb, var(--c-bg) 92%, transparent)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderBottom: '1px solid var(--c-border)', paddingTop: 'var(--header-pt)' }}>
          <div className="flex justify-between items-center px-1">
            <div className="flex items-center gap-3">
              <ToothIcon className="w-9 h-9 text-primary" />
              <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--c-text)' }}>OrthoByNekruz</h1>
            </div>
            <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: 'var(--c-muted)' }}>{TOTAL_TESTS} тестов</span>
          </div>
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
              <div className="space-y-2">
                {searchResults.length > 0 ? searchResults.map(t => (
                  <button key={t.id} onClick={() => startFromQuestion(t.id)}
                    className="w-full p-4 rounded-2xl text-left transition-all active:scale-[0.98] flex gap-3"
                    style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
                    <span className="text-[10px] font-mono font-bold px-2 py-1 rounded h-fit shrink-0"
                      style={{ background: 'var(--c-primary-dim)', color: 'var(--c-primary)', border: '1px solid var(--c-primary-br)' }}>{t.id}</span>
                    <span className="text-sm line-clamp-2" style={{ color: 'var(--c-text)' }}>{t.question}</span>
                  </button>
                )) : <p className="text-center py-10 text-sm" style={{ color: 'var(--c-muted)' }}>Ничего не найдено</p>}
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-1.5">
                {blocks.map(b => (
                  <button key={b.id} onClick={() => { resetTest(); setSelectedBlock(b.id); }}
                    className="flex flex-col items-center justify-center rounded-xl transition-all active:scale-95 relative overflow-hidden"
                    style={{
                      height: '72px', padding: '6px 4px',
                      background: b.status === 'perfect' ? 'color-mix(in srgb, var(--c-primary) 10%, var(--c-card))' : b.status === 'started' ? 'color-mix(in srgb, var(--c-amber) 6%, var(--c-card))' : 'var(--c-card)',
                      border: b.status === 'perfect' ? '1.5px solid var(--c-primary-br)' : b.status === 'started' ? '1.5px solid var(--c-amber-br)' : '1.5px solid var(--c-border)'
                    }}>
                    <div className="flex items-center gap-0.5 mb-0.5">
                      <span className="text-lg font-bold leading-none" style={{ color: b.status === 'perfect' ? 'var(--c-primary)' : 'var(--c-text)' }}>{b.id}</span>
                      {b.status === 'perfect' && <Medal className="w-3 h-3" style={{ color: 'var(--c-amber)' }} />}
                    </div>
                    <span className="text-[8px] font-mono uppercase tracking-tight leading-none" style={{ color: 'var(--c-muted)' }}>{b.range}</span>
                    {b.best > 0 && <span className="text-[8px] mt-0.5 font-bold leading-none" style={{ color: b.status === 'perfect' ? 'var(--c-primary)' : 'var(--c-amber)' }}>{b.best}/20</span>}
                  </button>
                ))}
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
                          {testsNote && <button onClick={() => { setTestsNote(''); setLocalTestsNote(''); localStorage.removeItem('tests_personal_note'); }} style={{ color: 'hsl(var(--destructive))' }}><Trash2 className="w-3.5 h-3.5" /></button>}
                          <button onClick={() => { if (isEditingNote) saveNote(localTestsNote); setIsNoteEditing(v => !v); }} className="text-xs font-semibold" style={{ color: 'var(--c-amber)' }}>
                            {isEditingNote ? 'Готово' : 'Править'}
                          </button>
                        </div>
                      </div>
                      {isEditingNote
                        ? <textarea ref={noteRef} value={localTestsNote} onChange={e => setLocalTestsNote(e.target.value)} onBlur={() => saveNote(localTestsNote)}
                            className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm resize-none min-h-[150px]"
                            style={{ color: 'var(--c-text)', caretColor: 'var(--c-amber)' }} autoFocus />
                        : <div className="text-sm prose prose-invert max-w-none break-words whitespace-pre-wrap min-h-[100px]" onClick={() => setIsNoteEditing(true)}>
                            {testsNote ? <ReactMarkdown>{testsNote}</ReactMarkdown> : <p className="italic" style={{ color: 'color-mix(in srgb, var(--c-amber) 35%, transparent)' }}>Нажмите «Править»...</p>}
                          </div>}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    );
  }

  /* РЕЗУЛЬТАТЫ */
  if (completed) {
    const ok = score >= 17; const bad = score < 10;
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-6 animate-in fade-in zoom-in-95 duration-500" style={{ background: 'var(--c-bg)' }}>
        <ToothIcon variant={ok ? 'perfect' : bad ? 'broken' : 'normal'} className="w-32 h-32" style={{ color: ok ? 'var(--c-primary)' : bad ? 'hsl(var(--destructive))' : 'hsl(210 80% 55%)' }} />
        <div className="space-y-2 px-4">
          <h2 className="text-3xl font-bold" style={{ color: ok ? 'var(--c-primary)' : bad ? 'hsl(var(--destructive))' : 'hsl(210 80% 55%)' }}>
            {score === 20 ? 'Идеально! 20/20' : `Блок ${selectedBlock} завершён!`}
          </h2>
          <p style={{ color: 'var(--c-text)' }}>{ok ? 'Блестяще! Знания крепки, как здоровая эмаль!' : bad ? 'Нужно повторить теорию!' : 'Хороший результат!'}</p>
          <p className="text-sm" style={{ color: 'var(--c-muted)' }}>Результат: <span className="font-bold" style={{ color: 'var(--c-text)' }}>{score}</span> из 20</p>
        </div>
        <div className="w-full max-w-sm space-y-3 pt-4 pb-32">
          <button onClick={resetTest} className="w-full h-14 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            style={{ background: 'var(--c-primary)', color: 'hsl(var(--primary-foreground))' }}>
            <RotateCcw className="w-5 h-5" /> Сначала
          </button>
          <button onClick={() => { resetTest(); setSelectedBlock(null); }} className="w-full h-14 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)', color: 'var(--c-muted)' }}>
            <ChevronLeft className="w-5 h-5" /> К выбору блоков
          </button>
        </div>
      </div>
    );
  }

  /* ТЕСТ */
  return (
    <div className="flex flex-col h-full overflow-hidden max-w-full" style={{ background: 'var(--c-bg)' }}>
      {/* Шапка с переключателями */}
      <div className="px-4 py-2.5 sticky top-0 z-20"
        style={{ background: 'color-mix(in srgb, var(--c-bg) 95%, transparent)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderBottom: '1px solid var(--c-border)', paddingTop: 'var(--header-pt)' }}>
        {/* Прогресс */}
        <div className="flex items-center gap-3 mb-2.5">
          <button onClick={() => { resetTest(); setSelectedBlock(null); }} className="p-1.5 rounded-full transition-colors" style={{ color: 'var(--c-muted)' }}>
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] font-mono uppercase tracking-tighter" style={{ color: 'var(--c-muted)' }}>Блок {selectedBlock} · {currentTestIndex + 1}/{blockTests.length}</span>
              <span className="text-[11px] font-mono font-bold" style={{ color: 'var(--c-primary)' }}>✓ {score}</span>
            </div>
            <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--c-border)' }}>
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${((currentTestIndex + 1) / blockTests.length) * 100}%`, background: 'var(--c-primary)' }} />
            </div>
          </div>
        </div>
        {/* Тоглы */}
        <div className="flex gap-2">
          {[
            { label: 'Авто-переход', icon: <Zap className="w-3.5 h-3.5" style={autoNext ? { fill: 'var(--c-primary)', color: 'var(--c-primary)' } : {}} />, active: autoNext, toggle: () => setAutoNext(v => !v), disabled: false },
            { label: 'Перемешать', icon: <Shuffle className="w-3.5 h-3.5" />, active: shuffleOptions, toggle: () => setShuffleOptions(v => !v), disabled: showResult },
          ].map((btn, i) => (
            <button key={i} onClick={btn.toggle} disabled={btn.disabled}
              className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-xl text-[11px] font-bold transition-all active:scale-95 disabled:opacity-40"
              style={btn.active ? { background: 'var(--c-primary-dim)', border: '1px solid var(--c-primary-br)', color: 'var(--c-primary)' } : { background: 'var(--c-card)', border: '1px solid var(--c-border)', color: 'var(--c-muted)' }}>
              {btn.icon} {btn.label}
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-md ml-0.5"
                style={btn.active ? { background: 'var(--c-primary-dim)', color: 'var(--c-primary)' } : { background: 'color-mix(in srgb, var(--c-border) 50%, transparent)', color: 'var(--c-muted)' }}>
                {btn.active ? 'ВКЛ' : 'ВЫКЛ'}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Вопрос + варианты */}
      <ScrollArea className="flex-1 scroll-container">
        <div className="space-y-3 pt-5 px-4 pb-40 mx-auto max-w-2xl">
          <h3 className="text-[17px] font-semibold leading-snug" style={{ color: 'var(--c-text)' }}>{currentTest.question}</h3>
          <div className="space-y-2 pt-1">
            {(shuffleOptions ? shuffled : currentTest.options).map((opt, idx) => {
              const correct = opt === currentTest.correct; const selected = selectedOption === opt;
              return (
                <button key={idx} onClick={() => handleSelect(opt)} disabled={showResult}
                  className="w-full p-4 rounded-xl text-left flex items-center justify-between gap-3 transition-all active:scale-[0.99]"
                  style={{
                    border: showResult && correct ? '1.5px solid var(--c-primary-br)' : showResult && selected ? '1.5px solid hsl(var(--destructive) / 0.4)' : '1.5px solid var(--c-border)',
                    background: showResult && correct ? 'var(--c-primary-dim)' : showResult && selected ? 'hsl(var(--destructive) / 0.08)' : 'var(--c-card)',
                    opacity: showResult && !correct && !selected ? 0.4 : 1,
                  }}>
                  <span className="text-[14px] leading-tight flex-1" style={{ color: showResult && correct ? 'var(--c-primary)' : showResult && selected ? 'hsl(var(--destructive))' : 'var(--c-text)' }}>{opt}</span>
                  {showResult && correct  && <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: 'var(--c-primary)' }} />}
                  {showResult && selected && !correct && <XCircle className="w-5 h-5 shrink-0" style={{ color: 'hsl(var(--destructive))' }} />}
                </button>
              );
            })}
          </div>
          {showResult && (
            <div className="pt-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <button onClick={nextQuestion} className="w-full h-14 rounded-xl font-bold text-base transition-all active:scale-[0.98]"
                style={{ background: 'var(--c-primary)', color: 'hsl(var(--primary-foreground))' }}>
                {currentTestIndex === blockTests.length - 1 ? 'Результаты →' : 'Следующий вопрос →'}
              </button>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
