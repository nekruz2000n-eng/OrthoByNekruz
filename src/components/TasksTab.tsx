"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { SubjectType } from '@/components/SubjectSelectScreen';
import { getSubject, APP_BRAND_NAME } from '@/lib/subjects';
import { loadSubjectData } from '@/lib/subjectData';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Search, BookOpen, CheckCircle2, Circle, X, ChevronDown,
  Pencil, Trash2, ArrowLeft, ArrowRight,
} from 'lucide-react';
import { FacultyIcon } from './FacultyIcon';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { RichText, GlossaryItem } from '@/components/RichText';

export const TasksTab = ({
  onSecretTap,
  subject = 'ortho',
}: {
  onSecretTap?: () => void;
  subject?: SubjectType;
}) => {
  const cfg         = getSubject(subject);
  const lsTasks     = subject === 'ortho' ? 'resolvedTasks'  : `${cfg?.lsPrefix || subject}_resolvedTasks`;
  const lsNotes     = subject === 'ortho' ? 'userTaskNotes'  : `${cfg?.lsPrefix || subject}_userTaskNotes`;
  const accentColor = cfg?.color || 'var(--c-primary)';
  const [loadedTasksData, setLoadedTasksData] = useState<any[]>([]);
  const [microLoading,    setMicroLoading]    = useState(false);
  const tasksData = loadedTasksData;
  const [dynamicGlossary, setDynamicGlossary] = useState<GlossaryItem[]>([]);

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
  }, [subject]);

  useEffect(() => {
    let cancelled = false;
    setMicroLoading(true);
    setLoadedTasksData([]);
    loadSubjectData(subject, 'tasks')
      .then(d => { if (!cancelled) setLoadedTasksData(d as any[]); })
      .finally(() => { if (!cancelled) setMicroLoading(false); });
    return () => { cancelled = true; };
  }, [subject]);

  useEffect(() => {
    let cancelled = false;
    loadSubjectData(subject, 'glossary')
      .then(d => { if (!cancelled) setDynamicGlossary(d as GlossaryItem[]); });
    return () => { cancelled = true; };
  }, [subject]);

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
      !search || task.id.toString() === t || task.question.toLowerCase().includes(t),
    );
  }, [search, tasksData]);

  const progress = useMemo(
    () => (tasksData.length ? (resolvedIds.size / tasksData.length) * 100 : 0),
    [resolvedIds, tasksData],
  );

  // ── Pinch-to-zoom (размер шрифта в режиме чтения) ────────────────────────
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      initialDistance.current = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      initialFontSize.current = fontSize;
    }
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialDistance.current !== null) {
      e.preventDefault();
      const d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      setFontSize(Math.max(12, Math.min(28, Math.round(initialFontSize.current * d / initialDistance.current))));
    }
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) initialDistance.current = null;
  };

  // ── Форматирование текста с жирным/курсивом ──────────────────────────────
  const renderItalic = (s: string, keyPrefix: string) =>
    s.split('_').map((seg, k) =>
      k % 2 === 1
        ? <i key={`${keyPrefix}-i${k}`}>{seg}</i>
        : <React.Fragment key={`${keyPrefix}-t${k}`}>{seg}</React.Fragment>,
    );

  const formatText = (text: string) => (
    <div className="w-full break-words whitespace-pre-wrap [word-break:break-word]">
      {text.split('\n').map((line, i) => (
        <p key={i} className="mb-1 last:mb-0">
          {line.split('**').map((part, j) =>
            j % 2 === 1
              ? <b key={j} style={{ color: 'var(--c-amber)', fontWeight: 600 }}>{renderItalic(part, `b${i}-${j}`)}</b>
              : <React.Fragment key={j}>{renderItalic(part, `t${i}-${j}`)}</React.Fragment>,
          )}
        </p>
      ))}
    </div>
  );

  // ── Заметка ───────────────────────────────────────────────────────────────
  const PersonalNote = ({ id }: { id: number }) => {
    const [editing, setEditing] = useState(false);
    const note = userNotes[id] || '';
    const [local, setLocal] = useState(note);
    const ref = useRef<HTMLTextAreaElement>(null);
    useEffect(() => { setLocal(note); }, [note]);
    useEffect(() => {
      if (editing && ref.current) {
        ref.current.focus();
        ref.current.setSelectionRange(ref.current.value.length, ref.current.value.length);
      }
    }, [editing]);
    return (
      <div className="mt-4 p-3.5 rounded-2xl" style={{ background: 'var(--c-amber-dim)', border: '1px solid var(--c-amber-br)' }}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--c-amber)' }}>
            <Pencil className="w-3 h-3" /> Моя заметка
          </div>
          <div className="flex gap-3 items-center">
            {note && (
              <button onClick={() => { clearNote(id); setLocal(''); }} style={{ color: 'hsl(var(--destructive))' }}>
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => { if (editing) updateNote(id, local); setEditing(v => !v); }}
              className="text-[11px] font-semibold"
              style={{ color: 'var(--c-amber)' }}
            >
              {editing ? 'Готово' : 'Править'}
            </button>
          </div>
        </div>
        {editing
          ? <textarea
              ref={ref} value={local} onChange={e => setLocal(e.target.value)}
              onBlur={() => updateNote(id, local)} placeholder="Добавьте примечания…" autoFocus
              className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm resize-none min-h-[60px]"
              style={{ color: 'var(--c-text)', caretColor: 'var(--c-amber)' }}
            />
          : <div
              className="text-sm prose prose-invert max-w-none break-words whitespace-pre-wrap min-h-[24px]"
              onClick={() => setEditing(true)}
            >
              {note
                ? <ReactMarkdown>{note}</ReactMarkdown>
                : <p className="italic text-sm" style={{ color: 'color-mix(in srgb, var(--c-amber) 45%, transparent)' }}>
                    Нет примечаний. Нажмите «Править»…
                  </p>}
            </div>}
      </div>
    );
  };

  const getPreview = (t: string) => t.replace(/\*\*/g, '').trim();

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden max-w-full" style={{ background: 'var(--c-bg)' }}>

     {/* ─── ШАПКА ───────────────────────────────────────────────────────── */}
