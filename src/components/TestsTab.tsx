"use client";

import React, { useState, useMemo, useEffect, useRef } from 'react';
import testsData from '@/data/tests.json';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  CheckCircle2, 
  XCircle, 
  RotateCcw, 
  Zap, 
  ChevronLeft, 
  LayoutGrid, 
  Search, 
  Medal, 
  Pencil, 
  Trash2,
  FileText,
  Shuffle
} from 'lucide-react';
import { ToothIcon } from './ToothIcon';
import { cn } from '@/lib/utils';
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
  
  const [localTestsNote, setLocalTestsNote] = useState(testsNote);
  const noteTextareaRef = useRef<HTMLTextAreaElement>(null);
  
  useEffect(() => {
    setLocalTestsNote(testsNote);
  }, [testsNote]);

  useEffect(() => {
    if (isEditingNote && noteTextareaRef.current) {
      noteTextareaRef.current.focus();
      const len = noteTextareaRef.current.value.length;
      noteTextareaRef.current.setSelectionRange(len, len);
    }
  }, [isEditingNote]);

  const saveTestsNote = (text: string) => {
    const sanitized = text.replace(/<[^>]*>?/gm, '');
    setTestsNote(sanitized);
    localStorage.setItem('tests_personal_note', sanitized);
  };
  
  const TESTS_PER_BLOCK = 20;
  const TOTAL_TESTS = testsData.length;
  const TOTAL_BLOCKS = Math.ceil(TOTAL_TESTS / TESTS_PER_BLOCK);

  useEffect(() => {
    const savedScores = localStorage.getItem('test_block_scores');
    if (savedScores) {
      try {
        setBestScores(JSON.parse(savedScores));
      } catch (e) {
        console.error("Failed to parse scores", e);
      }
    }

    const savedNote = localStorage.getItem('tests_personal_note');
    if (savedNote) {
      setTestsNote(savedNote);
    }
  }, []);

  const blocks = useMemo(() => {
    return Array.from({ length: TOTAL_BLOCKS }, (_, i) => {
      const blockId = i + 1;
      const best = bestScores[blockId] || 0;
      let status: 'perfect' | 'started' | 'new' = 'new';
      
      if (best === 20) {
        status = 'perfect';
      } else if (best > 0) {
        status = 'started';
      }

      return {
        id: blockId,
        range: `${i * TESTS_PER_BLOCK + 1} - ${Math.min((i + 1) * TESTS_PER_BLOCK, TOTAL_TESTS)}`,
        best,
        status
      };
    });
  }, [bestScores, TOTAL_BLOCKS, TOTAL_TESTS]);

  const processedTests = useMemo(() => {
    return testsData.map(t => {
      const correctIndex = t.options.findIndex(opt => opt === t.correct);
      return { ...t, correctIndex };
    });
  }, []);

  const blockTests = useMemo(() => {
    if (selectedBlock === null) return [];
    const start = (selectedBlock - 1) * TESTS_PER_BLOCK;
    const end = start + TESTS_PER_BLOCK;
    return processedTests.slice(start, end);
  }, [selectedBlock, processedTests]);

  const searchResults = useMemo(() => {
    if (!search) return [];
    const term = search.toLowerCase();
    return processedTests.filter(t => {
      const idMatch = t.id.toString().includes(term);
      const textMatch = t.question.toLowerCase().includes(term);
      return idMatch || textMatch;
    }).slice(0, 50);
  }, [search, processedTests]);

  const currentTest = blockTests[currentTestIndex];

  const shuffledOptions = useMemo(() => {
    if (!shuffleOptions || !currentTest) return currentTest?.options || [];
    const shuffled = [...currentTest.options];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }, [currentTest?.options, shuffleOptions, currentTestIndex]);

  const nextQuestion = () => {
    if (currentTestIndex < blockTests.length - 1) {
      setCurrentTestIndex(i => i + 1);
      setSelectedOption(null);
      setShowResult(false);
    } else {
      if (selectedBlock !== null) {
        const newBestScores = { ...bestScores };
        if (score > (newBestScores[selectedBlock] || 0)) {
          newBestScores[selectedBlock] = score;
          setBestScores(newBestScores);
          localStorage.setItem('test_block_scores', JSON.stringify(newBestScores));
        }
      }
      setCompleted(true);
    }
  };

  const handleSelect = (optionText: string) => {
    if (showResult) return;
    setSelectedOption(optionText);
    setShowResult(true);
    
    const isCorrect = optionText === currentTest.correct;
    if (isCorrect) {
      setScore(s => s + 1);
      if (autoNext && currentTestIndex < blockTests.length - 1) {
        setTimeout(nextQuestion, 800);
      }
    }
  };

  const resetTest = () => {
    setCurrentTestIndex(0);
    setSelectedOption(null);
    setShowResult(false);
    setScore(0);
    setCompleted(false);
  };

  const startFromQuestion = (id: string) => {
    const index = processedTests.findIndex(t => t.id === id);
    if (index !== -1) {
      const blockNum = Math.floor(index / TESTS_PER_BLOCK) + 1;
      const indexInBlock = index % TESTS_PER_BLOCK;
      setSelectedBlock(blockNum);
      setCurrentTestIndex(indexInBlock);
      setSearch('');
      resetTest();
      setCurrentTestIndex(indexInBlock);
    }
  };

  if (selectedBlock === null) {
    return (
      <div className="flex flex-col h-full bg-background overflow-hidden max-w-full">
        <div className="p-4 space-y-4 bg-background/50 backdrop-blur-md sticky top-0 z-10 border-b border-white/5">
          <div className="flex justify-between items-center px-2">
            <div className="flex items-center gap-3">
              <ToothIcon className="w-10 h-10 text-primary" />
              <h1 className="text-xl font-bold font-headline tracking-tight text-foreground">OrthoByNekruz</h1>
            </div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{TOTAL_TESTS} тестов</p>
          </div>
          <div className="relative mx-2">
            <Input
              placeholder="Поиск по № или тексту..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-12 glass-card border-none focus-visible:ring-primary/50"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          </div>
        </div>

        <ScrollArea className="flex-1 px-4">
          <div className="mx-auto max-w-2xl pt-4 pb-32"> {/* pb-32 позволяет контенту прокрутиться выше навигации */}
            {search ? (
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4 px-2">Результаты поиска</h3>
                {searchResults.length > 0 ? (
                  searchResults.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => startFromQuestion(t.id)}
                      className="w-full p-4 glass-card rounded-xl text-left border border-white/5 hover:border-primary/50 transition-all active:scale-[0.98] flex gap-4 max-w-full overflow-hidden"
                    >
                      <span className="text-xs font-mono text-primary bg-primary/10 px-2 py-1 rounded h-fit shrink-0">{t.id}</span>
                      <span className="text-sm line-clamp-2 break-words">{t.question}</span>
                    </button>
                  ))
                ) : (
                  <p className="text-center py-10 text-muted-foreground opacity-50">Ничего не найдено</p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {blocks.map((block) => (
                  <button
                    key={block.id}
                    onClick={() => setSelectedBlock(block.id)}
                    className={cn(
                      "flex flex-col items-center justify-center p-2 rounded-2xl border-2 transition-all active:scale-95 group relative overflow-hidden h-24",
                      block.status === 'perfect' 
                        ? "bg-emerald-500/10 border-emerald-500/50 shadow-emerald-500/10 shadow-lg" 
                        : block.status === 'started'
                        ? "bg-amber-500/5 border-amber-500/30"
                        : "bg-card border-white/5 hover:border-primary/50"
                    )}
                  >
                    <div className="absolute top-0 right-0 p-1 opacity-10">
                        {block.status === 'perfect' ? <Medal className="w-8 h-8 text-yellow-400" /> : <LayoutGrid className="w-8 h-8" />}
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn(
                        "text-2xl font-bold",
                        block.status === 'perfect' ? "text-emerald-500" : "text-primary"
                      )}>
                        {block.id}
                      </span>
                      {block.status === 'perfect' && <Medal className="w-4 h-4 text-yellow-500 drop-shadow-glow" />}
                    </div>
                    <span className="text-[9px] text-muted-foreground font-mono uppercase tracking-widest">{block.range}</span>
                    {block.best > 0 && (
                      <span className={cn(
                        "text-[9px] mt-1 font-bold uppercase tracking-tight",
                        block.status === 'perfect' ? "text-emerald-500" : "text-amber-500"
                      )}>
                        {block.best}/20
                      </span>
                    )}
                  </button>
                ))}

                <Dialog>
                  <DialogTrigger asChild>
                    <button className="flex flex-col items-center justify-center p-2 rounded-2xl border-2 border-amber-500/20 bg-amber-500/5 hover:border-amber-500/50 transition-all active:scale-95 group relative overflow-hidden h-24">
                      <div className="absolute top-0 right-0 p-1 opacity-10">
                        <Pencil className="w-8 h-8 text-amber-400" />
                      </div>
                      <FileText className="w-6 h-6 text-amber-500 mb-1" />
                      <span className="text-[9px] text-amber-500/70 font-mono uppercase tracking-widest">Заметки</span>
                    </button>
                  </DialogTrigger>
                  <DialogContent className="bg-background border-white/10 max-w-lg w-[95vw] rounded-3xl p-6">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2 text-amber-500 font-headline uppercase tracking-wider text-sm">
                        <Pencil className="w-4 h-4" /> Мои заметки
                      </DialogTitle>
                    </DialogHeader>
                    <div className="mt-4 p-4 rounded-xl bg-amber-900/10 border border-amber-500/20 w-full">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-amber-500/50 text-[10px] font-bold uppercase tracking-widest">Текст заметки</span>
                        <div className="flex gap-2">
                          {testsNote && (
                            <button onClick={() => {setTestsNote(''); setLocalTestsNote(''); localStorage.removeItem('tests_personal_note');}} className="text-muted-foreground/50 hover:text-destructive">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button onClick={() => {if (isEditingNote) saveTestsNote(localTestsNote); setIsNoteEditing(!isEditingNote);}} className="text-amber-500/50 hover:text-amber-500 text-xs font-medium">
                            {isEditingNote ? 'Готово' : 'Править'}
                          </button>
                        </div>
                      </div>
                      {isEditingNote ? (
                        <textarea
                          ref={noteTextareaRef}
                          value={localTestsNote}
                          onChange={(e) => setLocalTestsNote(e.target.value)}
                          onBlur={() => saveTestsNote(localTestsNote)}
                          className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm text-foreground/90 resize-none min-h-[150px]"
                          autoFocus
                        />
                      ) : (
                        <div className="text-sm prose prose-invert prose-amber max-w-none break-words whitespace-pre-wrap min-h-[100px]" onClick={() => setIsNoteEditing(true)}>
                          {testsNote ? <ReactMarkdown>{testsNote}</ReactMarkdown> : <p className="text-amber-500/20 italic">Нажмите "Править"...</p>}
                        </div>
                      )}
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

  if (completed) {
    const isExcellent = score >= 17;
    const isCritical = score < 10;
    let motivation = "Хороший результат! Давай дотянем до идеала.";
    let iconColor = "text-blue-400";

    if (isExcellent) {
      motivation = "Блестяще! Твои знания крепки, как здоровая эмаль!";
      iconColor = "text-emerald-400";
    } else if (isCritical) {
      motivation = "Нужно срочно повторить теорию! Попробуй снова.";
      iconColor = "text-red-500";
    }

    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-6 animate-in fade-in zoom-in-95 duration-500 overflow-hidden">
        <ToothIcon variant={isExcellent ? 'perfect' : isCritical ? 'broken' : 'normal'} className={cn("w-32 h-32", iconColor)} />
        <div className="space-y-3 px-4">
          <h2 className={cn("text-3xl font-bold font-headline", isExcellent ? "text-emerald-400" : isCritical ? "text-red-500" : "text-blue-400")}>
            {score === 20 ? 'Идеально! 20/20' : `Блок ${selectedBlock} завершен!`}
          </h2>
          <p className="text-foreground/90 font-medium">{motivation}</p>
          <p className="text-muted-foreground text-sm">Ваш результат: <span className="font-bold text-foreground">{score}</span> из 20</p>
        </div>
        <div className="w-full max-w-sm space-y-3 pt-4 pb-32"> {/* pb-32 чтобы кнопки не перекрывались */}
          <Button onClick={resetTest} className="w-full h-14 bg-primary rounded-2xl font-bold">
            <RotateCcw className="w-5 h-5 mr-2" /> Сначала
          </Button>
          <Button variant="outline" onClick={() => setSelectedBlock(null)} className="w-full h-14 rounded-2xl border-white/10">
            <ChevronLeft className="w-5 h-5 mr-2" /> К выбору блоков
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden max-w-full">
      <div className="py-2 px-4 border-b border-white/5 bg-background/50 backdrop-blur-md sticky top-0 z-20 flex items-center gap-4">
        <button onClick={() => setSelectedBlock(null)} className="p-1 -ml-1 hover:bg-white/5 rounded-full transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 overflow-hidden">
            <div className="flex justify-between items-center mb-0.5">
                <span className="text-[9px] font-mono text-muted-foreground truncate uppercase tracking-tighter">Блок {selectedBlock} • {currentTestIndex + 1}/{blockTests.length}</span>
                <span className="text-[9px] font-mono text-primary font-bold ml-2">Счет: {score}</span>
            </div>
            <div className="w-full h-0.5 bg-muted rounded-full overflow-hidden">
                <div 
                    className="h-full bg-primary transition-all duration-500" 
                    style={{ width: `${((currentTestIndex + 1) / blockTests.length) * 100}%` }} 
                />
            </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-4 pt-4 px-4 pb-40 mx-auto max-w-2xl"> {/* pb-40 гарантирует, что нижние кнопки теста всегда будут доступны для прокрутки */}
          <h3 className="text-[18px] font-semibold leading-tight font-headline text-foreground/90 break-words">
            {currentTest.question}
          </h3>
          
          <div className="space-y-2">
            {(shuffleOptions ? shuffledOptions : currentTest.options).map((option, idx) => {
              const isCorrect = option === currentTest.correct;
              const isSelected = selectedOption === option;
              return (
                <button
                  key={idx}
                  onClick={() => handleSelect(option)}
                  disabled={showResult}
                  className={cn(
                    "w-full p-4 rounded-xl border-[1.5px] text-left transition-all flex items-center justify-between gap-3",
                    !showResult && "border-white/10 bg-card hover:border-primary/30",
                    showResult && isCorrect && "border-emerald-500/50 bg-emerald-500/20",
                    showResult && isSelected && !isCorrect && "border-red-500/50 bg-red-500/20",
                    showResult && !isSelected && !isCorrect && "opacity-40 border-white/5"
                  )}
                >
                  <span className="text-[14.5px] leading-tight flex-1">{option}</span>
                  {showResult && isCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
                  {showResult && isSelected && !isCorrect && <XCircle className="w-4 h-4 text-red-500 shrink-0" />}
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-3 pt-2">
            {showResult && (
              <Button onClick={nextQuestion} className="w-full h-14 bg-primary rounded-xl font-bold">
                {currentTestIndex === blockTests.length - 1 ? 'Результаты' : 'Следующий вопрос'}
              </Button>
            )}
            
            <div className="flex gap-2">
                <Button
                    variant={shuffleOptions ? "default" : "outline"}
                    onClick={() => setShuffleOptions(!shuffleOptions)}
                    className="flex-1 h-12 rounded-xl text-xs"
                    disabled={showResult}
                >
                    <Shuffle className="w-3.5 h-3.5 mr-1.5" />
                    Перемешать
                </Button>
                <Button
                    variant={autoNext ? "default" : "outline"}
                    onClick={() => setAutoNext(!autoNext)}
                    className="flex-1 h-12 rounded-xl text-xs"
                >
                    <Zap className={cn("w-3.5 h-3.5 mr-1.5", autoNext && "fill-current text-yellow-400")} />
                    Авто-переход
                </Button>
            </div>
          </div>
        </div>
      </ScrollArea>
      
      <style jsx global>{`
        .markdown-note p { margin-bottom: 0.5rem; word-break: break-word; white-space: pre-wrap; }
        .markdown-note p:last-child { margin-bottom: 0; }
        .markdown-note ul, .markdown-note ol { margin-left: 1.25rem; margin-bottom: 0.5rem; }
        .markdown-note li { margin-bottom: 0.25rem; word-break: break-word; }
      `}</style>
    </div>
  );
};