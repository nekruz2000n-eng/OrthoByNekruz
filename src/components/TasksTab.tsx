"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import orthoTasksData from '@/data/tasks.json';
import microTasksData from '@/data/micro_tasks.json';
import { SubjectType } from '@/components/SubjectSelectScreen';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger
} from '@/components/ui/accordion';
import {
  Search, BookOpen, CheckCircle2, Circle, X,
  Pencil, Trash2, ArrowLeft, ArrowRight
} from 'lucide-react';
import { ToothIcon } from './ToothIcon';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';

export const TasksTab = ({ onSecretTap, subject = 'ortho' }: { onSecretTap?: () => void; subject?: SubjectType }) => {
  const tasksData = subject === 'ortho' ? orthoTasksData : microTasksData;
  const lsTasks   = subject === 'ortho' ? 'resolvedTasks'  : 'microResolvedTasks';
  const lsNotes   = subject === 'ortho' ? 'userTaskNotes'  : 'microUserTaskNotes';
  const [search,      setSearch]      = useState('');
  const [resolvedIds, setResolvedIds] = useState<Set<number>>(new Set());
  const [userNotes,   setUserNotes]   = useState<Record<number, string>>({});
  const [isLoaded,    setIsLoaded]    = useState(false);
  const [readingTask, setReadingTask] = useState<any | null>(null);
  const [fontSize,    setFontSize]    = useState(16);

  const initialDistance = useRef<number | null>(null);
  const initialFontSize = useRef(16);

  // ── Загрузка ─────────────────────────────────────────────────────────────
  useEffect(() => {
    try { setResolvedIds(new Set(JSON.parse(localStorage.getItem(lsTasks) || '[]'))); } catch {}
    try { setUserNotes(JSON.parse(localStorage.getItem(lsNotes) || '{}')); } catch {}
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem(lsTasks, JSON.stringify(Array.from(resolvedIds)));
    localStorage.setItem(lsNotes, JSON.stringify(userNotes));
  }, [resolvedIds, userNotes, isLoaded]);

  const toggleResolved = (id: number) =>
    setResolvedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const updateNote = (id: number, text: string) =>
    setUserNotes(p => ({ ...p, [id]: text.replace(/<[^>]*>?/gm, '') }));
  const clearNote = (id: number) =>
    setUserNotes(p => { const n = { ...p }; delete n[id]; return n; });

  // ── Фильтрация ────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const t = search.toLowerCase();
    return tasksData.filter(task =>
      !search || task.id.toString() === t || task.question.toLowerCase().includes(t)
    );
  }, [search]);

  const progress = useMemo(() =>
    tasksData.length ? (resolvedIds.size / tasksData.length) * 100 : 0,
  [resolvedIds]);

  // ── Pinch-to-zoom (размер шрифта в режиме чтения) ────────────────────────
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      initialDistance.current = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      initialFontSize.current = fontSize;
    }
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialDistance.current !== null) {
      e.preventDefault();
      const d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      setFontSize(Math.max(12, Math.min(28, Math.round(initialFontSize.current * d / initialDistance.current))));
    }
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) initialDistance.current = null;
  };

  // ── Форматирование текста с жирным ────────────────────────────────────────
  const formatText = (text: string) => (
    <div className="w-full break-words whitespace-pre-wrap [word-break:break-word]">
      {text.split('\n').map((line, i) => (
        <p key={i} className="mb-1 last:mb-0">
          {line.split('**').map((part, j) =>
            j % 2 === 1
              ? <b key={j} style={{ color: 'var(--c-amber)', fontWeight: 600 }}>{part}</b>
              : part
          )}
        </p>
      ))}
    </div>
  );

  // ── Заметка ───────────────────────────────────────────────────────────────
  const PersonalNote = ({ id }: { id: number }) => {
    const [editing, setEditing] = useState(false);
    const note  = userNotes[id] || '';
    const [local, setLocal] = useState(note);
    const ref   = useRef<HTMLTextAreaElement>(null);
    useEffect(() => { setLocal(note); }, [note]);
    useEffect(() => {
      if (editing && ref.current) {
        ref.current.focus();
        ref.current.setSelectionRange(ref.current.value.length, ref.current.value.length);
      }
    }, [editing]);
    return (
      <div className="mt-4 p-4 rounded-2xl" style={{ background: 'var(--c-amber-dim)', border: '1px solid var(--c-amber-br)' }}>
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--c-amber)' }}>
            <Pencil className="w-3 h-3" /> Моя заметка
          </div>
          <div className="flex gap-3">
            {note && (
              <button onClick={() => { clearNote(id); setLocal(''); }} style={{ color: 'hsl(var(--destructive))' }}>
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => { if (editing) updateNote(id, local); setEditing(v => !v); }}
              className="text-xs font-semibold"
              style={{ color: 'var(--c-amber)' }}
            >
              {editing ? 'Готово' : 'Править'}
            </button>
          </div>
        </div>
        {editing
          ? <textarea ref={ref} value={local} onChange={e => setLocal(e.target.value)}
              onBlur={() => updateNote(id, local)} placeholder="Добавьте примечания..." autoFocus
              className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm resize-none min-h-[60px]"
              style={{ color: 'var(--c-text)', caretColor: 'var(--c-amber)' }} />
          : <div
              className="text-sm prose prose-invert max-w-none break-words whitespace-pre-wrap min-h-[24px]"
              onClick={() => setEditing(true)}
            >
              {note
                ? <ReactMarkdown>{note}</ReactMarkdown>
                : <p className="italic text-sm" style={{ color: 'color-mix(in srgb, var(--c-amber) 40%, transparent)' }}>
                    Нет примечаний. Нажмите «Править»...
                  </p>}
            </div>}
      </div>
    );
  };

  const getPreview = (t: string) => t.replace(/\*\*/g, '').trim();

  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div className="flex flex-col h-full overflow-hidden max-w-full" style={{ background: 'var(--c-bg)' }}>

      {/* ── ШАПКА ─────────────────────────────────── */}
      <div
        className="px-4 py-3 space-y-3 sticky top-0 z-10"
        style={{
          background: 'color-mix(in srgb, var(--c-bg) 92%, transparent)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid var(--c-border)',
          paddingTop: 'var(--header-pt)',
        }}
      >
        <div className="flex justify-between items-center px-1">
          <div className="flex items-center gap-3">
            <ToothIcon className="w-9 h-9 text-primary" onClick={onSecretTap} />
            <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--c-text)' }}>
              {subject === 'micro' ? 'MicroByNekruz' : 'OrthoByNekruz'}
            </h1>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest" style={{ color: 'var(--c-primary)' }}>
              {resolvedIds.size}/{tasksData.length}
            </span>
            <div className="w-16 h-1 rounded-full overflow-hidden" style={{ background: 'var(--c-border)' }}>
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${progress}%`, background: 'var(--c-primary)' }} />
            </div>
          </div>
        </div>
        <div className="relative mx-1">
          <Input
            placeholder="Поиск по № или условию..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="pl-10 h-11 border-none focus-visible:ring-0 focus-visible:ring-offset-0 text-sm"
            style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)', color: 'var(--c-text)', caretColor: 'var(--c-primary)' }}
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--c-muted)' }} />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--c-muted)' }}>
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ── СПИСОК ЗАДАЧ ──────────────────────────── */}
      <ScrollArea className="flex-1 scroll-container">
        <div className="py-3 px-3 mx-auto max-w-2xl w-full" style={{ paddingBottom: 'var(--scroll-pb)' }}>
          {filtered.length > 0 ? (
            <Accordion type="single" collapsible className="space-y-2 w-full">
              {filtered.map(task => {
                const resolved = resolvedIds.has(task.id);
                return (
                  <AccordionItem
                    key={task.id}
                    value={task.id.toString()}
                    className="border-none rounded-2xl overflow-hidden w-full transition-all duration-200"
                    style={{
                      background: resolved ? 'color-mix(in srgb, var(--c-primary) 6%, var(--c-card))' : 'var(--c-card)',
                      border:     resolved ? '1px solid var(--c-primary-br)' : '1px solid var(--c-border)',
                    }}
                  >
                    <AccordionTrigger className="px-4 py-3.5 hover:no-underline [&>svg]:hidden">
                      <div className="flex items-start gap-3 text-left w-full pr-2">
                        {/* Кружок статуса */}
                        <div
                          className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border flex items-center justify-center transition-all"
                          style={resolved
                            ? { background: 'var(--c-primary-dim)', borderColor: 'var(--c-primary)' }
                            : { borderColor: 'var(--c-border)' }}
                        >
                          {resolved && <div className="w-2 h-2 rounded-full" style={{ background: 'var(--c-primary)' }} />}
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <span
                            className="inline-block text-[10px] font-mono font-bold px-2 py-0.5 rounded-md"
                            style={resolved
                              ? { background: 'var(--c-primary-dim)', color: 'var(--c-primary)', border: '1px solid var(--c-primary-br)' }
                              : { background: 'color-mix(in srgb, var(--c-border) 60%, transparent)', color: 'var(--c-muted)', border: '1px solid var(--c-border)' }}
                          >
                            Задача №{task.id}
                          </span>
                          <p
                            className="text-sm font-medium leading-snug line-clamp-2 break-words"
                            style={{ color: resolved ? 'color-mix(in srgb, var(--c-text) 75%, transparent)' : 'var(--c-text)' }}
                          >
                            {getPreview(task.question)}
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
                      {/* Превью ответа */}
                      <div
                        className="rounded-xl p-3 mb-3 relative overflow-hidden"
                        style={{ background: 'color-mix(in srgb, var(--c-bg) 60%, var(--c-card))', border: '1px solid var(--c-border)' }}
                      >
                        <div
                          className="text-sm leading-relaxed max-h-20 overflow-hidden"
                          style={{ color: 'color-mix(in srgb, var(--c-text) 70%, transparent)' }}
                        >
                          {formatText(task.answer)}
                        </div>
                        <div
                          className="absolute bottom-0 left-0 right-0 h-8 pointer-events-none"
                          style={{ background: 'linear-gradient(to top, color-mix(in srgb, var(--c-bg) 60%, var(--c-card)), transparent)' }}
                        />
                      </div>
                      {/* Кнопки — как в QuestionsTab */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => setReadingTask(task)}
                          className="flex-1 flex items-center justify-center gap-2 h-10 rounded-xl text-sm font-semibold transition-all active:scale-[0.97]"
                          style={{ background: 'var(--c-primary-dim)', border: '1px solid var(--c-primary-br)', color: 'var(--c-primary)' }}
                        >
                          <BookOpen className="w-4 h-4" /> Читать
                        </button>
                        <button
                          onClick={() => toggleResolved(task.id)}
                          className="flex-1 flex items-center justify-center gap-2 h-10 rounded-xl text-sm font-semibold transition-all active:scale-[0.97]"
                          style={resolved
                            ? { background: 'var(--c-primary)', border: '1px solid var(--c-primary)', color: 'hsl(var(--primary-foreground))' }
                            : { background: 'transparent', border: '1px solid var(--c-border)', color: 'var(--c-muted)' }}
                        >
                          {resolved
                            ? <><CheckCircle2 className="w-4 h-4" /> Решено</>
                            : <><Circle className="w-4 h-4" /> Решил</>}
                        </button>
                      </div>
                      <PersonalNote id={task.id} />
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

      {/* ══ РЕЖИМ ЧТЕНИЯ (как в QuestionsTab) ════════════════════════════════ */}
      <AnimatePresence>
        {readingTask && (
          <motion.div
            initial={{ opacity: 0, y: 80 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 80 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed inset-0 z-[100] flex flex-col overflow-hidden"
            style={{ background: 'var(--c-bg)' }}
          >
            {/* Контент */}
            <div
              className="flex-1 overflow-y-auto px-5 pt-[var(--header-pt)] scroll-container"
              onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
            >
              <div className="space-y-5 pb-32 max-w-2xl mx-auto w-full overflow-x-hidden">
                {/* Бейдж */}
                <div className="flex items-center gap-2 pt-2">
                  <span
                    className="text-[11px] font-mono font-bold px-3 py-1 rounded-lg"
                    style={{ background: 'var(--c-primary-dim)', color: 'var(--c-primary)', border: '1px solid var(--c-primary-br)' }}
                  >
                    Задача №{readingTask.id}
                  </span>
                </div>

                {/* Условие */}
                <h2
                  className="font-semibold leading-snug break-words"
                  style={{ fontSize: `${fontSize * 1.15}px`, color: 'var(--c-text)' }}
                >
                  {formatText(readingTask.question)}
                </h2>

                {/* Разделитель */}
                <div className="flex items-center gap-3" style={{ borderTop: '1px solid var(--c-border)', paddingTop: '12px' }}>
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--c-primary)' }} />
                  <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--c-primary)' }}>
                    Решение
                  </span>
                </div>

                {/* Ответ */}
                <div
                  className="leading-relaxed font-light break-words whitespace-pre-wrap"
                  style={{ fontSize: `${fontSize}px`, color: 'color-mix(in srgb, var(--c-text) 82%, transparent)' }}
                >
                  {formatText(readingTask.answer)}
                </div>

                <PersonalNote id={readingTask.id} />
              </div>
            </div>

            {/* Плавающая пилюля навигации режима чтения */}
            <div
              className="fixed left-0 right-0 px-5 z-[110] flex justify-center"
              style={{ bottom: 'calc(var(--nav-bottom, 12px) + 12px)' }}
            >
              <div
                className="flex items-center gap-1.5 p-1.5 rounded-[28px] shadow-2xl"
                style={{
                  background: 'var(--c-nav-bg)',
                  backdropFilter: 'blur(24px)',
                  WebkitBackdropFilter: 'blur(24px)',
                  border: '1.5px solid var(--c-nav-border)',
                  boxShadow: '0 8px 32px hsl(0 0% 0% / 0.4)',
                }}
              >
                {/* ← */}
                <button
                  onClick={() => {
                    const i = tasksData.findIndex(t => t.id === readingTask.id);
                    setReadingTask(tasksData[(i - 1 + tasksData.length) % tasksData.length]);
                  }}
                  className="w-10 h-10 flex items-center justify-center rounded-full flex-shrink-0 transition-all active:scale-95"
                  style={{ color: 'var(--c-muted)' }}
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>

                {/* Решено / Решил */}
                <button
                  onClick={() => toggleResolved(readingTask.id)}
                  className="flex items-center justify-center gap-2 px-4 h-10 rounded-full text-sm font-bold transition-all active:scale-[0.97]"
                  style={resolvedIds.has(readingTask.id)
                    ? { background: 'var(--c-primary)', color: 'hsl(var(--primary-foreground))' }
                    : { background: 'var(--c-primary-dim)', color: 'var(--c-primary)', border: '1px solid var(--c-primary-br)' }}
                >
                  {resolvedIds.has(readingTask.id)
                    ? <><CheckCircle2 className="w-4 h-4" /> Изучено</>
                    : <><Circle className="w-4 h-4" /> Изучить</>}
                </button>

                {/* Выйти */}
                <button
                  onClick={() => setReadingTask(null)}
                  className="flex items-center justify-center gap-2 px-4 h-10 rounded-full text-sm font-semibold transition-all active:scale-[0.97]"
                  style={{ color: 'var(--c-muted)', border: '1px solid var(--c-border)' }}
                >
                  <X className="w-4 h-4" /> Выйти
                </button>

                {/* → */}
                <button
                  onClick={() => {
                    const i = tasksData.findIndex(t => t.id === readingTask.id);
                    setReadingTask(tasksData[(i + 1) % tasksData.length]);
                  }}
                  className="w-10 h-10 flex items-center justify-center rounded-full flex-shrink-0 transition-all active:scale-95"
                  style={{ color: 'var(--c-muted)' }}
                >
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
