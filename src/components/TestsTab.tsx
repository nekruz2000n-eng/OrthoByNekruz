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
  FileText
} from 'lucide-react';
import { ToothIcon } from './ToothIcon';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';

export const TestsTab = () => {
  const [selectedBlock, setSelectedBlock] = useState<number | null>(null);
  const [currentTestIndex, setCurrentTestIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [autoNext, setAutoNext] = useState(false);
  const [search, setSearch] = useState('');
  const [bestScores, setBestScores] = useState<Record<number, number>>({});
  const [testsNote, setTestsNote] = useState('');
  const [isEditingNote, setIsNoteEditing] = useState(false);
  // ... после существующих useState
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
}, [isEditingNote, localTestsNote]);

// Функция сохранения (вызывается при потере фокуса или по кнопке "Готово")
const saveTestsNote = (text: string) => {
  const sanitized = text.replace(/<[^>]*>?/gm, '');
  setTestsNote(sanitized);
  localStorage.setItem('tests_personal_note', sanitized);
};
  const TESTS_PER_BLOCK = 20;
  const TOTAL_TESTS = testsData.length;
  const TOTAL_BLOCKS = Math.ceil(TOTAL_TESTS / TESTS_PER_BLOCK);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const handleNoteChange = (text: string) => {
    const sanitized = text.replace(/<[^>]*>?/gm, '');
    setTestsNote(sanitized);
    localStorage.setItem('tests_personal_note', sanitized);
  };

  const clearNote = () => {
    setTestsNote('');
    localStorage.removeItem('tests_personal_note');
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [testsNote, isEditingNote]);

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

  const handleSelect = (index: number) => {
    if (showResult) return;
    setSelectedOption(index);
    setShowResult(true);
    
    const isCorrect = index === currentTest.correctIndex;
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
      <div className="flex flex-col h-full bg-background pb-32 overflow-hidden max-w-full">
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

        <ScrollArea className="flex-1 scroll-container px-4">
          <div className="mx-auto max-w-2xl pt-4">
            {search ? (
              <div className="space-y-3 pb-8">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">Результаты поиска</h3>
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
              <div className="grid grid-cols-3 gap-3 pb-32">
                {blocks.map((block) => (
                  <button
                    key={block.id}
                    onClick={() => setSelectedBlock(block.id)}
                    className={cn(
                      "flex flex-col items-center justify-center p-2 rounded-2xl border-2 transition-all active:scale-95 group relative overflow-hidden",
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
                        "text-2xl font-bold transition-transform duration-300 group-hover:scale-110",
                        block.status === 'perfect' ? "text-emerald-500" : "text-primary"
                      )}>
                        {block.id}
                      </span>
                      {block.status === 'perfect' && <Medal className="w-4 h-4 text-yellow-500 drop-shadow-glow" />}
                    </div>
                    <span className="text-[9px] text-muted-foreground font-mono uppercase tracking-widest">{block.range}</span>
                    {block.best > 0 && (
                      <span className={cn(
                        "text-[9px] mt-2 font-bold uppercase tracking-tight",
                        block.status === 'perfect' ? "text-emerald-500" : "text-amber-500"
                      )}>
                        Лучший: {block.best}/20
                      </span>
                    )}
                  </button>
                ))}

                {/* Personal Note Button */}
                <Dialog>
                  <DialogTrigger asChild>
                    <button
                      className="flex flex-col items-center justify-center p-2 rounded-2xl border-2 border-amber-500/20 bg-amber-500/5 hover:border-amber-500/50 transition-all active:scale-95 group relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 p-1 opacity-10">
                        <Pencil className="w-8 h-8 text-amber-400" />
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-2xl font-bold text-amber-500">
                          <FileText className="w-6 h-6" />
                        </span>
                      </div>
                      <span className="text-[9px] text-amber-500/70 font-mono uppercase tracking-widest">Заметки</span>
                    </button>
                  </DialogTrigger>
                  <DialogContent className="bg-background border-white/10 max-w-lg w-[95vw] rounded-3xl p-6">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2 text-amber-500 font-headline uppercase tracking-wider text-sm">
                        <Pencil className="w-4 h-4" />
                        Мои заметки к тестам
                      </DialogTitle>
                    </DialogHeader>
                    <div className="mt-4 p-4 rounded-xl bg-amber-900/10 border border-amber-500/20 group w-full">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-amber-500/50 text-[10px] font-bold uppercase tracking-widest">Текст заметки (Markdown)</span>
                       <div className="flex gap-2">
                       {testsNote && (
                            <button 
                                onClick={() => {
                                    setTestsNote('');
                                   setLocalTestsNote('');
                                   localStorage.removeItem('tests_personal_note');
                                }}
                                       className="text-muted-foreground/50 hover:text-destructive transition-colors"
                                                title="Очистить заметку"
                                                  >
                                                  <Trash2 className="w-3.5 h-3.5" />
                             </button>
                                       )}
                               <button 
                                    onClick={() => {
                                         if (isEditingNote) {
                                                // При выходе из режима редактирования сохраняем текущее локальное значение
                                          saveTestsNote(localTestsNote);
                                            }
                                        setIsNoteEditing(!isEditingNote);
                                          }}
                                             className="text-amber-500/50 hover:text-amber-500 transition-colors text-xs font-medium"
                                               >
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
      placeholder="Добавьте общие примечания к разделу тестов здесь..."
      className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm text-foreground/90 resize-none min-h-[150px] placeholder:text-amber-500/20"
      autoFocus
    />
  ) : (
    <div 
      className="text-sm prose prose-invert prose-amber max-w-none break-words whitespace-pre-wrap min-h-[100px] cursor-text"
      onClick={() => setIsNoteEditing(true)}
    >
      {testsNote ? (
        <ReactMarkdown>
          {testsNote}
        </ReactMarkdown>
      ) : (
        <p className="text-amber-500/20 italic">
          Нажмите "Править", чтобы добавить общую заметку для подготовки к тестам...
        </p>
      )}
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
    const isMedium = score >= 10 && score < 17;
    const isCritical = score < 10;

    let motivation = "Хороший результат! Давай дотянем до идеала.";
    let variant: 'normal' | 'broken' | 'perfect' = 'normal';
    let iconColor = "text-blue-400";
    let iconAnim = "";

    if (isExcellent) {
      motivation = "Блестяще! Твои знания крепки, как здоровая эмаль!";
      variant = 'perfect';
      iconColor = "text-emerald-400";
      iconAnim = "animate-pulse";
    } else if (isCritical) {
      motivation = "Нужно срочно повторить теорию! Попробуй снова.";
      variant = 'broken';
      iconColor = "text-red-500";
      iconAnim = "animate-shake";
    }

    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-6 animate-in fade-in zoom-in-95 duration-500 overflow-hidden">
        <div className="relative">
          <ToothIcon 
            variant={variant} 
            className={cn("w-32 h-32", iconColor, iconAnim)} 
          />
          {isExcellent && (
            <div className="absolute inset-0 bg-emerald-500/10 blur-3xl rounded-full -z-10 animate-pulse" />
          )}
        </div>
        
        <div className="space-y-3 px-4">
          <h2 className={cn(
            "text-3xl font-bold font-headline",
            isExcellent ? "text-emerald-400" : isCritical ? "text-red-500" : "text-blue-400"
          )}>
            {score === 20 ? 'Идеально! 20/20' : `Блок ${selectedBlock} завершен!`}
          </h2>
          <p className="text-foreground/90 font-medium break-words">{motivation}</p>
          <p className="text-muted-foreground text-sm">Ваш результат: <span className="font-bold text-foreground">{score}</span> из {blockTests.length}</p>
        </div>

        <div className="w-full max-w-sm space-y-3 pt-4 pb-32">
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
    <div className="flex flex-col h-full bg-background pb-32 overflow-hidden max-w-full">
      <div className="py-2 px-4 border-b border-white/5 bg-background/50 backdrop-blur-md sticky top-0 z-10 flex items-center gap-4">
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

      <ScrollArea className="flex-1 scroll-container px-4">
        <div className="space-y-3 animate-in fade-in duration-500 pt-3 mx-auto max-w-2xl overflow-hidden pb-32">
          <h3 className="text-[18px] font-semibold leading-[1.2] font-headline break-words whitespace-pre-wrap mb-[10px] text-foreground/90">
            {currentTest.question}
          </h3>
          
          <div className="space-y-2 max-w-full">
            {currentTest.options.map((option, idx) => {
              const isCorrect = idx === currentTest.correctIndex;
              const isSelected = idx === selectedOption;
              
              return (
                <button
                  key={idx}
                  onClick={() => handleSelect(idx)}
                  disabled={showResult}
                  className={cn(
                    "w-full p-[10px] rounded-xl border-[1.5px] text-left transition-all flex items-center justify-between gap-2.5",
                    !showResult && "border-white/10 bg-card hover:border-primary/30",
                    showResult && isCorrect && "border-emerald-500/50 bg-emerald-500/20",
                    showResult && isSelected && !isCorrect && "border-red-500/50 bg-red-500/20",
                    showResult && !isSelected && !isCorrect && "opacity-40 border-white/5"
                  )}
                >
                  <span className="text-[14.5px] leading-tight break-words flex-1 text-foreground/80">{option}</span>
                  {showResult && isCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
                  {showResult && isSelected && !isCorrect && <XCircle className="w-4 h-4 text-red-500 shrink-0" />}
                </button>
              );
            })}
          </div>

          <div className="flex gap-2 pt-1 max-w-full">
            {showResult && (
              <Button onClick={nextQuestion} className="flex-1 h-12 bg-primary rounded-xl font-bold text-sm">
                {currentTestIndex === blockTests.length - 1 ? 'Результаты' : 'Далее'}
              </Button>
            )}
            <Button
              variant={autoNext ? "default" : "outline"}
              onClick={() => setAutoNext(!autoNext)}
              className={cn("h-12 px-5 rounded-xl text-sm", !showResult && "w-full border-white/10")}
            >
              <Zap className={cn("w-3.5 h-3.5 mr-1.5", autoNext && "fill-current text-yellow-400")} />
              {autoNext ? 'Авто: ВКЛ' : 'Авто-переход'}
            </Button>
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
