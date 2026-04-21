"use client";
import React, { useState, useEffect, useMemo, useRef } from 'react';
import questionsData from '@/data/questions.json';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from '@/components/ui/accordion';
import { Search, Book, CheckCircle2, Circle, BookOpen, X, Pencil, Trash2 } from 'lucide-react';
import { ToothIcon } from './ToothIcon';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';

export const QuestionsTab = () => {
  const [search, setSearch] = useState('');
  const [studiedIds, setStudiedIds] = useState<Set<number>>(new Set());
  const [userNotes, setUserNotes] = useState<Record<number, string>>({});
  const [isLoaded, setIsLoaded] = useState(false);
  const [readingQuestion, setReadingQuestion] = useState<any | null>(null);

  useEffect(() => {
    const savedStudied = localStorage.getItem('studiedQuestions');
    const savedNotes = localStorage.getItem('userQuestionNotes');
    
    if (savedStudied) {
      try {
        setStudiedIds(new Set(JSON.parse(savedStudied)));
      } catch (e) {
        console.error("Failed to parse studied questions", e);
      }
    }
    
    if (savedNotes) {
      try {
        setUserNotes(JSON.parse(savedNotes));
      } catch (e) {
        console.error("Failed to parse user notes", e);
      }
    }
    
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('studiedQuestions', JSON.stringify(Array.from(studiedIds)));
      localStorage.setItem('userQuestionNotes', JSON.stringify(userNotes));
    }
  }, [studiedIds, userNotes, isLoaded]);

  const toggleStudied = (id: number) => {
    setStudiedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    if (readingQuestion && readingQuestion.id === id) {
      setReadingQuestion(null);
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
    return questionsData.filter(q => {
      const idMatch = q.id.toString() === term;
      const textMatch = q.question.toLowerCase().includes(term);
      return !search || idMatch || textMatch;
    });
  }, [search]);

  const progress = useMemo(() => {
    if (questionsData.length === 0) return 0;
    return (studiedIds.size / questionsData.length) * 100;
  }, [studiedIds]);

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

  const getCleanPreview = (text: string) => {
    return text.replace(/\*\*/g, '').trim();
  };

  // Компонент заметки (исправлен, без лишних скобок)
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
              onClick={() => setIsEditing(!isEditing)}
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
            onBlur={() => updateNote(id, localNote)}
            placeholder="Добавьте свои примечания здесь... (поддерживается Markdown)"
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
              <p className="text-muted-foreground italic">Нет примечаний</p>
            )}
          </div>
        )}
      </div>
    );
  };

  // Основной return
  return (
    <div className="flex flex-col h-full bg-background pb-32 max-w-full overflow-hidden">
      <div className="p-4 space-y-4 bg-background/50 backdrop-blur-md sticky top-0 z-10 border-b border-white/5">
        <div className="flex justify-between items-center px-2">
          <div className="flex items-center gap-3">
            <ToothIcon className="w-10 h-10 text-primary" />
            <h1 className="text-2xl font-bold font-headline tracking-tight text-foreground">OrthoByNekruz</h1>
          </div>
          <div className="text-right flex flex-col items-end">
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest block mb-1">
              {studiedIds.size}/{questionsData.length}
            </span>
            <Progress value={progress} className="h-0.5 w-10 bg-white/5" />
          </div>
        </div>
        
        <div className="relative mx-2">
          <Input
            placeholder="Поиск по вопросу или №..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-12 glass-card border-none focus-visible:ring-primary/50"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        </div>
      </div>

      <ScrollArea className="flex-1 scroll-container">
        <div className="py-4 px-4 mx-auto max-w-2xl w-full pb-32">
          {filtered.length > 0 ? (
            <Accordion type="single" collapsible className="space-y-3 w-full">
              {filtered.map((q) => {
                const isStudied = studiedIds.has(q.id);
                return (
                  <AccordionItem 
                    key={q.id} 
                    value={q.id.toString()}
                    className={cn(
                      "border-none glass-card rounded-xl transition-all duration-300 w-full max-w-full",
                      isStudied && "bg-primary/5 border border-primary/20"
                    )}
                  >
                    <AccordionTrigger className="px-5 py-4 hover:no-underline group">
                      <div className="flex flex-col items-start text-left gap-1 pr-4 w-full break-words whitespace-normal overflow-hidden">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "text-[10px] font-mono px-2 py-0.5 rounded",
                            isStudied ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
                          )}>
                            Вопрос № {q.id}
                          </span>
                          {isStudied && <CheckCircle2 className="w-3.5 h-3.5 text-primary" />}
                        </div>
                        <span className="text-sm font-medium line-clamp-2 text-foreground/90 w-full text-left break-words">
                          {getCleanPreview(q.question)}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-5 pb-5 pt-0 w-full overflow-hidden">
                      <div className="space-y-4 w-full max-w-full">
                        <div className="p-4 rounded-lg bg-white/5 border border-white/5 w-full">
                          <h3 className="font-semibold text-primary mb-2 text-xs uppercase tracking-wider">Полный вопрос:</h3>
                          <div className="text-sm leading-relaxed text-foreground/90 w-full">
                            {formatText(q.question)}
                          </div>
                        </div>

                        <div className="p-4 rounded-lg bg-white/5 border border-white/5 w-full">
                          <h3 className="font-semibold text-primary mb-2 text-xs uppercase tracking-wider">Ответ:</h3>
                          <div className="text-sm leading-relaxed text-foreground/80 w-full">
                            {formatText(q.answer)}
                          </div>
                        </div>

                        <PersonalNote id={q.id} />

                        <div className="flex flex-wrap gap-2 mt-4">
                          <Button
                            variant="outline"
                            className="flex-1 min-w-[140px] h-11 rounded-xl gap-2 border-primary/30 text-primary hover:bg-primary/10"
                            onClick={() => setReadingQuestion(q)}
                          >
                            <BookOpen className="w-4 h-4" />
                            Режим чтения
                          </Button>
                          <Button
                            variant={isStudied ? "default" : "outline"}
                            className={cn(
                              "flex-1 min-w-[140px] h-11 rounded-xl gap-2 transition-all",
                              isStudied ? "bg-primary text-primary-foreground" : "border-primary/30 text-primary hover:bg-primary/10"
                            )}
                            onClick={() => toggleStudied(q.id)}
                          >
                            {isStudied ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                            {isStudied ? "Изучено" : "Изучил"}
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
              <p>Ничего не найдено</p>
            </div>
          )}
        </div>
      </ScrollArea>

      <AnimatePresence>
        {readingQuestion && (
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
                <span className="text-xs font-mono px-3 py-1 bg-primary/10 text-primary rounded-full uppercase tracking-wider">
                  Вопрос № {readingQuestion.id}
                </span>
              </div>
              <button 
                onClick={() => setReadingQuestion(null)}
                className="p-3 bg-white/5 rounded-full hover:bg-white/10 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <ScrollArea className="flex-1 scroll-container">
              <div className="space-y-10 pb-32 max-w-2xl mx-auto w-full overflow-x-hidden px-1">
                <div className="space-y-4 w-full">
                  <h2 className="text-2xl md:text-3xl font-bold font-headline leading-tight text-foreground break-words whitespace-pre-wrap">
                    {readingQuestion.question.replace(/\*\*/g, '')}
                  </h2>
                </div>

                <div className="space-y-4 w-full">
                  <div className="flex items-center gap-2 text-primary font-bold text-sm uppercase tracking-widest">
                    <BookOpen className="w-4 h-4" />
                    Ответ
                  </div>
                  <div className="text-base leading-[1.4] text-foreground/80 font-light selection:bg-primary/30 w-full break-words whitespace-pre-wrap">
                    {formatText(readingQuestion.answer)}
                  </div>
                </div>

                <PersonalNote id={readingQuestion.id} />
              </div>
            </ScrollArea>

            <div className="mt-auto pt-6 border-t border-white/5 bg-background pb-safe">
              <Button
                size="lg"
                className="w-full h-16 rounded-2xl gap-3 text-lg font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
                onClick={() => toggleStudied(readingQuestion.id)}
              >
                <CheckCircle2 className="w-6 h-6" />
                Отметить как изученное
              </Button>
            </div>
          </motion.div>
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