"use client";
import React, { useState, useEffect, useMemo, useRef } from 'react';
import questionsData from '@/data/questions.json';
import glossaryData from '@/data/glossary.json';
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

interface GlossaryItem {
  term: string;
  definition: string;
}

export const QuestionsTab = () => {
  const [search, setSearch] = useState('');
  const [studiedIds, setStudiedIds] = useState<Set<number>>(new Set());
  const [userNotes, setUserNotes] = useState<Record<number, string>>({});
  const [isLoaded, setIsLoaded] = useState(false);
  const [readingQuestion, setReadingQuestion] = useState<any | null>(null);
  const [activeTermDef, setActiveTermDef] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const savedStudied = localStorage.getItem('studiedQuestions');
    const savedNotes = localStorage.getItem('userQuestionNotes');
    if (savedStudied) {
      try { setStudiedIds(new Set(JSON.parse(savedStudied))); } catch (e) {}
    }
    if (savedNotes) {
      try { setUserNotes(JSON.parse(savedNotes)); } catch (e) {}
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
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    if (readingQuestion && readingQuestion.id === id) setReadingQuestion(null);
  };

  const updateNote = (id: number, text: string) => {
    setUserNotes(prev => ({ ...prev, [id]: text.replace(/<[^>]*>?/gm, '') }));
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

  const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const glossaryTerms = useMemo(() => {
    return (glossaryData as GlossaryItem[]).slice().sort((a, b) => b.term.length - a.term.length);
  }, []);
  // --- Состояние для перетаскиваемого тултипа ---
  const [dragging, setDragging] = useState(false);
    // --- Плавающая кнопка закрытия (перетаскиваемая) ---
  const [closeBtnPos, setCloseBtnPos] = useState({ x: window.innerWidth - 60, y: 60 });
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const [closeDragging, setCloseDragging] = useState(false);
  const closeStartPos = useRef({ x: 0, y: 0 });
  const closeBtnStartPos = useRef({ x: 0, y: 0 });
  const hasMoved = useRef(false);

  // Обновить начальную позицию при открытии нового вопроса
  useEffect(() => {
    if (readingQuestion) {
      setCloseBtnPos({ x: window.innerWidth - 60, y: 60 });
      hasMoved.current = false;
    }
  }, [readingQuestion]);

  const handleCloseMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCloseDragging(true);
    hasMoved.current = false;
    closeStartPos.current = { x: e.clientX, y: e.clientY };
    closeBtnStartPos.current = { x: closeBtnPos.x, y: closeBtnPos.y };
  };

  const handleCloseTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    const touch = e.touches[0];
    setCloseDragging(true);
    hasMoved.current = false;
    closeStartPos.current = { x: touch.clientX, y: touch.clientY };
    closeBtnStartPos.current = { x: closeBtnPos.x, y: closeBtnPos.y };
  };

  // Эффект для перемещения
  useEffect(() => {
    if (!closeDragging) return;
    const handleMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const dx = clientX - closeStartPos.current.x;
      const dy = clientY - closeStartPos.current.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        hasMoved.current = true;
      }
      let newX = closeBtnStartPos.current.x + dx;
      let newY = closeBtnStartPos.current.y + dy;
      // Ограничение по экрану
      const btn = closeBtnRef.current;
      if (btn) {
        const rect = btn.getBoundingClientRect();
        const maxX = window.innerWidth - rect.width - 10;
        const maxY = window.innerHeight - rect.height - 10;
        newX = Math.max(10, Math.min(newX, maxX));
        newY = Math.max(10, Math.min(newY, maxY));
      }
      setCloseBtnPos({ x: newX, y: newY });
    };

    const handleUp = () => {
      setCloseDragging(false);
      // Если не было перемещения, то это клик – закрываем
      if (!hasMoved.current) {
        setReadingQuestion(null);
      }
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
    };
  }, [closeDragging]);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const tooltipStartPos = useRef({ x: 0, y: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);

  // При начале перетаскивания
  const handleTooltipMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDragging(true);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    tooltipStartPos.current = { x: tooltipPos.x, y: tooltipPos.y };
  };

  // При движении
  useEffect(() => {
    if (!dragging) return;
    const handleMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStartPos.current.x;
      const dy = e.clientY - dragStartPos.current.y;
      let newX = tooltipStartPos.current.x + dx;
      let newY = tooltipStartPos.current.y + dy;

      // Ограничиваем, чтобы тултип не выходил за экран
      const tooltip = tooltipRef.current;
      if (tooltip) {
        const rect = tooltip.getBoundingClientRect();
        const maxX = window.innerWidth - rect.width - 10;
        const maxY = window.innerHeight - rect.height - 10;
        newX = Math.max(10, Math.min(newX, maxX));
        newY = Math.max(10, Math.min(newY, maxY));
      }
      setTooltipPos({ x: newX, y: newY });
    };
    const handleUp = () => setDragging(false);

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [dragging]);

  // Аналогично для touch-событий
  const handleTooltipTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    const touch = e.touches[0];
    setDragging(true);
    dragStartPos.current = { x: touch.clientX, y: touch.clientY };
    tooltipStartPos.current = { x: tooltipPos.x, y: tooltipPos.y };
  };

  useEffect(() => {
    if (!dragging) return;
    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      const dx = touch.clientX - dragStartPos.current.x;
      const dy = touch.clientY - dragStartPos.current.y;
      let newX = tooltipStartPos.current.x + dx;
      let newY = tooltipStartPos.current.y + dy;
      const tooltip = tooltipRef.current;
      if (tooltip) {
        const rect = tooltip.getBoundingClientRect();
        const maxX = window.innerWidth - rect.width - 10;
        const maxY = window.innerHeight - rect.height - 10;
        newX = Math.max(10, Math.min(newX, maxX));
        newY = Math.max(10, Math.min(newY, maxY));
      }
      setTooltipPos({ x: newX, y: newY });
    };
    const handleTouchEnd = () => setDragging(false);

    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    return () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [dragging]);
 const renderWithGlossary = (text: string) => {
  // Разбиваем текст на фрагменты: обычные и жирные (**...**)
  const fragments: { type: 'normal' | 'bold'; content: string }[] = [];
  let remaining = text;
  const boldRegex = /\*\*(.*?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  
  while ((match = boldRegex.exec(remaining)) !== null) {
    // Текст до жирного
    if (match.index > lastIndex) {
      fragments.push({ type: 'normal', content: remaining.substring(lastIndex, match.index) });
    }
    // Жирный текст (без **)
    fragments.push({ type: 'bold', content: match[1] });
    lastIndex = match.index + match[0].length;
  }
  // Остаток после последнего жирного
  if (lastIndex < remaining.length) {
    fragments.push({ type: 'normal', content: remaining.substring(lastIndex) });
  }

  // Функция для поиска терминов в обычном тексте и оборачивания в span
  const processNormalText = (normalText: string): string => {
    let result = normalText;
    // Сортируем термины по убыванию длины, чтобы длинные составные термины обрабатывались первыми
    const sortedTerms = [...glossaryTerms].sort((a, b) => b.term.length - a.term.length);
    
    for (const termItem of sortedTerms) {
      const term = termItem.term;
      // Экранируем специальные символы в термине для регулярки
      const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Ищем термин как целое слово: перед ним должен быть не буквенно-цифровой и не дефис, и после тоже (чтобы не захватить часть слова)
      // Используем просмотр назад и вперёд, но они могут не поддерживаться в старых браузерах. Вместо этого ищем термин, окружённый границами, которые мы определим как любой символ, не являющийся буквой, цифрой или дефисом, или начало/конец строки.
      // Упростим: используем регулярное выражение с захватом контекста и заменяем только термин, если он не часть другого слова.
      // Более надёжный способ: ищем вхождения термина, и для каждого проверяем окружение.
      const termRegex = new RegExp(escapedTerm, 'gi');
      result = result.replace(termRegex, (match, offset) => {
        // Проверка границ: символ перед совпадением
        const prevChar = offset > 0 ? result[offset - 1] : '';
        const nextChar = offset + match.length < result.length ? result[offset + match.length] : '';
        // Разрешённые границы: пробел, знак препинания, начало/конец строки, скобки, тире и т.п.
        const isBoundary = (ch: string) => /[\s\p{P}\p{Z}]/u.test(ch) || ch === ''; 
        // Проверяем, что prevChar и nextChar являются границами, либо термин содержит дефис/пробел внутри – тогда границы должны быть до и после всего термина.
        // Для составных терминов (содержащих пробел или дефис) проверяем только границы вокруг всего термина.
        if ( (isBoundary(prevChar) || prevChar === '') && (isBoundary(nextChar) || nextChar === '') ) {
          // Дополнительная проверка: не находится ли термин внутри другого слова? Например, "окклюзия" в "окклюзионный". isBoundary учитывает что prevChar не буква/цифра/дефис, но разрешён ли дефис внутри слова? Нет, дефис считается границей? По условию, дефис – это часть термина, поэтому если термин содержит дефис, то перед и после должны быть границы, но сам дефис внутри термина не должен быть частью другого слова. Всё корректно.
          return `<span class="glossary-term" data-definition="${encodeURIComponent(termItem.definition)}">${match}</span>`;
        }
        return match;
      });
    }
    return result;
  };

  // Собираем финальную строку
  const processedFragments = fragments.map((frag) => {
    if (frag.type === 'bold') {
      // Жирный текст оборачиваем в наш стиль
      return `<span class="font-bold text-amber-300">${frag.content}</span>`;
    } else {
      // Обычный текст обрабатываем глоссарием
      return processNormalText(frag.content);
    }
  });

  const finalHtml = processedFragments.join('');

  // Разбиваем на строки для отображения
  const lines = finalHtml.split('\n').map((line, i) => (
    <React.Fragment key={i}>
      <span dangerouslySetInnerHTML={{ __html: line }} />
      <br />
    </React.Fragment>
  ));

  return <div className="w-full break-words whitespace-pre-wrap [word-break:break-word]">{lines}</div>;
};
  const handleGlossaryClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('glossary-term')) {
      const defEncoded = target.getAttribute('data-definition');
      if (defEncoded) {
        setActiveTermDef(decodeURIComponent(defEncoded));
        setTooltipPos({ x: e.clientX, y: e.clientY });
        e.stopPropagation();
      }
    }
  };

  useEffect(() => {
    if (activeTermDef) {
      const handler = () => setActiveTermDef(null);
      document.addEventListener('click', handler);
      return () => document.removeEventListener('click', handler);
    }
  }, [activeTermDef]);

  const PersonalNote = ({ id }: { id: number }) => {
    const [isEditing, setIsEditing] = useState(false);
    const note = userNotes[id] || '';
    const [localNote, setLocalNote] = useState(note);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => { setLocalNote(note); }, [note]);
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
            <Pencil className="w-3.5 h-3.5" /> Моя заметка
          </div>
          <div className="flex gap-2">
            {note && (
              <button onClick={() => clearNote(id)} className="text-muted-foreground/50 hover:text-destructive transition-colors" title="Очистить заметку">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button onClick={() => setIsEditing(!isEditing)} className="text-amber-500/50 hover:text-amber-500 transition-colors text-xs font-medium">
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
            placeholder=" Добавьте свои примечания здесь... (этот запись хранится только в вашем браузере и при чистке данных будет удалена)"
            className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm text-foreground/90 resize-none min-h-[60px] placeholder:text-amber-500/20"
            autoFocus
          />
        ) : (
          <div className="text-sm prose prose-invert prose-amber max-w-none break-words whitespace-pre-wrap">
            {note ? <ReactMarkdown>{note}</ReactMarkdown> : <p className="text-muted-foreground italic">Нет примечаний</p>}
          </div>
        )}
      </div>
    );
  };

  const getCleanPreview = (text: string) => text.replace(/\*\*/g, '').trim();

  return (
    <div className="flex flex-col h-full bg-background pb-0 max-w-full overflow-hidden" onClick={handleGlossaryClick}>
      {/* Верхняя панель */}
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
          <Input placeholder="Поиск по вопросу или №..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 h-12 glass-card border-none focus-visible:ring-primary/50" />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        </div>
      </div>

      {/* Список вопросов */}
      <ScrollArea className="flex-1 scroll-container">
        <div className="py-4 px-4 mx-auto max-w-2xl w-full pb-20">
          {filtered.length > 0 ? (
            <Accordion type="single" collapsible className="space-y-3 w-full">
              {filtered.map((q) => {
                const isStudied = studiedIds.has(q.id);
                return (
                  <AccordionItem key={q.id} value={q.id.toString()} className={cn("border-none glass-card rounded-xl transition-all duration-300 w-full max-w-full", isStudied && "bg-primary/5 border border-primary/20")}>
                    <AccordionTrigger className="px-5 py-4 hover:no-underline group">
                      <div className="flex flex-col items-start text-left gap-1 pr-4 w-full break-words whitespace-normal overflow-hidden">
                        <div className="flex items-center gap-2">
                          <span className={cn("text-[10px] font-mono px-2 py-0.5 rounded", isStudied ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary")}>
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
                          <h3 className="font-semibold text-primary mb-2 text-xs uppercase tracking-wider">Вопрос:</h3>
                          <div className="text-sm leading-relaxed text-foreground/90 w-full">{renderWithGlossary(q.question)}</div>
                        </div>
                        <div className="p-4 rounded-lg bg-white/5 border border-white/5 w-full">
                          <h3 className="font-semibold text-primary mb-2 text-xs uppercase tracking-wider">Ответ:</h3>
                          <div className="text-sm leading-relaxed text-foreground/80 w-full">{renderWithGlossary(q.answer)}</div>
                        </div>
                        <PersonalNote id={q.id} />
                        <div className="flex flex-wrap gap-2 mt-4">
                          <Button variant="outline" className="flex-1 min-w-[140px] h-11 rounded-xl gap-2 border-primary/30 text-primary hover:bg-primary/10" onClick={() => setReadingQuestion(q)}>
                            <BookOpen className="w-4 h-4" /> Режим чтения
                          </Button>
                          <Button variant={isStudied ? "default" : "outline"} className={cn("flex-1 min-w-[140px] h-11 rounded-xl gap-2 transition-all", isStudied ? "bg-primary text-primary-foreground" : "border-primary/30 text-primary hover:bg-primary/10")} onClick={() => toggleStudied(q.id)}>
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

      {/* Режим чтения */}
            {/* Режим чтения – без верхней панели, низ две кнопки */}
      <AnimatePresence>
        {readingQuestion && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-[100] bg-background flex flex-col overflow-hidden max-w-full"
          >
            <ScrollArea className="flex-1 scroll-container px-5 pt-10" onClick={handleGlossaryClick}>
              <div className="space-y-10 pb-32 max-w-2xl mx-auto w-full overflow-x-hidden">
                <div className="space-y-4 w-full">
                  <h2 className="text-2xl md:text-3xl font-bold font-headline leading-tight text-foreground break-words whitespace-pre-wrap">
                    {renderWithGlossary(readingQuestion.question)}
                  </h2>
                </div>
                <div className="space-y-4 w-full">
                  <div className="flex items-center gap-2 text-primary font-bold text-sm uppercase tracking-widest">
                    <BookOpen className="w-4 h-4" /> Ответ
                  </div>
                  <div className="text-base leading-[1.2] text-foreground/80 font-light selection:bg-primary/30 w-full break-words whitespace-pre-wrap">
                    {renderWithGlossary(readingQuestion.answer)}
                  </div>
                </div>
                <PersonalNote id={readingQuestion.id} />
              </div>
            </ScrollArea>

            {/* Нижний блок с двумя кнопками */}
                        {/* Нижний блок – кнопка на всю ширину + крестик-иконка поверх */}
                        {/* Нижний блок – основная кнопка на всю ширину, плавающий крестик отдельно */}
            <div className="mt-auto pt-6 border-t border-white/5 bg-background pb-safe px-5">
              <Button
                size="lg"
                className="w-full h-16 rounded-2xl gap-3 text-lg font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
                onClick={() => toggleStudied(readingQuestion.id)}
              >
                <CheckCircle2 className="w-6 h-6" />
                Отметить как изученное
              </Button>
            </div>

            {/* Плавающая перетаскиваемая кнопка закрытия */}
            <button
              ref={closeBtnRef}
              className="fixed z-[200] w-12 h-12 flex items-center justify-center rounded-full bg-white/20 backdrop-blur-md hover:bg-white/30 transition-colors shadow-lg select-none"
              style={{ left: closeBtnPos.x, top: closeBtnPos.y }}
              onMouseDown={handleCloseMouseDown}
              onTouchStart={handleCloseTouchStart}
              onClick={(e) => e.stopPropagation()} // чтобы не сработал onClick контейнера
              title="Закрыть (можно перетащить)"
            >
              <X className="w-6 h-6 text-white" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Тултип глоссария */}
      
             {/* Тултип глоссария (перетаскиваемый, без кнопки закрытия) */}
      {activeTermDef && (

        
        <div
          ref={tooltipRef}
          className="fixed z-[200] bg-card border border-white/10 rounded-2xl p-4 shadow-2xl max-w-xs select-none"
          style={{ left: tooltipPos.x, top: tooltipPos.y }}
          onMouseDown={handleTooltipMouseDown}
          onTouchStart={handleTooltipTouchStart}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-white text-sm">{activeTermDef}</p>
          {/* Маленькая подсказка, что можно перетаскивать */}
          <p className="text-[10px] text-muted-foreground mt-1">↔ перетащите, чтобы переместить</p>
        </div>
      )}    
    </div>
  );
};