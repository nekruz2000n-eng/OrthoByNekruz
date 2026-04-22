"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import tasksData from '@/data/tasks.json';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from '@/components/ui/accordion';
import { Sparkles, Loader2, Search, CheckCircle2, Circle, BookOpen, X, Pencil, Trash2, AlertCircle } from 'lucide-react';
import { ToothIcon } from './ToothIcon';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { analyzeClinicalCase } from '@/app/actions/ai-actions';

export const TasksTab = () => {
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [resolvedIds, setResolvedIds] = useState<Set<number>>(new Set());
  const [userNotes, setUserNotes] = useState<Record<number, string>>({});
  const [isLoaded, setIsLoaded] = useState(false);
  const [readingTask, setReadingTask] = useState<any | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const savedTasks = localStorage.getItem('resolvedTasks');
    const savedNotes = localStorage.getItem('userTaskNotes');
    
    if (savedTasks) {
      try {
        setResolvedIds(new Set(JSON.parse(savedTasks)));
      } catch (e) {
        console.error("Failed to parse resolved tasks", e);
      }
    }
    
    if (savedNotes) {
      try {
        setUserNotes(JSON.parse(savedNotes));
      } catch (e) {
        console.error("Failed to parse user task notes", e);
      }
    }
    
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('resolvedTasks', JSON.stringify(Array.from(resolvedIds)));
      localStorage.setItem('userTaskNotes', JSON.stringify(userNotes));
    }
  }, [resolvedIds, userNotes, isLoaded]);

  const toggleResolved = (id: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setResolvedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleAiAnalyze = async (textToAnalyze: string) => {
    setIsAiLoading(true);
    setAiResult(null);
    setAiError(null);
    setIsAiPanelOpen(true);

    try {
      const result = await analyzeClinicalCase(textToAnalyze);
      setAiResult(result);
    } catch (error: any) {
      console.error(error);
      setAiError(error.message);
      toast({ 
        variant: "destructive", 
        title: "Ошибка анализа", 
        description: error.message 
      });
    } finally {
      setIsAiLoading(false);
    }
  };

  const updateNote = (id: number, text: string) => {
    const sanitized = text.replace(/<[^>]*>?/gm, '');
    setUserNotes(prev => ({
      ...prev,
      [id]: sanitized
    }));
  };

  const clearNote = (id: number) => {
    setUserNotes(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return tasksData.filter(task => {
      const idMatch = task.id.toString() === term;
      const textMatch = task.question.toLowerCase().includes(term);
      return !search || idMatch || textMatch;
    });
  }, [search]);

  const progress = useMemo(() => {
    if (tasksData.length === 0) return 0;
    return (resolvedIds.size / tasksData.length) * 100;
  }, [resolvedIds]);

  const formatText = (text: string) => {
    return (
      <div className="w-full break-words whitespace-pre-wrap [word-break:break-word]">
        {text.split('\n').map((line, i) => (
          <React.Fragment key={i}>
            {line.split('**').map((part, j) => 
              j % 2 === 1 ? <b key={j} className="text-primary">{part}</b> : part
            )}
            <br />
          </React.Fragment>
        ))}
      </div>
    );
  };

  // Исправленный компонент заметки (без потери фокуса)
  const PersonalNote = ({ id }: { id: number }) => {
    const [isEditing, setIsEditing] = useState(false);
    const note = userNotes[id] || '';
    const [localNote, setLocalNote] = useState(note);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
      setLocalNote(note);
    }, [note]);

    useEffect(() => {
      if (isEditing && textareaRef.current) {
        textareaRef.current.focus();
        const len = textareaRef.current.value.length;
        textareaRef.current.setSelectionRange(len, len);
      }
    }, [isEditing, localNote]);

    const handleSave = () => {
      if (localNote !== note) {
        updateNote(id, localNote);
      }
    };

    return (
      <div className="mt-6 p-4 rounded-xl bg-amber-900/10 border border-amber-500/20 relative group w-full">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-amber-500 text-xs font-bold uppercase tracking-widest">
            <Pencil className="w-3.5 h-3.5" />
            Моя заметка
          </div>
          <div className="flex gap-2">
            {note && (
              <button 
                onClick={() => clearNote(id)}
                className="text-muted-foreground/50 hover:text-destructive transition-colors"
                title="Очистить заметку"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button 
              onClick={() => {
                if (isEditing) handleSave();
                setIsEditing(!isEditing);
              }}
              className="text-amber-500/50 hover:text-amber-500 transition-colors text-xs font-medium"
            >
              {isEditing ? 'Готово' : 'Править'}
            </button>
          </div>
        </div>

        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={localNote}
            onChange={(e) => setLocalNote(e.target.value)}
            onBlur={handleSave}
            placeholder="Добавьте свои комментарии здесь..."
            className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm text-foreground/90 resize-none min-h-[60px] placeholder:text-amber-500/20"
            autoFocus
          />
        ) : (
          <div className="text-sm prose prose-invert prose-amber max-w-none break-words whitespace-pre-wrap">
            {note ? (
              <ReactMarkdown>
                {note}
              </ReactMarkdown>
            ) : (
              <p className="text-amber-500/20 italic cursor-text" onClick={() => setIsEditing(true)}>
                Нажмите, чтобы добавить свои мысли...
              </p>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
<div className="flex flex-col h-full bg-background overflow-hidden max-w-full">      <div className="p-4 bg-background/50 backdrop-blur-md sticky top-0 z-10 border-b border-white/5">
        <div className="flex justify-between items-center px-2">
          <div className="flex items-center gap-3">
            <ToothIcon className="w-8 h-8 text-primary" />
            <h1 className="text-xl font-bold font-headline tracking-tight text-foreground">OrthoByNekruz</h1>
          </div>
          <div className="text-right flex flex-col items-end">
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest block mb-1">
              {resolvedIds.size}/{tasksData.length}
            </span>
            <Progress value={progress} className="h-0.5 w-10 bg-white/5" />
          </div>
        </div>
        
        <div className="relative mx-2 mt-4">
          <Input
            placeholder="Поиск по № или условию..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-12 glass-card border-none focus-visible:ring-primary/50"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        </div>
      </div>

      <ScrollArea className="flex-1 scroll-container">
<div className="py-4 px-4 mx-auto max-w-2xl w-full pb-40">          {filtered.length > 0 ? (
            <Accordion type="single" collapsible className="space-y-3 w-full">
              {filtered.map((task) => {
                const isResolved = resolvedIds.has(task.id);
                return (
                  <AccordionItem 
                    key={task.id} 
                    value={task.id.toString()}
                    className={cn(
                      "border-none glass-card rounded-xl transition-all duration-300 w-full max-w-full",
                      isResolved && "bg-emerald-500/5 border border-emerald-500/20"
                    )}
                  >
                    <AccordionTrigger className="px-5 py-4 hover:no-underline group">
                      <div className="flex flex-col items-start text-left gap-1 pr-4 w-full overflow-hidden">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "text-[10px] font-mono px-2 py-0.5 rounded",
                            isResolved ? "bg-emerald-500 text-white" : "bg-primary/10 text-primary"
                          )}>
                            Задача № {task.id}
                          </span>
                          {isResolved && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                        </div>
                        <span className="text-sm font-medium line-clamp-2 text-foreground/90 break-words w-full text-left">
                          {task.question}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-5 pb-5 pt-0 w-full overflow-hidden">
                      <div className="space-y-4 w-full max-w-full">
                        <div className="p-4 rounded-lg bg-white/5 border border-white/5 w-full">
                          <h3 className="font-semibold text-primary mb-2 text-xs uppercase tracking-wider">Условие:</h3>
                          <div className="text-sm leading-relaxed text-foreground/90 font-medium w-full">
                            {formatText(task.question)}
                          </div>
                        </div>
                        
                        <div className="p-4 rounded-lg bg-white/5 border border-white/5 w-full">
                          <h3 className="font-semibold text-primary mb-2 text-xs uppercase tracking-wider">Ответ:</h3>
                          <div className="text-sm leading-relaxed text-foreground/80 w-full">
                            {formatText(task.answer)}
                          </div>
                        </div>

                        <PersonalNote id={task.id} />

                        <div className="flex flex-wrap gap-2 w-full mt-4">
                          <Button
                            variant="outline"
                            className="flex-1 min-w-[140px] h-11 rounded-xl gap-2 border-primary/30 text-primary hover:bg-primary/10"
                            onClick={() => setReadingTask(task)}
                          >
                            <BookOpen className="w-4 h-4" />
                            Режим чтения
                          </Button>
                          
                          <Button
                            variant={isResolved ? "default" : "outline"}
                            className={cn(
                              "flex-1 min-w-[140px] h-11 rounded-xl gap-2 transition-all active:scale-[0.98]",
                              isResolved ? "bg-emerald-500 hover:bg-emerald-600 text-white" : "border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10"
                            )}
                            onClick={(e) => toggleResolved(task.id, e)}
                          >
                            {isResolved ? (
                              <>
                                <CheckCircle2 className="w-4 h-4" />
                                Решено
                              </>
                            ) : (
                              <>
                                <Circle className="w-4 h-4" />
                                Изучил
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground space-y-2 opacity-50">
              <Search className="w-12 h-12" />
              <p>Задачи не найдены</p>
            </div>
          )}
        </div>
      </ScrollArea>

      <AnimatePresence>
        {readingTask && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-[100] bg-background flex flex-col p-6 overflow-hidden max-w-full"
          >
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-3">
                <ToothIcon className="w-10 h-10 text-primary" />
                <span className="text-xs font-mono px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-full uppercase tracking-wider">
                  Задача № {readingTask.id}
                </span>
              </div>
              <button 
                onClick={() => setReadingTask(null)}
                className="p-3 bg-white/5 rounded-full hover:bg-white/10 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <ScrollArea className="flex-1 scroll-container">
              <div id="content" className="space-y-10 pb-32 max-w-2xl mx-auto w-full overflow-x-hidden px-1">
                <div className="space-y-4 w-full">
                  <h2 className="text-xl md:text-2xl font-bold font-headline leading-tight text-foreground break-words whitespace-pre-wrap">
                    {readingTask.question}
                  </h2>
                </div>

                <div className="space-y-4 w-full">
                  <div className="flex items-center gap-2 text-primary font-bold text-sm uppercase tracking-widest">
                    <CheckCircle2 className="w-4 h-4" />
                    Решение
                  </div>
                  <div className="text-[16px] leading-[1.4] text-foreground/80 font-light selection:bg-primary/30 w-full break-words whitespace-pre-wrap">
                    {formatText(readingTask.answer)}
                  </div>
                </div>

                <PersonalNote id={readingTask.id} />
              </div>
            </ScrollArea>

            <button
              id="ai-analyze-btn"
              onClick={() => handleAiAnalyze(readingTask.question + "\n" + readingTask.answer)}
              disabled={isAiLoading}
              className="fixed bottom-36 right-6 w-14 h-14 bg-primary rounded-full flex items-center justify-center shadow-lg shadow-primary/30 hover:scale-110 active:scale-95 transition-all z-[110] border-4 border-background"
            >
              {isAiLoading ? (
                <Loader2 className="w-7 h-7 text-primary-foreground animate-spin" />
              ) : (
                <Sparkles className="w-7 h-7 text-primary-foreground" />
              )}
            </button>

            <div className="mt-auto pt-6 border-t border-white/5 bg-background flex gap-3 pb-safe">
              <Button
                size="lg"
                className="flex-1 h-16 rounded-2xl gap-3 text-lg font-bold bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20"
                onClick={() => {
                  toggleResolved(readingTask.id);
                  setReadingTask(null);
                }}
              >
                <CheckCircle2 className="w-6 h-6" />
                Решено
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAiPanelOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isAiLoading && setIsAiPanelOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150]"
            />
            <motion.div
              id="ai-modal"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 h-[80vh] bg-card border-t border-white/10 rounded-t-[32px] z-[160] flex flex-col p-6 overflow-hidden pb-safe"
            >
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2 text-primary font-bold uppercase tracking-widest text-sm">
                  <Sparkles className="w-5 h-5" />
                  Инженерный Анализ 
                </div>
                (Некруз еще учится как решить эту часть)
                <button 
                  onClick={() => setIsAiPanelOpen(false)}
                  className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <ScrollArea className="flex-1 scroll-container">
                {isAiLoading ? (
                  <div className="flex flex-col items-center justify-center h-64 space-y-4">
                    <Loader2 className="w-10 h-10 text-primary animate-spin" />
                    <p className="text-muted-foreground animate-pulse text-center">Думаю...<br/><span className="text-[10px]">Groq анализирует конструкцию</span></p>
                  </div>
                ) : aiError ? (
                  <div className="p-6 rounded-2xl bg-destructive/10 border border-destructive/20 text-center space-y-4">
                    <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
                    <div className="space-y-2">
                      <h3 className="font-bold text-destructive">Ошибка AI</h3>
                      <p className="text-sm text-foreground/70">{aiError}</p>
                    </div>
                  </div>
                ) : (
                  <div className="prose prose-invert prose-blue max-w-none pb-10">
                    <div className="text-base leading-[1.4] text-foreground/90 whitespace-pre-wrap">
                      {aiResult ? (
                        <ReactMarkdown>
                          {aiResult}
                        </ReactMarkdown>
                      ) : (
                        "Нет данных для отображения."
                      )}
                    </div>
                  </div>
                )}
              </ScrollArea>
              
              <div className="mt-4 pt-4 border-t border-white/5">
                <Button 
                  onClick={() => setIsAiPanelOpen(false)}
                  className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-transform active:scale-95"
                >
                  Понятно
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .markdown-note p { margin-bottom: 0.5rem; word-break: break-word; white-space: pre-wrap; }
        .markdown-note p:last-child { margin-bottom: 0; }
        .markdown-note ul, .markdown-note ol { margin-left: 1.25rem; margin-bottom: 0.5rem; }
        .markdown-note li { margin-bottom: 0.25rem; word-break: break-word; }
      `}</style>
    </div>
  );
};