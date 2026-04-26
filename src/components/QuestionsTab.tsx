"use client";

// =================================================
// ИМПОРТЫ
// =================================================
import React, { useState, useEffect, useMemo, useRef } from 'react';
import questionsData from '@/data/questions.json';      // Массив вопросов и ответов
import glossaryData from '@/data/glossary.json';        // Словарь терминов для глоссария
import { Input } from '@/components/ui/input';          // Поле ввода (поиск)
import { ScrollArea } from '@/components/ui/scroll-area'; // Прокручиваемая область
import { Search, Book, CheckCircle2, Circle, BookOpen, X, Pencil, Trash2, ArrowLeft, ArrowRight } from 'lucide-react'; // Иконки
import { Progress } from '@/components/ui/progress';    // Индикатор прогресса
import { Button } from '@/components/ui/button';        // Кнопки
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from '@/components/ui/accordion';                    // Раскрывающиеся карточки вопросов
import { ToothIcon } from './ToothIcon';                // Иконка зуба
import { cn } from '@/lib/utils';                       // Утилита для слияния CSS-классов
import { motion, AnimatePresence } from 'framer-motion'; // Анимации
import ReactMarkdown from 'react-markdown';             // Рендеринг Markdown в заметках

// Тип элемента глоссария
interface GlossaryItem {
  term: string;
  definition: string;
  image?: string | string[]; // необязательное поле: строка или массив строк
}


