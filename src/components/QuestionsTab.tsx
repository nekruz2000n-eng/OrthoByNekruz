"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import orthoQuestionsData from '@/data/questions.json';
import microQuestionsData from '@/data/micro_questions.json';
import { SubjectType } from '@/components/SubjectSelectScreen';
import glossaryData from '@/data/glossary.json';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, BookOpen, CheckCircle2, Circle, X, Pencil, Trash2, ArrowLeft, ArrowRight } from 'lucide-react';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger
} from '@/components/ui/accordion';
import { ToothIcon } from './ToothIcon';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';

interface GlossaryItem { term: string; definition: string; image?: string | string[]; }

export const QuestionsTab = ({ onSecretTap, subject = 'ortho' }: { onSecretTap?: () => void; subject?: SubjectType }) => {
  const questionsData = subject === 'ortho' ? orthoQuestionsData : microQuestionsData;
  const lsKey         = subject === 'ortho' ? 'studiedQuestions'  : 'microStudiedQuestions';
  const lsNoteKey     = subject === 'ortho' ? 'userQuestionNotes' : 'microUserQuestionNotes';
  const [search, setSearch] = useState('');
  const [studiedIds, setStudiedIds] = useState<Set<number>>(new Set());
  const [userNotes, setUserNotes] = useState<Record<number, string>>({});
  const [isLoaded, setIsLoaded] = useState(false);
  const [readingQuestion, setReadingQuestion] = useState<any | null>(null);
  const [activeTermDef, setActiveTermDef] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [fontSize, setFontSize] = useState(16);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });

  const initialDistance = useRef<number | null>(null);
  const initialFontSize = useRef(16);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const tooltipStartPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    try { setStudiedIds(new Set(JSON.parse(localStorage.getItem(lsKey) || '[]'))); } catch {}
    try { setUserNotes(JSON.parse(localStorage.getItem(lsNoteKey) || '{}')); } catch {}
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem(lsKey, JSON.stringify(Array.from(studiedIds)));
    localStorage.setItem(lsNoteKey, JSON.stringify(userNotes));
  }, [studiedIds, userNotes, isLoaded]);

  const toggleStudied = (id: number) => {
    setStudiedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const updateNote = (id: number, text: string) => setUserNotes(p => ({ ...p, [id]: text.replace(/<[^>]*>?/gm, '') }));
  const clearNote  = (id: number) => setUserNotes(p => { const n = { ...p }; delete n[id]; return n; });

  const filtered = useMemo(() => {
    const t = search.toLowerCase();
    return questionsData.filter(q => !search || q.id.toString() === t || q.question.toLowerCase().includes(t));
  }, [search]);

  const progress = useMemo(() => questionsData.length ? (studiedIds.size / questionsData.length) * 100 : 0, [studiedIds]);

  const glossaryTerms = useMemo(() =>
    (glossaryData as GlossaryItem[]).slice().sort((a, b) => b.term.length - a.term.length), []);

  const handleGlossaryClick = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    if (t.classList.contains('glossary-term')) {
      const def = t.getAttribute('data-definition');
      if (def) { setActiveTermDef(decodeURIComponent(def)); setTooltipPos({ x: e.clientX, y: e.clientY }); e.stopPropagation(); }
    }
  };

  useEffect(() => {
    if (!activeTermDef) return;
    const h = () => setActiveTermDef(null);
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, [activeTermDef]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      initialDistance.current = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      initialFontSize.current = fontSize;
    }
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialDistance.current !== null) {
      e.preventDefault();
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      setFontSize(Math.max(12, Math.min(28, Math.round(initialFontSize.current * d / initialDistance.current))));
    }
  };
  const handleTouchEnd = (e: React.TouchEvent) => { if (e.touches.length < 2) initialDistance.current = null; };

  const handleTooltipMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation(); setDragging(true);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    tooltipStartPos.current = { x: tooltipPos.x, y: tooltipPos.y };
  };
  const handleTooltipTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation(); const t = e.touches[0]; setDragging(true);
    dragStartPos.current = { x: t.clientX, y: t.clientY };
    tooltipStartPos.current = { x: tooltipPos.x, y: tooltipPos.y };
  };

  useEffect(() => {
    if (!dragging) return;
    const move = (e: MouseEvent | TouchEvent) => {
      const cx = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const cy = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const rect = tooltipRef.current?.getBoundingClientRect();
      setTooltipPos({
        x: Math.max(10, Math.min(tooltipStartPos.current.x + cx - dragStartPos.current.x, window.innerWidth  - (rect?.width  || 200) - 10)),
        y: Math.max(10, Math.min(tooltipStartPos.current.y + cy - dragStartPos.current.y, window.innerHeight - (rect?.height || 100) - 10)),
      });
    };
    const up = () => setDragging(false);
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
    window.addEventListener('touchmove', move as any, { passive: false }); window.addEventListener('touchend', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up);
      window.removeEventListener('touchmove', move as any); window.removeEventListener('touchend', up); };
  }, [dragging]);


  const renderWithGlossary = (text: string) => {
    const frags: { type: 'normal' | 'bold'; content: string }[] = [];
    const boldRe = /\*\*(.*?)\*\*/g;
    let last = 0; let m: RegExpExecArray | null;
    while ((m = boldRe.exec(text)) !== null) {
      if (m.index > last) frags.push({ type: 'normal', content: text.substring(last, m.index) });
      frags.push({ type: 'bold', content: m[1] });
      last = m.index + m[0].length;
    }
    if (last < text.length) frags.push({ type: 'normal', content: text.substring(last) });

    const processNormal = (t: string) => {
      let r = t;
      for (const gi of glossaryTerms) {
        r = r.replace(new RegExp(gi.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), (match, offset) => {
          const prev = offset > 0 ? r[offset - 1] : '';
          const next = offset + match.length < r.length ? r[offset + match.length] : '';
          const b = (c: string) => /[\s\p{P}\p{Z}]/u.test(c) || c === '';
          return b(prev) && b(next)
            ? `<span class="glossary-term" data-definition="${encodeURIComponent(gi.definition)}">${match}</span>`
            : match;
        });
      }
      return r;
    };

    const html = frags.map(f => f.type === 'bold'
      ? `<span style="font-weight:700;color:var(--c-amber)">${f.content}</span>`
      : processNormal(f.content)
    ).join('');

    return (
      <div className="w-full break-words whitespace-pre-wrap [word-break:break-word]">
        {html.split('\n').map((line, i) => (
          <p key={i} className="indent-4 mb-1 last:mb-0" dangerouslySetInnerHTML={{ __html: line }} />
        ))}
      </div>
    );
  };

  // ── Заметка ────────────────────────────────────────
  const PersonalNote = ({ id }: { id: number }) => {
    const [editing, setEditing] = useState(false);
    const note = userNotes[id] || '';
    const [local, setLocal] = useState(note);
    const ref = useRef<HTMLTextAreaElement>(null);
    useEffect(() => { setLocal(note); }, [note]);
    useEffect(() => {
      if (editing && ref.current) { ref.current.focus(); ref.current.setSelectionRange(ref.current.value.length, ref.current.value.length); }
    }, [editing]);
    return (
      <div className="mt-4 p-4 rounded-2xl" style={{ background: 'var(--c-amber-dim)', border: '1px solid var(--c-amber-br)' }}>
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--c-amber)' }}>
            <Pencil className="w-3 h-3" /> Моя заметка
          </div>
          <div className="flex gap-3">
            {note && <button onClick={() => { clearNote(id); setLocal(''); }} style={{ color: 'hsl(var(--destructive))' }}><Trash2 className="w-3.5 h-3.5" /></button>}
            <button onClick={() => { if (editing) updateNote(id, local); setEditing(v => !v); }} className="text-xs font-semibold" style={{ color: 'var(--c-amber)' }}>
              {editing ? 'Готово' : 'Править'}
            </button>
          </div>
        </div>
        {editing
          ? <textarea ref={ref} value={local} onChange={e => setLocal(e.target.value)} onBlur={() => updateNote(id, local)}
              placeholder="Добавьте примечания..." autoFocus
              className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm resize-none min-h-[60px]"
              style={{ color: 'var(--c-text)', caretColor: 'var(--c-amber)' }} />
          : <div className="text-sm prose prose-invert max-w-none break-words whitespace-pre-wrap min-h-[24px]" onClick={() => setEditing(true)}>
              {note ? <ReactMarkdown>{note}</ReactMarkdown>
                : <p className="italic text-sm" style={{ color: 'color-mix(in srgb, var(--c-amber) 40%, transparent)' }}>Нет примечаний. Нажмите «Править»...</p>}
            </div>}
      </div>
    );
  };

  const getPreview = (t: string) => t.replace(/\*\*/g, '').trim();

  // ════════════════════════════════════════════════════
  return (
    <div className="flex flex-col h-full overflow-hidden max-w-full" style={{ background: 'var(--c-bg)' }} onClick={handleGlossaryClick}>

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
              {studiedIds.size}/{questionsData.length}
            </span>
            <div className="w-16 h-1 rounded-full overflow-hidden" style={{ background: 'var(--c-border)' }}>
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${progress}%`, background: 'var(--c-primary)' }} />
            </div>
          </div>
        </div>
        <div className="relative mx-1">
          <Input placeholder="Поиск по вопросу или №..." value={search} onChange={e => setSearch(e.target.value)}
            className="pl-10 h-11 border-none focus-visible:ring-0 focus-visible:ring-offset-0 text-sm"
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
              {filtered.map(q => {
                const studied = studiedIds.has(q.id);
                return (
                  <AccordionItem key={q.id} value={q.id.toString()} className="border-none rounded-2xl overflow-hidden w-full transition-all duration-200"
                    style={{ background: studied ? 'color-mix(in srgb, var(--c-primary) 6%, var(--c-card))' : 'var(--c-card)', border: studied ? '1px solid var(--c-primary-br)' : '1px solid var(--c-border)' }}>
                    <AccordionTrigger className="px-4 py-3.5 hover:no-underline [&>svg]:hidden">
                      <div className="flex items-start gap-3 text-left w-full pr-2">
                        <div className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border flex items-center justify-center transition-all"
                          style={studied ? { background: 'var(--c-primary-dim)', borderColor: 'var(--c-primary)' } : { borderColor: 'var(--c-border)' }}>
                          {studied && <div className="w-2 h-2 rounded-full" style={{ background: 'var(--c-primary)' }} />}
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <span className="inline-block text-[10px] font-mono font-bold px-2 py-0.5 rounded-md"
                            style={studied
                              ? { background: 'var(--c-primary-dim)', color: 'var(--c-primary)', border: '1px solid var(--c-primary-br)' }
                              : { background: 'color-mix(in srgb, var(--c-border) 60%, transparent)', color: 'var(--c-muted)', border: '1px solid var(--c-border)' }}>
                            №{q.id}
                          </span>
                          <p className="text-sm font-medium leading-snug line-clamp-2 break-words"
                            style={{ color: studied ? 'color-mix(in srgb, var(--c-text) 75%, transparent)' : 'var(--c-text)' }}>
                            {getPreview(q.question)}
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
                      <div className="rounded-xl p-3 mb-3 relative overflow-hidden"
                        style={{ background: 'color-mix(in srgb, var(--c-bg) 60%, var(--c-card))', border: '1px solid var(--c-border)' }}>
                        <div className="text-sm leading-relaxed max-h-20 overflow-hidden" style={{ color: 'color-mix(in srgb, var(--c-text) 70%, transparent)' }}>
                          {renderWithGlossary(q.answer)}
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 h-8 pointer-events-none"
                          style={{ background: 'linear-gradient(to top, color-mix(in srgb, var(--c-bg) 60%, var(--c-card)), transparent)' }} />
                      </div>
                      {/* Кнопки */}
                      <div className="flex gap-2">
                        <button onClick={() => setReadingQuestion(q)}
                          className="flex-1 flex items-center justify-center gap-2 h-10 rounded-xl text-sm font-semibold transition-all active:scale-[0.97]"
                          style={{ background: 'var(--c-primary-dim)', border: '1px solid var(--c-primary-br)', color: 'var(--c-primary)' }}>
                          <BookOpen className="w-4 h-4" /> Читать
                        </button>
                        <button onClick={() => toggleStudied(q.id)}
                          className="flex-1 flex items-center justify-center gap-2 h-10 rounded-xl text-sm font-semibold transition-all active:scale-[0.97]"
                          style={studied
                            ? { background: 'var(--c-primary)', border: '1px solid var(--c-primary)', color: 'hsl(var(--primary-foreground))' }
                            : { background: 'transparent', border: '1px solid var(--c-border)', color: 'var(--c-muted)' }}>
                          {studied ? <><CheckCircle2 className="w-4 h-4" /> Изучено</> : <><Circle className="w-4 h-4" /> Изучил</>}
                        </button>
                      </div>
                      <PersonalNote id={q.id} />
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 space-y-3" style={{ color: 'var(--c-muted)', opacity: 0.5 }}>
              <Search className="w-12 h-12" /><p className="text-sm">Ничего не найдено</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* ══ РЕЖИМ ЧТЕНИЯ ════════════════════════════ */}
      <AnimatePresence>
        {readingQuestion && (
          <motion.div initial={{ opacity: 0, y: 80 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 80 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed inset-0 z-[100] flex flex-col overflow-hidden" style={{ background: 'var(--c-bg)' }}>

            {/* Контент */}
            <div className="flex-1 overflow-y-auto px-5 pt-[var(--header-pt)] scroll-container"
              onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd} onClick={handleGlossaryClick}>
              <div className="space-y-5 pb-32 max-w-2xl mx-auto w-full overflow-x-hidden">
                <div className="flex items-center gap-2 pt-2">
                  <span className="text-[11px] font-mono font-bold px-3 py-1 rounded-lg"
                    style={{ background: 'var(--c-primary-dim)', color: 'var(--c-primary)', border: '1px solid var(--c-primary-br)' }}>
                    Вопрос №{readingQuestion.id}
                  </span>
                </div>
                <h2 className="font-semibold leading-snug break-words" style={{ fontSize: `${fontSize * 1.15}px`, color: 'var(--c-text)' }}>
                  {renderWithGlossary(readingQuestion.question)}
                </h2>
                <div className="flex items-center gap-3" style={{ borderTop: '1px solid var(--c-border)', paddingTop: '12px' }}>
                  <BookOpen className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--c-primary)' }} />
                  <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--c-primary)' }}>Ответ</span>
                </div>
                <div className="leading-relaxed font-light break-words whitespace-pre-wrap" style={{ fontSize: `${fontSize}px`, color: 'color-mix(in srgb, var(--c-text) 82%, transparent)' }}>
                  {renderWithGlossary(readingQuestion.answer)}
                </div>
                {(() => {
                  const raw = readingQuestion.images || readingQuestion.image;
                  if (!raw) return null;
                  return (Array.isArray(raw) ? raw : [raw]).map((img: string, i: number) => (
                    <div key={i} className="rounded-2xl overflow-hidden cursor-pointer" style={{ border: '1px solid var(--c-border)' }} onClick={() => setZoomedImage(img)}>
                      <img src={img} alt="" className="w-full h-auto object-contain max-h-80" loading="lazy" onContextMenu={e => e.preventDefault()} draggable={false} />
                    </div>
                  ));
                })()}
                <PersonalNote id={readingQuestion.id} />
              </div>
            </div>

            {/* Плавающая пилюля — как в TasksTab */}
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
                  onClick={() => { const i = questionsData.findIndex(q => q.id === readingQuestion.id); setReadingQuestion(questionsData[(i - 1 + questionsData.length) % questionsData.length]); }}
                  className="w-10 h-10 flex items-center justify-center rounded-full flex-shrink-0 transition-all active:scale-95"
                  style={{ color: 'var(--c-muted)' }}
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>

                {/* Изучил / Изучено */}
                <button
                  onClick={() => toggleStudied(readingQuestion.id)}
                  className="flex items-center justify-center gap-2 px-4 h-10 rounded-full text-sm font-bold transition-all active:scale-[0.97]"
                  style={studiedIds.has(readingQuestion.id)
                    ? { background: 'var(--c-primary)', color: 'hsl(var(--primary-foreground))' }
                    : { background: 'var(--c-primary-dim)', color: 'var(--c-primary)', border: '1px solid var(--c-primary-br)' }}
                >
                  {studiedIds.has(readingQuestion.id)
                    ? <><CheckCircle2 className="w-4 h-4" /> Изучено</>
                    : <><Circle className="w-4 h-4" /> Изучил</>}
                </button>

                {/* Выйти */}
                <button
                  onClick={() => setReadingQuestion(null)}
                  className="flex items-center justify-center gap-2 px-4 h-10 rounded-full text-sm font-semibold transition-all active:scale-[0.97]"
                  style={{ color: 'var(--c-muted)', border: '1px solid var(--c-border)' }}
                >
                  <X className="w-4 h-4" /> Выйти
                </button>

                {/* → */}
                <button
                  onClick={() => { const i = questionsData.findIndex(q => q.id === readingQuestion.id); setReadingQuestion(questionsData[(i + 1) % questionsData.length]); }}
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

      {/* ── ТУЛТИП ГЛОССАРИЯ ──────────────────────── */}
      {activeTermDef && (() => {
        const found = glossaryTerms.find(g => g.definition === activeTermDef);
        return (
          <div ref={tooltipRef} className="fixed z-[200] rounded-2xl p-4 shadow-2xl max-w-[280px] select-none"
            style={{ left: tooltipPos.x, top: tooltipPos.y, background: 'var(--c-card)', border: '1px solid var(--c-primary-br)', cursor: dragging ? 'grabbing' : 'grab' }}
            onMouseDown={handleTooltipMouseDown} onTouchStart={handleTooltipTouchStart} onClick={e => e.stopPropagation()}>
            {found?.image && (Array.isArray(found.image) ? found.image : [found.image]).map((img, i) => (
              <div key={i} className="mb-2 rounded-xl overflow-hidden cursor-pointer" style={{ border: '1px solid var(--c-border)' }}
                onClick={e => { e.stopPropagation(); setZoomedImage(img); }}>
                <img src={img} alt="" className="w-full h-auto object-contain max-h-32" loading="lazy" onContextMenu={e => e.preventDefault()} draggable={false} />
              </div>
            ))}
            <p className="text-sm" style={{ color: 'var(--c-text)' }}>{activeTermDef}</p>
            <p className="text-[10px] mt-2" style={{ color: 'var(--c-muted)' }}>↔ перетащите</p>
          </div>
        );
      })()}

      {/* ── ЗOOM ИЗОБРАЖЕНИЯ ──────────────────────── */}
      {zoomedImage && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center"
          style={{ background: 'hsl(0 0% 0% / 0.92)', backdropFilter: 'blur(8px)' }}
          onClick={() => { setZoomedImage(null); setScale(1); setTranslate({ x: 0, y: 0 }); }}
          onWheel={e => { e.preventDefault(); setScale(p => Math.min(5, Math.max(1, p + (e.deltaY > 0 ? -0.2 : 0.2)))); }}
          onTouchStart={e => {
            if (e.touches.length === 2) { const dx = e.touches[0].clientX - e.touches[1].clientX; const dy = e.touches[0].clientY - e.touches[1].clientY; (e.currentTarget as any).__ps = { dist: Math.hypot(dx, dy), scale, translate, cx: (e.touches[0].clientX + e.touches[1].clientX) / 2, cy: (e.touches[0].clientY + e.touches[1].clientY) / 2 }; }
            else if (e.touches.length === 1) (e.currentTarget as any).__pan = { x: e.touches[0].clientX, y: e.touches[0].clientY, translate };
          }}
          onTouchMove={e => {
            if (e.touches.length === 2 && (e.currentTarget as any).__ps) { const ps = (e.currentTarget as any).__ps; const dx = e.touches[0].clientX - e.touches[1].clientX; const dy = e.touches[0].clientY - e.touches[1].clientY; const ns = Math.min(5, Math.max(1, ps.scale * Math.hypot(dx, dy) / ps.dist)); const r = ns / ps.scale; setScale(ns); setTranslate({ x: ps.translate.x + (ps.cx - ps.translate.x) * (1 - r), y: ps.translate.y + (ps.cy - ps.translate.y) * (1 - r) }); }
            else if (e.touches.length === 1 && (e.currentTarget as any).__pan && scale > 1) { const p = (e.currentTarget as any).__pan; setTranslate({ x: p.translate.x + e.touches[0].clientX - p.x, y: p.translate.y + e.touches[0].clientY - p.y }); }
          }}
          onTouchEnd={e => { delete (e.currentTarget as any).__ps; delete (e.currentTarget as any).__pan; }}>
          <button onClick={e => { e.stopPropagation(); setZoomedImage(null); setScale(1); setTranslate({ x: 0, y: 0 }); }}
            className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center z-10"
            style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)', color: 'var(--c-muted)' }}>
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center justify-center max-w-full max-h-full" onClick={e => e.stopPropagation()} onDoubleClick={() => { setScale(1); setTranslate({ x: 0, y: 0 }); }}>
            <img src={zoomedImage} alt="" className="max-w-full max-h-full object-contain rounded-2xl select-none"
              style={{ transform: `translate(${translate.x}px,${translate.y}px) scale(${scale})`, transition: 'transform .15s ease-out', touchAction: 'none' }}
              draggable={false} onContextMenu={e => e.preventDefault()} />
          </div>
        </div>
      )}
    </div>
  );
};