<div
  className="px-4 pt-1 pb-3 sticky top-0 z-10"
  style={{
    background: 'color-mix(in srgb, var(--c-bg) 92%, transparent)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    borderBottom: '1px solid var(--c-border)',
    /* Тот же уменьшенный отступ, что и в других вкладках */
    paddingTop: 'max(12px, calc(var(--header-pt) - 24px))',
  }}
>
  <div className="flex items-start justify-between px-1">
    {/* 1. Левая безопасная зона */}
    <div className="w-[75px] flex-shrink-0" />

    {/* 2. Центрированный блок с логотипом, названием и прогрессом */}
    <div className="flex flex-col items-center justify-center flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <div
          className="w-8 h-8 rounded-[10px] flex items-center justify-center flex-shrink-0"
          style={{ background: `color-mix(in srgb, ${accentColor} 14%, transparent)` }}
        >
          <FacultyIcon size={20} onClick={onSecretTap} />
        </div>
        <h1 className="text-[16px] font-bold tracking-tight leading-tight truncate" style={{ color: 'var(--c-text)' }}>
          {cfg?.brandName || APP_BRAND_NAME}
        </h1>
      </div>
      
      {/* Обертка w-fit для выравнивания полоски по ширине текста */}
      <div className="flex flex-col items-stretch w-fit mt-1">
        <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5 text-center" style={{ color: accentColor }}>
          Задачи · {cfg?.label || subject}
        </p>

        {/* Полоска прогресса (w-full заполнит ровно ширину текста) */}
        <div className="w-full h-[3px] rounded-full overflow-hidden" style={{ background: 'var(--c-border)' }}>
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${progress}%`, background: accentColor }} />
        </div>
      </div>
    </div>

    {/* 3. Правая безопасная зона */}
    <div className="w-[75px] flex-shrink-0" />
  </div>
</div>

      {/* ─── ПОИСК ───────────────────────────────────────────────────────── */}
      <div className="px-4 pt-3 pb-1">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--c-muted)' }} />
          <Input
            placeholder="Поиск по № или условию…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 h-11 border focus-visible:ring-0 focus-visible:ring-offset-0 text-sm rounded-xl"
            style={{
              background: 'var(--c-card)',
              borderColor: 'var(--c-border)',
              color: 'var(--c-text)',
              caretColor: 'var(--c-primary)',
            }}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--c-muted)' }}>
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ─── СПИСОК ─────────────────────────────────────────────────────── */}
      <ScrollArea className="flex-1 scroll-container">
        <div className="px-3 pt-2 mx-auto max-w-2xl w-full" style={{ paddingBottom: 'var(--scroll-pb)' }}>
          {microLoading && tasksData.length === 0 ? (
            <div className="flex items-center justify-center py-24" style={{ color: 'var(--c-primary)' }}>
              <svg className="animate-spin w-8 h-8" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
            </div>
          ) : filtered.length > 0 ? (
            <Accordion type="single" collapsible className="space-y-2 w-full">
              {filtered.map(task => {
                const resolved = resolvedIds.has(task.id);
                return (
                  <AccordionItem
                    key={task.id}
                    value={task.id.toString()}
                    className="border-none rounded-2xl overflow-hidden w-full relative transition-all duration-200"
                    style={{
                      background: 'var(--c-card)',
                      border: `1px solid ${resolved ? 'var(--c-primary-br)' : 'var(--c-border)'}`,
                    }}
                  >
                    {/* статус-полоска слева */}
                    <div
                      className="absolute left-0 top-0 bottom-0 w-[3px]"
                      style={{ background: resolved ? 'var(--c-primary)' : 'var(--c-border)' }}
                    />

                    <AccordionTrigger className="px-4 py-3 pl-4 hover:no-underline [&>svg]:hidden">
                      <div className="flex items-start gap-3 text-left w-full pr-1">
                        {/* status circle */}
                        <div
                          className="mt-0.5 flex-shrink-0 w-[18px] h-[18px] rounded-full border-[1.5px] flex items-center justify-center transition-all"
                          style={resolved
                            ? { background: 'var(--c-primary)', borderColor: 'var(--c-primary)' }
                            : { background: 'transparent', borderColor: 'var(--c-input)' }}
                        >
                          {resolved && (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--primary-foreground))" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </div>

                        <div className="flex-1 min-w-0 space-y-1">
                          <span
                            className="inline-block text-[10px] font-mono font-bold px-2 py-0.5 rounded-md"
                            style={resolved
                              ? { background: 'var(--c-primary-dim)', color: 'var(--c-primary)', border: '1px solid var(--c-primary-br)' }
                              : { background: 'color-mix(in srgb, var(--c-border) 55%, transparent)', color: 'var(--c-muted)', border: '1px solid var(--c-border)' }}
                          >
                            Задача №{task.id}
                          </span>
                          <p
                            className="text-[13.5px] font-medium leading-snug line-clamp-2 break-words"
                            style={{ color: resolved ? 'var(--c-muted)' : 'var(--c-text)' }}
                          >
                            {getPreview(task.question)}
                          </p>
                        </div>
                        <ChevronDown className="w-4 h-4 mt-1 flex-shrink-0 transition-transform duration-200 [.is-open_&]:rotate-180" style={{ color: 'var(--c-muted)' }} />
                      </div>
                    </AccordionTrigger>

                    <AccordionContent className="px-4 pb-4 pt-0 w-full overflow-hidden">
                      {/* preview answer */}
                      <div
                        className="rounded-xl p-3 mb-3 relative overflow-hidden"
                        style={{ background: 'var(--c-bg)', border: '1px solid var(--c-border)' }}
                      >
                        <div className="text-sm leading-relaxed max-h-20 overflow-hidden" style={{ color: 'var(--c-muted)' }}>
                          {formatText(task.answer)}
                        </div>
                        <div
                          className="absolute bottom-0 left-0 right-0 h-8 pointer-events-none"
                          style={{ background: 'linear-gradient(to top, var(--c-bg), transparent)' }}
                        />
                      </div>

                      {/* actions */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => setReadingTask(task)}
                          className="flex-1 h-10 rounded-xl text-[13px] font-bold inline-flex items-center justify-center gap-2 transition-all active:scale-[0.97]"
                          style={{ background: 'var(--c-primary-dim)', border: '1px solid var(--c-primary-br)', color: 'var(--c-primary)' }}
                        >
                          <BookOpen className="w-4 h-4" /> Читать
                        </button>
                        <button
                          onClick={() => toggleResolved(task.id)}
                          className="flex-1 h-10 rounded-xl text-[13px] font-bold inline-flex items-center justify-center gap-2 transition-all active:scale-[0.97]"
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
            <div className="flex flex-col items-center justify-center py-24 gap-3" style={{ color: 'var(--c-muted)', opacity: 0.55 }}>
              <Search className="w-10 h-10" /><p className="text-sm">Задачи не найдены</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* ══ РЕЖИМ ЧТЕНИЯ ══════════════════════════════════════════════════ */}
      <AnimatePresence>
        {readingTask && (
          <motion.div
            initial={{ opacity: 0, y: 80 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 80 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed inset-0 z-[100] flex flex-col overflow-hidden"
            style={{ background: 'var(--c-bg)' }}
          >
            {/* top bar */}
            <div
              className="flex items-center justify-center px-3 py-2"
              style={{
                background: 'color-mix(in srgb, var(--c-bg) 92%, transparent)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                borderBottom: '1px solid var(--c-border)',
                paddingTop: 'calc(var(--header-pt) - 28px)',
              }}
            >
              <div className="text-center min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--c-muted)' }}>Чтение</div>
                <div className="text-[12px] font-mono font-bold leading-tight" style={{ color: 'var(--c-text)' }}>
                  №{readingTask.id} · {cfg?.label || subject}
                </div>
              </div>
            </div>

            {/* content */}
            <div
              className="flex-1 overflow-y-auto px-5 scroll-container"
              onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
            >
              <div className="space-y-5 pt-5 pb-36 max-w-2xl mx-auto w-full overflow-x-hidden">
                <div>
                  <span
                    className="text-[11px] font-mono font-bold px-3 py-1 rounded-lg inline-block"
                    style={{ background: 'var(--c-primary-dim)', color: 'var(--c-primary)', border: '1px solid var(--c-primary-br)' }}
                  >
                    Задача №{readingTask.id}
                  </span>
                </div>
                <RichText
                  text={readingTask.question}
                  relatedTerms={(readingTask as any).relatedTerms}
                  glossaryTerms={dynamicGlossary}
                  fontSize={fontSize * 1.15}
                  className="font-semibold"
                />

                <div className="flex items-center gap-2.5 pt-3" style={{ borderTop: '1px solid var(--c-border)' }}>
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--c-primary)' }} />
                  <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--c-primary)' }}>
                    Решение
                  </span>
                </div>

                <RichText
                  text={readingTask.answer}
                  relatedTerms={(readingTask as any).relatedTerms}
                  glossaryTerms={dynamicGlossary}
                  fontSize={fontSize}
                />

                <PersonalNote id={readingTask.id} />
              </div>
            </div>

            {/* floating bottom pill */}
            <div
              className="fixed left-0 right-0 px-5 z-[110] flex justify-center"
              style={{ bottom: 'calc(var(--nav-bottom, 12px) + 16px)' }}
            >
              <div
                className="flex items-center gap-1 p-1.5 rounded-full"
                style={{
                  background: 'var(--c-card)',
                  border: '1px solid var(--c-border)',
                  boxShadow: '0 10px 28px hsl(0 0% 0% / 0.18), 0 2px 6px hsl(0 0% 0% / 0.1)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                }}
              >
                <button
                  onClick={() => {
                    const i = tasksData.findIndex(t => t.id === readingTask.id);
                    setReadingTask(tasksData[(i - 1 + tasksData.length) % tasksData.length]);
                  }}
                  className="w-10 h-10 flex items-center justify-center rounded-full transition-all active:scale-95"
                  style={{ color: 'var(--c-muted)' }}
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>

                <button
                  onClick={() => toggleResolved(readingTask.id)}
                  className="px-3.5 h-10 rounded-full text-[13px] font-bold flex items-center gap-1.5 transition-all active:scale-[0.97]"
                  style={resolvedIds.has(readingTask.id)
                    ? { background: 'var(--c-primary)', color: 'hsl(var(--primary-foreground))', border: '1px solid var(--c-primary)' }
                    : { background: 'var(--c-primary-dim)', color: 'var(--c-primary)', border: '1px solid var(--c-primary-br)' }}
                >
                  {resolvedIds.has(readingTask.id)
                    ? <><CheckCircle2 className="w-4 h-4" /> Решено</>
                    : <><Circle className="w-4 h-4" /> Решить</>}
                </button>

                <button
                  onClick={() => setReadingTask(null)}
                  className="px-3.5 h-10 rounded-full text-[13px] font-semibold flex items-center gap-1.5 transition-all active:scale-[0.97]"
                  style={{ background: 'transparent', color: 'var(--c-muted)', border: '1px solid var(--c-border)' }}
                >
                  <X className="w-4 h-4" /> Выйти
                </button>

                <button
                  onClick={() => {
                    const i = tasksData.findIndex(t => t.id === readingTask.id);
                    setReadingTask(tasksData[(i + 1) % tasksData.length]);
                  }}
                  className="w-10 h-10 flex items-center justify-center rounded-full transition-all active:scale-95"
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
