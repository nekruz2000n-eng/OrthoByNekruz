"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import tasksData from '@/data/tasks.json';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Sparkles, Loader2, Search, CheckCircle2, Circle, BookOpen, X, Pencil, Trash2, AlertCircle } from 'lucide-react';
import { ToothIcon } from './ToothIcon';
import { useToast } from '@/hooks/use-toast';
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
    try { setResolvedIds(new Set(JSON.parse(localStorage.getItem('resolvedTasks') || '[]'))); } catch {}
    try { setUserNotes(JSON.parse(localStorage.getItem('userTaskNotes') || '{}')); } catch {}
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem('resolvedTasks',  JSON.stringify(Array.from(resolvedIds)));
    localStorage.setItem('userTaskNotes',  JSON.stringify(userNotes));
  }, [resolvedIds, userNotes, isLoaded]);

  const toggleResolved = (id: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setResolvedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const handleAiAnalyze = async (text: string) => {
    setIsAiLoading(true); setAiResult(null); setAiError(null); setIsAiPanelOpen(true);
    try { setAiResult(await analyzeClinicalCase(text)); }
    catch (error: any) {
      setAiError(error.message);
      toast({ variant: 'destructive', title: 'Ошибка анализа', description: error.message });
    } finally { setIsAiLoading(false); }
  };

  const updateNote = (id: number, text: string) =>
    setUserNotes(p => ({ ...p, [id]: text.replace(/<[^>]*>?/gm, '') }));
  const clearNote = (id: number) =>
    setUserNotes(p => { const n = { ...p }; delete n[id]; return n; });

  const filtered = useMemo(() => {
    const t = search.toLowerCase();
    return tasksData.filter(task => !search || task.id.toString() === t || task.question.toLowerCase().includes(t));
  }, [search]);

  const progress = useMemo(() => tasksData.length ? (resolvedIds.size / tasksData.length) * 100 : 0, [resolvedIds]);

  const formatText = (text: string) => (
    <div className="w-full break-words whitespace-pre-wrap [word-break:break-word]">
      {text.split('\n').map((line, i) => (
        <React.Fragment key={i}>
          {line.split('**').map((part, j) =>
            j % 2 === 1
              ? <b key={j} style={{ color: 'var(--c-primary)', fontWeight: 700 }}>{part}</b>
              : part
          )}
          <br />
        </React.Fragment>
      ))}
    </div>
  );

  // ── Заметка ───────────────────────────────────────
  const PersonalNote = ({ id }: { id: number }) => {
    const [editing, setEditing] = useState(false);
    const note = userNotes[id] || '';
    const [local, setLocal] = useState(note);
    const ref = useRef<HTMLTextAreaElement>(null);
    useEffect(() => { setLocal(note); }, [note]);
    useEffect(() => {
      if (editing && ref.current) { ref.current.focus(); ref.current.setSelectionRange(ref.current.value.length, ref.current.value.length); }
    }, [editing]);
    const save = () => { if (local !== note) updateNote(id, local); };
    return (
      <div className="mt-4 p-4 rounded-2xl" style={{ background: 'var(--c-amber-dim)', border: '1px solid var(--c-amber-br)' }}>
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--c-amber)' }}>
            <Pencil className="w-3 h-3" /> Моя заметка
          </div>
          <div className="flex gap-3">
            {note && <button onClick={() => { clearNote(id); setLocal(''); }} style={{ color: 'hsl(var(--destructive))' }}><Trash2 className="w-3.5 h-3.5" /></button>}
            <button onClick={() => { if (editing) save(); setEditing(v => !v); }} className="text-xs font-semibold" style={{ color: 'var(--c-amber)' }}>
              {editing ? 'Готово' : 'Править'}
            </button>
          </div>
        </div>
        {editing
          ? <textarea ref={ref} value={local} onChange={e => setLocal(e.target.value)} onBlur={save} placeholder="Добавьте комментарии..." autoFocus
              className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm resize-none min-h-[60px]"
              style={{ color: 'var(--c-text)', caretColor: 'var(--c-amber)' }} />
          : <div className="text-sm prose prose-invert max-w-none break-words whitespace-pre-wrap min-h-[24px]" onClick={() => setEditing(true)}>
              {note ? <ReactMarkdown>{note}</ReactMarkdown>
                : <p className="italic text-sm" style={{ color: 'color-mix(in srgb, var(--c-amber) 40%, transparent)' }}>Нажмите, чтобы добавить мысли...</p>}
            </div>}
      </div>
    );
  };

  // ════════════════════════════════════════════════════
  return (
    <div className="flex flex-col h-full overflow-hidden max-w-full" style={{ background: 'var(--c-bg)' }}>

      {/* ── ШАПКА ─────────────────────────────────── */}
      <div className="px-4 py-3 space-y-3 sticky top-0 z-10"
        style={{ background: 'color-mix(in srgb, var(--c-bg) 92%, transparent)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderBottom: '1px solid var(--c-border)', paddingTop: 'var(--header-pt)' }}>
        <div className="flex justify-between items-center px-1">
          <div className="flex items-center gap-3">
            <ToothIcon className="w-9 h-9 text-primary" />
            <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--c-text)' }}>OrthoByNekruz</h1>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest" style={{ color: 'var(--c-primary)' }}>
              {resolvedIds.size}/{tasksData.length}
            </span>
            <div className="w-16 h-1 rounded-full overflow-hidden" style={{ background: 'var(--c-border)' }}>
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${progress}%`, background: 'var(--c-primary)' }} />
            </div>
          </div>
        </div>
        <div className="relative mx-1">
          <Input placeholder="Поиск по № или условию..." value={search} onChange={e => setSearch(e.target.value)}
            className="pl-10 h-11 border-none focus-visible:ring-0 text-sm"
            style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)', color: 'var(--c-text)', caretColor: 'var(--c-primary)' }} />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--c-muted)' }} />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--c-muted)' }}><X className="w-4 h-4" /></button>}
        </div>
      </div>

      {/* ── СПИСОК ────────────────────────────────── */}
      <ScrollArea className="flex-1 scroll-container">
        <div className="py-3 px-3 mx-auto max-w-2xl w-full" style={{ paddingBottom: 'var(--scroll-pb)' }}>
          {filtered.length > 0 ? (
            <Accordion type="single" collapsible className="space-y-2 w-full">
              {filtered.map(task => {
                const resolved = resolvedIds.has(task.id);
                return (
                  <AccordionItem key={task.id} value={task.id.toString()} className="border-none rounded-2xl overflow-hidden w-full transition-all duration-200"
                    style={{ background: resolved ? 'color-mix(in srgb, var(--c-primary) 6%, var(--c-card))' : 'var(--c-card)', border: resolved ? '1px solid var(--c-primary-br)' : '1px solid var(--c-border)' }}>
                    <AccordionTrigger className="px-4 py-3.5 hover:no-underline [&>svg]:hidden">
                      <div className="flex items-start gap-3 text-left w-full pr-2">
                        {/* Кружок статуса */}
                        <div className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border flex items-center justify-center"
                          style={resolved ? { background: 'var(--c-primary-dim)', borderColor: 'var(--c-primary)' } : { borderColor: 'var(--c-border)' }}>
                          {resolved && <div className="w-2 h-2 rounded-full" style={{ background: 'var(--c-primary)' }} />}
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <span className="inline-block text-[10px] font-mono font-bold px-2 py-0.5 rounded-md"
                            style={resolved
                              ? { background: 'var(--c-primary-dim)', color: 'var(--c-primary)', border: '1px solid var(--c-primary-br)' }
                              : { background: 'color-mix(in srgb, var(--c-border) 60%, transparent)', color: 'var(--c-muted)', border: '1px solid var(--c-border)' }}>
                            Задача №{task.id}
                          </span>
                          <p className="text-sm font-medium leading-snug line-clamp-2 break-words"
                            style={{ color: resolved ? 'color-mix(in srgb, var(--c-text) 70%, transparent)' : 'var(--c-text)' }}>
                            {task.question}
                          </p>
                        </div>
                        <div className="flex-shrink-0 mt-1" style={{ color: 'var(--c-muted)' }}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m6 9 6 6 6-6" />
                          </svg>
                        </div>
                      </div>
                    </AccordionTrigger>

                    <AccordionContent className="px-4 pb-4 pt-0 w-full overflow-hidden">
                      {/* Условие */}
                      <div className="rounded-xl p-3 mb-2" style={{ background: 'color-mix(in srgb, var(--c-bg) 60%, var(--c-card))', border: '1px solid var(--c-border)' }}>
                        <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--c-primary)' }}>Условие:</p>
                        <div className="text-sm leading-relaxed" style={{ color: 'var(--c-text)' }}>{formatText(task.question)}</div>
                      </div>
                      {/* Ответ */}
                      <div className="rounded-xl p-3 mb-3" style={{ background: 'color-mix(in srgb, var(--c-bg) 60%, var(--c-card))', border: '1px solid var(--c-border)' }}>
                        <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--c-primary)' }}>Ответ:</p>
                        <div className="text-sm leading-relaxed" style={{ color: 'color-mix(in srgb, var(--c-text) 80%, transparent)' }}>{formatText(task.answer)}</div>
                      </div>
                      <PersonalNote id={task.id} />
                      {/* Кнопки */}
                      <div className="flex gap-2 mt-3">
                        <button onClick={() => setReadingTask(task)}
                          className="flex-1 flex items-center justify-center gap-2 h-10 rounded-xl text-sm font-semibold transition-all active:scale-[0.97]"
                          style={{ background: 'var(--c-primary-dim)', border: '1px solid var(--c-primary-br)', color: 'var(--c-primary)' }}>
                          <BookOpen className="w-4 h-4" /> Читать
                        </button>
                        <button onClick={e => toggleResolved(task.id, e)}
                          className="flex-1 flex items-center justify-center gap-2 h-10 rounded-xl text-sm font-semibold transition-all active:scale-[0.97]"
                          style={resolved
                            ? { background: 'var(--c-primary)', border: '1px solid var(--c-primary)', color: 'hsl(var(--primary-foreground))' }
                            : { background: 'transparent', border: '1px solid var(--c-border)', color: 'var(--c-muted)' }}>
                          {resolved ? <><CheckCircle2 className="w-4 h-4" /> Решено</> : <><Circle className="w-4 h-4" /> Решил</>}
                        </button>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 space-y-3" style={{ color: 'var(--c-muted)', opacity: 0.5 }}>
              <Search className="w-12 h-12" /><p className="text-sm">Задачи не найдены</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* ══ РЕЖИМ ЧТЕНИЯ ════════════════════════════ */}
      <AnimatePresence>
        {readingTask && (
          <motion.div initial={{ opacity: 0, y: 80 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 80 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed inset-0 z-[100] flex flex-col overflow-hidden" style={{ background: 'var(--c-bg)' }}>

            {/* Шапка режима чтения */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0"
              style={{ borderBottom: '1px solid var(--c-border)', paddingTop: 'calc(var(--safe-top) + 20px)' }}>
              <div className="flex items-center gap-3">
                <ToothIcon className="w-8 h-8 text-primary" />
                <span className="text-[11px] font-mono font-bold px-3 py-1 rounded-lg"
                  style={{ background: 'var(--c-primary-dim)', color: 'var(--c-primary)', border: '1px solid var(--c-primary-br)' }}>
                  Задача №{readingTask.id}
                </span>
              </div>
              <button onClick={() => setReadingTask(null)}
                className="w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-95"
                style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)', color: 'var(--c-muted)' }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Контент */}
            <ScrollArea className="flex-1 scroll-container">
              <div className="space-y-6 px-5 pt-5 pb-32 max-w-2xl mx-auto w-full overflow-x-hidden">
                {/* Вопрос */}
                <h2 className="text-xl font-bold leading-tight break-words" style={{ color: 'var(--c-text)' }}>
                  {readingTask.question}
                </h2>
                {/* Решение */}
                <div>
                  <div className="flex items-center gap-2 mb-3" style={{ borderTop: '1px solid var(--c-border)', paddingTop: '16px' }}>
                    <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--c-primary)' }} />
                    <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--c-primary)' }}>Решение</span>
                  </div>
                  <div className="text-base leading-relaxed font-light break-words whitespace-pre-wrap"
                    style={{ color: 'color-mix(in srgb, var(--c-text) 82%, transparent)' }}>
                    {formatText(readingTask.answer)}
                  </div>
                </div>
                <PersonalNote id={readingTask.id} />
              </div>
            </ScrollArea>

            {/* Плавающая кнопка AI */}
            <button onClick={() => handleAiAnalyze(readingTask.question + '\n' + readingTask.answer)}
              disabled={isAiLoading}
              className="fixed z-[110] w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all active:scale-95 disabled:opacity-50"
              style={{ bottom: '140px', right: '20px', background: 'var(--c-primary)', border: '3px solid var(--c-bg)', color: 'hsl(var(--primary-foreground))' }}>
              {isAiLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Sparkles className="w-6 h-6" />}
            </button>

            {/* Нижняя кнопка */}
            <div className="px-5 pt-3 pb-safe flex-shrink-0" style={{ borderTop: '1px solid var(--c-border)', background: 'color-mix(in srgb, var(--c-bg) 97%, transparent)' }}>
              <button
                onClick={() => { toggleResolved(readingTask.id); setReadingTask(null); }}
                className="w-full h-14 rounded-2xl flex items-center justify-center gap-3 text-base font-bold transition-all active:scale-[0.98]"
                style={resolvedIds.has(readingTask.id)
                  ? { background: 'var(--c-card)', border: '1px solid var(--c-border)', color: 'var(--c-muted)' }
                  : { background: 'var(--c-primary)', color: 'hsl(var(--primary-foreground))' }}>
                <CheckCircle2 className="w-5 h-5" />
                {resolvedIds.has(readingTask.id) ? 'Отметить нерешённой' : 'Решено!'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══ AI ПАНЕЛЬ ════════════════════════════════ */}
      <AnimatePresence>
        {isAiPanelOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => !isAiLoading && setIsAiPanelOpen(false)}
              className="fixed inset-0 z-[150]" style={{ background: 'hsl(0 0% 0% / 0.6)', backdropFilter: 'blur(4px)' }} />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 h-[80vh] rounded-t-[28px] z-[160] flex flex-col overflow-hidden pb-safe"
              style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
              <div className="flex justify-between items-center px-5 py-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--c-border)' }}>
                <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest" style={{ color: 'var(--c-primary)' }}>
                  <Sparkles className="w-5 h-5" /> AI Анализ
                </div>
                <button onClick={() => setIsAiPanelOpen(false)} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'var(--c-bg)', color: 'var(--c-muted)' }}>
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ScrollArea className="flex-1 scroll-container px-5 py-4">
                {isAiLoading ? (
                  <div className="flex flex-col items-center justify-center h-64 gap-4">
                    <Loader2 className="w-10 h-10 animate-pulse" style={{ color: 'var(--c-primary)' }} />
                    <p className="text-sm text-center" style={{ color: 'var(--c-muted)' }}>Анализирую задачу...</p>
                  </div>
                ) : aiError ? (
                  <div className="p-5 rounded-2xl text-center space-y-3" style={{ background: 'hsl(var(--destructive) / 0.08)', border: '1px solid hsl(var(--destructive) / 0.2)' }}>
                    <AlertCircle className="w-10 h-10 mx-auto" style={{ color: 'hsl(var(--destructive))' }} />
                    <p className="font-bold text-sm" style={{ color: 'hsl(var(--destructive))' }}>Ошибка AI</p>
                    <p className="text-sm" style={{ color: 'var(--c-muted)' }}>{aiError}</p>
                  </div>
                ) : (
                  <div className="prose prose-invert max-w-none pb-6">
                    <div className="text-base leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--c-text)' }}>
                      {aiResult ? <ReactMarkdown>{aiResult}</ReactMarkdown> : 'Нет данных.'}
                    </div>
                  </div>
                )}
              </ScrollArea>
              <div className="px-5 pt-3 pb-4 flex-shrink-0" style={{ borderTop: '1px solid var(--c-border)' }}>
                <button onClick={() => setIsAiPanelOpen(false)}
                  className="w-full h-12 rounded-2xl font-bold text-sm transition-all active:scale-[0.98]"
                  style={{ background: 'var(--c-primary)', color: 'hsl(var(--primary-foreground))' }}>
                  Понятно
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