// =================================================
// ГЛАВНЫЙ КОМПОНЕНТ
// =================================================
export const QuestionsTab = () => {

  // =================================================
  // СОСТОЯНИЯ (USE STATE)
  // =================================================
  const [search, setSearch] = useState('');                        // Строка поиска
  const [studiedIds, setStudiedIds] = useState<Set<number>>(new Set()); // ID изученных вопросов
  const [userNotes, setUserNotes] = useState<Record<number, string>>({}); // Заметки пользователя (ключ – ID вопроса)
  const [isLoaded, setIsLoaded] = useState(false);                // Флаг завершения загрузки данных из localStorage
  const [readingQuestion, setReadingQuestion] = useState<any | null>(null); // Вопрос, открытый в режиме чтения (или null)
  const [activeTermDef, setActiveTermDef] = useState<string | null>(null); // Определение активного термина для тултипа глоссария
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });   // Позиция тултипа глоссария
  const [fontSize, setFontSize] = useState(16);                   // Текущий размер шрифта в режиме чтения (базовый)
  const [zoomedImage, setZoomedImage] = useState<string | null>(null); // URL изображения для полноэкранного просмотра
  const [scale, setScale] = useState(1);                          // Масштаб увеличенного изображения
  const [translate, setTranslate] = useState({ x: 0, y: 0 });     // Смещение увеличенного изображения при панорамировании

  // =================================================
  // REFS (USE REF)
  // =================================================
  const imageRef = useRef<HTMLDivElement>(null);           // Ссылка на контейнер увеличенного изображения
  const initialDistance = useRef<number | null>(null);     // Начальное расстояние между пальцами для pinch‑to‑zoom текста
  const initialFontSize = useRef<number>(16);              // Запоминаем размер шрифта перед началом жеста
  const contentRef = useRef<HTMLDivElement>(null);         // Ссылка на контейнер с контентом режима чтения (для жестов)

  // Для перетаскиваемого тултипа глоссария
  const [dragging, setDragging] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const tooltipStartPos = useRef({ x: 0, y: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Для плавающей кнопки закрытия режима чтения (перетаскиваемой)
  const [closeBtnPos, setCloseBtnPos] = useState({ x: 0, y: 0 });
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const [closeDragging, setCloseDragging] = useState(false);
  const closeStartPos = useRef({ x: 0, y: 0 });
  const closeBtnStartPos = useRef({ x: 0, y: 0 });
  const hasMoved = useRef(false);                          // Было ли перемещение (чтобы отличить клик от перетаскивания)

  // =================================================
  // ЗАГРУЗКА ДАННЫХ ИЗ LOCALSTORAGE
  // =================================================
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

  // Сохранение изученных и заметок в localStorage при каждом изменении
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('studiedQuestions', JSON.stringify(Array.from(studiedIds)));
      localStorage.setItem('userQuestionNotes', JSON.stringify(userNotes));
    }
  }, [studiedIds, userNotes, isLoaded]);

  // =================================================
  // ФУНКЦИИ УПРАВЛЕНИЯ СОСТОЯНИЕМ
  // =================================================
  // Переключить статус "изучено" у вопроса
  const toggleStudied = (id: number) => {
    setStudiedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    // Если вопрос был открыт в режиме чтения – закрыть его
    if (readingQuestion && readingQuestion.id === id) setReadingQuestion(null);
  };

  // Обновить заметку для вопроса (с удалением HTML‑тегов)
  const updateNote = (id: number, text: string) => {
    setUserNotes(prev => ({ ...prev, [id]: text.replace(/<[^>]*>?/gm, '') }));
  };

  // Удалить заметку
  const clearNote = (id: number) => {
    setUserNotes(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  // =================================================
  // ФИЛЬТРАЦИЯ ВОПРОСОВ ПО ПОИСКУ
  // =================================================
  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return questionsData.filter(q => {
      const idMatch = q.id.toString() === term;
      const textMatch = q.question.toLowerCase().includes(term);
      return !search || idMatch || textMatch;
    });
  }, [search]);

  // Прогресс изученных вопросов
  const progress = useMemo(() => {
    if (questionsData.length === 0) return 0;
    return (studiedIds.size / questionsData.length) * 100;
  }, [studiedIds]);

  // Экранирование специальных символов для регулярных выражений
  const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Подготовленный массив терминов для глоссария (сортировка по длине)
  const glossaryTerms = useMemo(() => {
    return (glossaryData as GlossaryItem[]).slice().sort((a, b) => b.term.length - a.term.length);
  }, []);

  // =================================================
  // ГЛОССАРИЙ: ПОИСК ТЕРМИНОВ В ТЕКСТЕ
  // =================================================
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

  // Закрытие тултипа глоссария при клике вне
  useEffect(() => {
    if (activeTermDef) {
      const handler = () => setActiveTermDef(null);
      document.addEventListener('click', handler);
      return () => document.removeEventListener('click', handler);
    }
  }, [activeTermDef]);

  // =================================================
  // ЖЕСТ PINCH‑TO‑ZOOM ДЛЯ ШРИФТА В РЕЖИМЕ ЧТЕНИЯ
  // =================================================
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      initialDistance.current = Math.hypot(dx, dy);
      initialFontSize.current = fontSize;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialDistance.current !== null) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const distance = Math.hypot(dx, dy);
      const scaleRatio = distance / initialDistance.current;
      const newSize = Math.max(12, Math.min(28, Math.round(initialFontSize.current * scaleRatio)));
      setFontSize(newSize);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      initialDistance.current = null;
    }
  };

  // =================================================
  // ПЕРЕТАСКИВАЕМЫЙ ТУЛТИП ГЛОССАРИЯ
  // =================================================
  const handleTooltipMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDragging(true);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    tooltipStartPos.current = { x: tooltipPos.x, y: tooltipPos.y };
  };

  useEffect(() => {
    if (!dragging) return;
    const handleMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStartPos.current.x;
      const dy = e.clientY - dragStartPos.current.y;
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
    const handleUp = () => setDragging(false);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [dragging]);

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

  // =================================================
  // ПЕРЕТАСКИВАЕМАЯ КНОПКА ЗАКРЫТИЯ РЕЖИМА ЧТЕНИЯ
  // =================================================
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

  useEffect(() => {
    if (!closeDragging) return;
    const handleMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const dx = clientX - closeStartPos.current.x;
      const dy = clientY - closeStartPos.current.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasMoved.current = true;
      let newX = closeBtnStartPos.current.x + dx;
      let newY = closeBtnStartPos.current.y + dy;
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
      if (!hasMoved.current) setReadingQuestion(null);
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

  // =================================================
  // ФУНКЦИЯ РЕНДЕРИНГА ТЕКСТА С ГЛОССАРИЕМ
  // =================================================
  const renderWithGlossary = (text: string) => {
    // Разбиваем текст на обычные и жирные (**...**) фрагменты
    const fragments: { type: 'normal' | 'bold'; content: string }[] = [];
    let remaining = text;
    const boldRegex = /\*\*(.*?)\*\*/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    
    while ((match = boldRegex.exec(remaining)) !== null) {
      if (match.index > lastIndex) {
        fragments.push({ type: 'normal', content: remaining.substring(lastIndex, match.index) });
      }
      fragments.push({ type: 'bold', content: match[1] });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < remaining.length) {
      fragments.push({ type: 'normal', content: remaining.substring(lastIndex) });
    }

    // Обработка обычного текста: поиск терминов и замена на <span class="glossary-term">
    const processNormalText = (normalText: string): string => {
      let result = normalText;
      const sortedTerms = [...glossaryTerms].sort((a, b) => b.term.length - a.term.length);
      for (const termItem of sortedTerms) {
        const term = termItem.term;
        const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const termRegex = new RegExp(escapedTerm, 'gi');
        result = result.replace(termRegex, (match, offset) => {
          const prevChar = offset > 0 ? result[offset - 1] : '';
          const nextChar = offset + match.length < result.length ? result[offset + match.length] : '';
          const isBoundary = (ch: string) => /[\s\p{P}\p{Z}]/u.test(ch) || ch === '';
          if ((isBoundary(prevChar) || prevChar === '') && (isBoundary(nextChar) || nextChar === '')) {
            return `<span class="glossary-term" data-definition="${encodeURIComponent(termItem.definition)}">${match}</span>`;
          }
          return match;
        });
      }
      return result;
    };

    // Собираем фрагменты в HTML‑строку
    const processedFragments = fragments.map((frag) => {
      if (frag.type === 'bold') {
        return `<span class="font-bold text-amber-300">${frag.content}</span>`;
      } else {
        return processNormalText(frag.content);
      }
    });
    const finalHtml = processedFragments.join('');

    // Разбиваем на абзацы и оборачиваем в <p> с красной строкой
    const lines = finalHtml.split('\n').map((line, i) => (
      <p key={i} className="indent-4 mb-1 last:mb-0" dangerouslySetInnerHTML={{ __html: line }} />
    ));
    return <div className="w-full break-words whitespace-pre-wrap [word-break:break-word]">{lines}</div>;
  };

  // =================================================
  // КОМПОНЕНТ ЗАМЕТКИ
  // =================================================
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
            placeholder=" Добавьте свои примечания здесь... (хранится только в вашем браузере)"
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

  // Очистка текста от ** для предпросмотра
  const getCleanPreview = (text: string) => text.replace(/\*\*/g, '').trim();

  // =================================================
  // ГЛАВНЫЙ РЕНДЕР
  // =================================================
  return (
    <div className="flex flex-col h-full bg-background pb-0 max-w-full overflow-hidden" onClick={handleGlossaryClick}>
      {/* ВЕРХНЯЯ ПАНЕЛЬ */}
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

      {/* СПИСОК ВОПРОСОВ */}
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
                        {/* Сокращённый ответ */}
                        <div className="relative">
                          <div className="text-sm leading-relaxed text-foreground/80 max-h-24 overflow-hidden">
                            {renderWithGlossary(q.answer)}
                          </div>
                          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" className="flex-1 min-w-[140px] h-11 rounded-xl gap-2 border-primary/30 text-primary hover:bg-primary/10" onClick={() => setReadingQuestion(q)}>
                            <BookOpen className="w-4 h-4" /> Режим чтения
                          </Button>
                          <Button variant={isStudied ? "default" : "outline"} className={cn("flex-1 min-w-[140px] h-11 rounded-xl gap-2 transition-all", isStudied ? "bg-primary text-primary-foreground" : "border-primary/30 text-primary hover:bg-primary/10")} onClick={() => toggleStudied(q.id)}>
                            {isStudied ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                            {isStudied ? "Изучено" : "Изучил"}
                          </Button>
                        </div>

                        <PersonalNote id={q.id} />
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

      {/* РЕЖИМ ЧТЕНИЯ */}
      <AnimatePresence>
        {readingQuestion && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-[100] bg-background flex flex-col overflow-hidden max-w-full"
          >
            <div className="flex flex-col h-full relative">

              {/* ПРОКРУЧИВАЕМАЯ ОБЛАСТЬ С КОНТЕНТОМ (ЖЕСТ PINCH‑TO‑ZOOM) */}
              <div
                className="flex-1 overflow-y-auto px-5 pt-10 scroll-container"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onClick={handleGlossaryClick}
              >
                <div className="space-y-10 pb-32 max-w-2xl mx-auto w-full overflow-x-hidden">
                  {/* ВОПРОС */}
                  <div className="space-y-4 w-full">
                    <h2
                      className="text-lg md:text-xl font-semibold leading-snug text-foreground/80 break-words whitespace-pre-wrap mb-6"
                      style={{ fontSize: `${fontSize * 1.2}px` }}
                    >
                      {renderWithGlossary(readingQuestion.question)}
                    </h2>
                  </div>
                  {/* ОТВЕТ */}
                  <div className="space-y-4 w-full">
                    <div className="flex items-center gap-2 text-primary font-bold text-sm uppercase tracking-widest">
                      <BookOpen className="w-4 h-4" /> Ответ
                    </div>
                    <div
                      className="leading-relaxed text-foreground/80 font-light selection:bg-primary/30 w-full break-words whitespace-pre-wrap reading-answer"
                      style={{ fontSize: `${fontSize}px` }}
                    >
                      {renderWithGlossary(readingQuestion.answer)}
                    </div>
                  </div>
                  {/* КАРТИНКА (после ответа, перед заметкой) */}
                  {/* Блок изображений (одно или несколько) */}
{(() => {
  // Приводим к массиву: если строка – оборачиваем, если массив – оставляем, если ничего – null
  const raw = readingQuestion.images || readingQuestion.image;
  if (!raw) return null;
  const imageList = Array.isArray(raw) ? raw : [raw];
  return (
    <div className="space-y-4">
      {imageList.map((imgUrl: string, idx: number) => (
        <div
          key={idx}
          className="rounded-xl overflow-hidden border border-white/10 cursor-pointer"
          onClick={() => setZoomedImage(imgUrl)}
        >
          <img
            src={imgUrl}
            alt={`Иллюстрация к вопросу ${idx + 1}`}
            className="w-full h-auto object-contain max-h-80"
            loading="lazy"
          />
        </div>
      ))}
    </div>
  );
})()}
                  {/* ЗАМЕТКА */}
                  <PersonalNote id={readingQuestion.id} />
                </div>
              </div>

              {/* НИЖНЯЯ ПАНЕЛЬ НАВИГАЦИИ */}
              <div className="mt-auto pt-6 border-t border-white/5 bg-background pb-safe px-3">
                <div className="flex gap-2 items-center">
                  {/* Кнопка влево */}
                  <button
                    onClick={() => {
                      const currentIndex = questionsData.findIndex(q => q.id === readingQuestion.id);
                      if (currentIndex === -1) return;
                      const prevIndex = (currentIndex - 1 + questionsData.length) % questionsData.length;
                      setReadingQuestion(questionsData[prevIndex]);
                    }}
                    className="w-11 h-11 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors flex-shrink-0"
                    title="Предыдущий вопрос"
                  >
                    <ArrowLeft className="w-5 h-5 text-white" />
                  </button>

                  {/* Кнопка "Изучил" */}
                  <Button
                    variant={studiedIds.has(readingQuestion.id) ? "default" : "outline"}
                    className={cn(
                      "flex-1 h-11 rounded-xl gap-2 font-bold",
                      studiedIds.has(readingQuestion.id)
                        ? "bg-primary text-primary-foreground"
                        : "border-primary/30 text-primary hover:bg-primary/10"
                    )}
                    onClick={() => toggleStudied(readingQuestion.id)}
                  >
                    {studiedIds.has(readingQuestion.id)
                      ? (<><CheckCircle2 className="w-4 h-4" /> Изучено</>)
                      : (<><Circle className="w-4 h-4" /> Изучил</>)
                    }
                  </Button>

                  {/* Кнопка "Выйти" */}
                  <Button
                    variant="outline"
                    className="flex-1 h-11 rounded-xl gap-2 border-primary/30 text-primary hover:bg-primary/10 font-bold"
                    onClick={() => setReadingQuestion(null)}
                  >
                    <X className="w-4 h-4" />
                    Выйти
                  </Button>

                  {/* Кнопка вправо */}
                  <button
                    onClick={() => {
                      const currentIndex = questionsData.findIndex(q => q.id === readingQuestion.id);
                      if (currentIndex === -1) return;
                      const nextIndex = (currentIndex + 1) % questionsData.length;
                      setReadingQuestion(questionsData[nextIndex]);
                    }}
                    className="w-11 h-11 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors flex-shrink-0"
                    title="Следующий вопрос"
                  >
                    <ArrowRight className="w-5 h-5 text-white" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ТУЛТИП ГЛОССАРИЯ */}
     {/* Тултип глоссария с поддержкой картинок и зума */}
{activeTermDef && (() => {
  const found = glossaryTerms.find((g: GlossaryItem) => g.definition === activeTermDef);
  const termImage = found?.image;
  return (
    <div
      ref={tooltipRef}
      className="fixed z-[200] bg-card border border-white/10 rounded-2xl p-4 shadow-2xl max-w-xs select-none"
      style={{ left: tooltipPos.x, top: tooltipPos.y }}
      onMouseDown={handleTooltipMouseDown}
      onTouchStart={handleTooltipTouchStart}
      onClick={(e) => e.stopPropagation()}
    >
      {termImage && (
        <div className="mb-3 space-y-2">
          {(Array.isArray(termImage) ? termImage : [termImage]).map((imgUrl: string, idx: number) => (
            <div
              key={idx}
              className="rounded-lg overflow-hidden border border-white/10 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation(); // чтобы не закрылся тултип
                setZoomedImage(imgUrl);
              }}
            >
              <img
                src={imgUrl}
                alt={`Иллюстрация термина ${idx + 1}`}
                className="w-full h-auto object-contain max-h-32"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      )}
     {activeTermDef ? <p className="text-white text-sm">{activeTermDef}</p> : null}
      <p className="text-[10px] text-muted-foreground mt-1">↔ перетащите, чтобы переместить</p>
    </div>
  );
})()}

      {/* МОДАЛЬНОЕ ОКНО ДЛЯ УВЕЛИЧЕННОГО ИЗОБРАЖЕНИЯ */}
      {zoomedImage && (
        <div
          className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center backdrop-blur-sm"
          onClick={() => { setZoomedImage(null); setScale(1); setTranslate({ x: 0, y: 0 }); }}
          onWheel={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const delta = e.deltaY > 0 ? -0.2 : 0.2;
            setScale((prev) => Math.min(5, Math.max(1, prev + delta)));
          }}
          onTouchStart={(e) => {
            if (e.touches.length === 2) {
              const dx = e.touches[0].clientX - e.touches[1].clientX;
              const dy = e.touches[0].clientY - e.touches[1].clientY;
              const dist = Math.hypot(dx, dy);
              (e.currentTarget as any).__pinchStart = {
                dist, scale, translate,
                cx: (e.touches[0].clientX + e.touches[1].clientX) / 2,
                cy: (e.touches[0].clientY + e.touches[1].clientY) / 2,
              };
            } else if (e.touches.length === 1) {
              (e.currentTarget as any).__panStart = {
                x: e.touches[0].clientX,
                y: e.touches[0].clientY,
                translate,
              };
            }
          }}
          onTouchMove={(e) => {
            if (e.touches.length === 2 && (e.currentTarget as any).__pinchStart) {
              const ps = (e.currentTarget as any).__pinchStart;
              const dx = e.touches[0].clientX - e.touches[1].clientX;
              const dy = e.touches[0].clientY - e.touches[1].clientY;
              const dist = Math.hypot(dx, dy);
              const newScale = Math.min(5, Math.max(1, ps.scale * (dist / ps.dist)));
              const ratio = newScale / ps.scale;
              const newX = ps.translate.x + (ps.cx - ps.translate.x) * (1 - ratio);
              const newY = ps.translate.y + (ps.cy - ps.translate.y) * (1 - ratio);
              setScale(newScale);
              setTranslate({ x: newX, y: newY });
            } else if (e.touches.length === 1 && (e.currentTarget as any).__panStart && scale > 1) {
              const ps = (e.currentTarget as any).__panStart;
              const dx = e.touches[0].clientX - ps.x;
              const dy = e.touches[0].clientY - ps.y;
              setTranslate({ x: ps.translate.x + dx, y: ps.translate.y + dy });
            }
          }}
          onTouchEnd={(e) => {
            delete (e.currentTarget as any).__pinchStart;
            delete (e.currentTarget as any).__panStart;
          }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setZoomedImage(null); setScale(1); setTranslate({ x: 0, y: 0 }); }}
            className="absolute top-4 right-4 p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors z-10"
          >
            <X className="w-6 h-6 text-white" />
          </button>
          <div
            ref={imageRef}
            className="flex items-center justify-center max-w-full max-h-full"
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={() => { setScale(1); setTranslate({ x: 0, y: 0 }); }}
          >
            <img
              src={zoomedImage}
              alt="Просмотр изображения"
              className="max-w-full max-h-full object-contain rounded-xl select-none"
              style={{
                transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
                transition: 'transform 0.2s ease-out',
                touchAction: 'none',
              }}
              draggable={false}
            />
          </div>
        </div>
      )}
    </div>
  );
};