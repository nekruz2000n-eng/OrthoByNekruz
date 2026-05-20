"use client";

import React, { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import { SubjectType } from '@/components/SubjectSelectScreen';
import { getSubject } from '@/lib/subjects';
import { loadSubjectData } from '@/lib/subjectData';
import { CachedImage } from '@/components/CachedImage';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, BookOpen, CheckCircle2, Circle, X, Pencil, Trash2, ArrowLeft, ArrowRight } from 'lucide-react';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger
} from '@/components/ui/accordion';
import { ToothIcon } from './ToothIcon';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { termRegexSource as _termRegexSource } from '@/lib/glossaryUtils';

// Добавили variations
interface GlossaryItem { term: string; variations?: string[]; definition: string; image?: string | string[]; }

// ── AudioPlayer вынесен НА УРОВЕНЬ МОДУЛЯ ────────────────────────────────────
const _AUDIO_CACHE = 'ortho-audio-v1';
const _AUDIO_SPEEDS = [0.75, 1, 1.25, 1.5, 2];
let _activeAudio: HTMLAudioElement | null = null;

const AudioPlayer = ({ src, accentColor }: { src: string; accentColor: string }) => {
  const audioRef                          = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying]             = useState(false);
  const [current, setCurrent]             = useState(0);
  const [duration, setDuration]           = useState(0);
  const [loading, setLoading]             = useState(true);
  const [speed, setSpeed]                 = useState(1);
  const [cached, setCached]               = useState(false);
  const [caching, setCaching]             = useState(false);
  const [cacheProgress, setCacheProgress] = useState(0);
  const [blobUrl, setBlobUrl]             = useState<string | null>(null);
  const posKey = `audio-pos:${src}`;

  useEffect(() => {
    (async () => {
      try {
        const cache = await caches.open(_AUDIO_CACHE);
        const hit   = await cache.match(src);
        if (hit) {
          const blob = await hit.blob();
          const url  = URL.createObjectURL(blob);
          setBlobUrl(url);
          setCached(true);
        }
      } catch {}
    })();
    return () => { if (blobUrl) URL.revokeObjectURL(blobUrl); };
  }, [src]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a || !blobUrl) return;
    const wasPlaying = !a.paused;
    const t = a.currentTime;
    a.src = blobUrl;
    a.load();
    a.currentTime = t;
    if (wasPlaying) a.play().catch(() => {});
  }, [blobUrl]);

  const fmt = (s: number) => {
    if (!isFinite(s) || isNaN(s)) return '0:00';
    return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
  };

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
    } else {
      if (_activeAudio && _activeAudio !== a) _activeAudio.pause();
      _activeAudio = a;
      a.play().catch(() => {});
    }
  };

  const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = Number(e.target.value);
    setCurrent(Number(e.target.value));
  };

  const skip = (sec: number) => {
    const a = audioRef.current;
    if (!a) return;
    const next = Math.max(0, Math.min(a.duration, a.currentTime + sec));
    a.currentTime = next;
    setCurrent(next);
  };

  const cycleSpeed = () => {
    const a = audioRef.current;
    const next = _AUDIO_SPEEDS[(_AUDIO_SPEEDS.indexOf(speed) + 1) % _AUDIO_SPEEDS.length];
    setSpeed(next);
    if (a) a.playbackRate = next;
  };

  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLAudioElement>) => {
    const t = (e.target as HTMLAudioElement).currentTime;
    setCurrent(t);
    if (Math.round(t) % 5 === 0) {
      try { localStorage.setItem(posKey, String(t)); } catch {}
    }
  };

  const handleLoaded = (e: React.SyntheticEvent<HTMLAudioElement>) => {
    const a = e.target as HTMLAudioElement;
    setDuration(a.duration);
    setLoading(false);
    try {
      const saved = parseFloat(localStorage.getItem(posKey) || '0');
      if (saved > 0 && saved < a.duration - 3) { a.currentTime = saved; setCurrent(saved); }
    } catch {}
  };

  const getMime = (url: string) => {
    if (url.includes('.m4a')) return 'audio/mp4';
    if (url.includes('.ogg')) return 'audio/ogg';
    if (url.includes('.wav')) return 'audio/wav';
    return 'audio/mpeg';
  };

  const cacheAudio = async () => {
    if (cached || caching) return;
    setCaching(true); setCacheProgress(0);
    try {
      const resp   = await fetch(src);
      const total  = Number(resp.headers.get('content-length') || 0);
      const reader = resp.body!.getReader();
      const chunks: Uint8Array[] = [];
      let received = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value); received += value.length;
        if (total) setCacheProgress(Math.round((received / total) * 100));
      }
      const mime  = getMime(src);
      const blob  = new Blob(chunks as unknown as BlobPart[], { type: mime });
      const url   = URL.createObjectURL(blob);
      const cache = await caches.open(_AUDIO_CACHE);
      await cache.put(src, new Response(blob, { headers: { 'Content-Type': mime } }));
      setBlobUrl(url); setCached(true);
    } catch {}
    setCaching(false);
  };

  const pct = duration ? (current / duration) * 100 : 0;

  return (
    <div className="mt-3 rounded-2xl overflow-hidden"
      style={{ border: `1.5px solid color-mix(in srgb, ${accentColor} 30%, transparent)`, background: `color-mix(in srgb, ${accentColor} 6%, var(--c-card))` }}>

      <audio ref={audioRef} preload="metadata"
        onLoadedMetadata={handleLoaded}
        onTimeUpdate={handleTimeUpdate}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setCurrent(0); if (_activeAudio === audioRef.current) _activeAudio = null; try { localStorage.removeItem(posKey); } catch {} }}
        onWaiting={() => setLoading(true)}
        onCanPlay={() => setLoading(false)}>
        <source src={blobUrl || src} type={getMime(src)} />
      </audio>

      <div className="flex items-center justify-between px-3 pt-2.5 pb-1">
        <div className="flex items-center gap-1.5">
          <span className="text-base">🎧</span>
          <span className="text-[10px] font-black uppercase tracking-widest"
            style={{ color: accentColor }}>Audio</span>
          {cached && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ background: `color-mix(in srgb, ${accentColor} 15%, transparent)`, color: accentColor }}>
              ✓ кэш
            </span>
          )}
        </div>
        <span className="text-[11px] font-mono font-semibold tabular-nums"
          style={{ color: 'var(--c-muted)' }}>
          {fmt(current)} / {fmt(duration)}
        </span>
      </div>

      <div className="px-3 pb-2">
        <div className="relative h-2 rounded-full" style={{ background: 'var(--c-border)' }}>
          <div className="absolute left-0 top-0 h-full rounded-full transition-all duration-100"
            style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${accentColor}, color-mix(in srgb, ${accentColor} 70%, #fff))` }} />
          {duration > 0 && (
            <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full shadow-md pointer-events-none"
              style={{ left: `calc(${pct}% - 6px)`, background: '#fff', border: `2px solid ${accentColor}` }} />
          )}
          <input type="range" min={0} max={duration || 100} step={0.5} value={current}
            onChange={seek}
            className="absolute inset-0 w-full opacity-0 h-full cursor-pointer"
            style={{ touchAction: 'none' }} />
        </div>
      </div>

      <div className="flex items-center gap-2 px-3 pb-3">
        <button onClick={toggle} disabled={loading}
          className="w-11 h-11 rounded-2xl flex-shrink-0 flex items-center justify-center transition-all active:scale-90 shadow-md"
          style={{
            background: loading ? 'var(--c-border)' : accentColor,
            color: '#fff',
            border: `1.5px solid color-mix(in srgb, ${accentColor} 60%, #000 40%)`,
          }}>
          {loading ? (
            <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
          ) : playing ? (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" rx="1.5"/><rect x="14" y="4" width="4" height="16" rx="1.5"/>
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5.14v14l11-7-11-7z"/>
            </svg>
          )}
        </button>

        <button onClick={() => skip(-10)} disabled={loading}
          className="flex-1 h-11 rounded-2xl flex items-center justify-center gap-1.5 text-[11px] font-bold transition-all active:scale-95"
          style={{ background: 'var(--c-card)', color: loading ? 'var(--c-border)' : 'var(--c-text)', border: '1.5px solid var(--c-border)' }}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.85"/>
          </svg>
          10с
        </button>

        <button onClick={() => skip(10)} disabled={loading}
          className="flex-1 h-11 rounded-2xl flex items-center justify-center gap-1.5 text-[11px] font-bold transition-all active:scale-95"
          style={{ background: 'var(--c-card)', color: loading ? 'var(--c-border)' : 'var(--c-text)', border: '1.5px solid var(--c-border)' }}>
          10с
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-.49-3.85"/>
          </svg>
        </button>

        <button onClick={cycleSpeed}
          className="h-11 px-3 rounded-2xl flex items-center justify-center gap-1 text-[12px] font-black transition-all active:scale-95 flex-shrink-0"
          style={{
            background: `color-mix(in srgb, ${accentColor} 12%, var(--c-card))`,
            color: accentColor,
            border: `1.5px solid color-mix(in srgb, ${accentColor} 35%, transparent)`,
            minWidth: '52px',
          }}>
          {speed}×
        </button>

        <button onClick={cacheAudio} disabled={cached || caching}
          className="h-11 px-3 rounded-2xl flex items-center justify-center gap-1.5 text-[11px] font-bold transition-all active:scale-95 flex-shrink-0"
          style={cached
            ? { background: `color-mix(in srgb, ${accentColor} 12%, var(--c-card))`, color: accentColor, border: `1.5px solid color-mix(in srgb, ${accentColor} 35%, transparent)` }
            : { background: 'var(--c-card)', color: 'var(--c-muted)', border: '1.5px solid var(--c-border)' }}>
          {caching ? (
            <>
              <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              {cacheProgress > 0 ? `${cacheProgress}%` : '…'}
            </>
          ) : cached ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
          )}
        </button>
      </div>

      {caching && (
        <div className="h-0.5 mx-3 mb-3 rounded-full overflow-hidden" style={{ background: 'var(--c-border)' }}>
          <div className="h-full rounded-full transition-all duration-200"
            style={{ width: `${cacheProgress}%`, background: accentColor }} />
        </div>
      )}
    </div>
  );
};

// ── Картинки глоссария: карусель (одна на экране + точки, листание свайпом) ──
const GlossaryImages: React.FC<{ images: string[]; onZoom: (list: string[], idx: number) => void }> = ({ images, onZoom }) => {
  const [idx, setIdx] = useState(0);
  const startX = React.useRef(0);
  const moved  = React.useRef(false);

  if (!images.length) return null;
  const safeIdx = Math.min(idx, images.length - 1);
  const cur = images[safeIdx];
  const single = images.length === 1;

  return (
    <div className="mb-2">
      <div
        className="img-protected-wrapper rounded-xl overflow-hidden cursor-pointer relative"
        style={{ border: '1px solid var(--c-border)' }}
        onContextMenu={e => e.preventDefault()}
        onTouchStart={e => { e.stopPropagation(); startX.current = e.touches[0].clientX; moved.current = false; }}
        onTouchMove={e => { if (Math.abs(e.touches[0].clientX - startX.current) > 10) moved.current = true; }}
        onTouchEnd={e => {
          const dx = e.changedTouches[0].clientX - startX.current;
          if (Math.abs(dx) > 40) {
            e.preventDefault();
            if (dx < 0) setIdx(i => Math.min(images.length - 1, i + 1));
            else        setIdx(i => Math.max(0, i - 1));
          }
        }}
        onClick={e => {
          e.stopPropagation();              // не закрывать тултип
          if (!moved.current) onZoom(images, safeIdx);  // тап — открыть зум
        }}
      >
        <CachedImage src={cur} alt="" className="w-full h-auto object-contain max-h-32" loading="lazy" draggable={false} />
      </div>
      {!single && (
        <div className="flex justify-center items-center gap-1.5 mt-1.5">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={e => { e.stopPropagation(); setIdx(i); }}
              className="rounded-full transition-all duration-200"
              style={{
                width: i === safeIdx ? 16 : 6,
                height: 6,
                background: i === safeIdx ? 'var(--c-primary)' : 'var(--c-border)',
              }}
              aria-label={`Картинка ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────

export const QuestionsTab = ({ onSecretTap, subject = 'ortho' }: { onSecretTap?: () => void; subject?: SubjectType }) => {
  const cfg         = getSubject(subject);
  const accentColor = cfg?.color || 'var(--c-primary)';
  const lsKey       = subject === 'ortho' ? 'studiedQuestions'  : `${cfg?.lsPrefix || subject}_studiedQuestions`;
  const lsNoteKey   = subject === 'ortho' ? 'userQuestionNotes' : `${cfg?.lsPrefix || subject}_userQuestionNotes`;
  const [loadedQuestionsData, setLoadedQuestionsData] = useState<any[]>([]);
  const [microLoading,        setMicroLoading]        = useState(false);
  const questionsData = loadedQuestionsData;

  const [dynamicGlossary, setDynamicGlossary] = useState<GlossaryItem[]>([]);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'unstudied' | 'audio'>('all');
  const [openAccordionId, setOpenAccordionId] = useState<string>('');
  const [studiedIds, setStudiedIds] = useState<Set<number>>(new Set());
  const [userNotes, setUserNotes] = useState<Record<number, string>>({});
  const [isLoaded, setIsLoaded] = useState(false);
  const [readingQuestion, setReadingQuestion] = useState<any | null>(null);

  // СТЕК ГЛОССАРИЯ ВМЕСТО ОДНОЙ ПЕРЕМЕННОЙ
  const [termDefStack, setTermDefStack] = useState<string[]>([]);
  const activeTermDef = termDefStack.length > 0 ? termDefStack[termDefStack.length - 1] : null;

  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [fontSize, setFontSize] = useState(16);
  
  const [zoomList, setZoomList] = useState<string[]>([]);
  const [zoomIdx,  setZoomIdx]  = useState(0);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const zoomImgRef = useRef<HTMLImageElement | null>(null);

  const openZoom = (list: string[], idx = 0) => {
    setZoomList(list); setZoomIdx(idx);
    setScale(1); setTranslate({ x: 0, y: 0 });
  };

  const clampZoom = (t: {x: number; y: number}, s: number) => {
    const img = zoomImgRef.current;
    if (!img) return t;
    const maxX = Math.max(0, ((s - 1) * img.clientWidth) / 2);
    const maxY = Math.max(0, ((s - 1) * img.clientHeight) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, t.x)),
      y: Math.max(-maxY, Math.min(maxY, t.y)),
    };
  };

  const closeZoom = () => { setZoomList([]); setScale(1); setTranslate({ x: 0, y: 0 }); };

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
  }, [subject]);

  useEffect(() => {
    let cancelled = false;
    setMicroLoading(true);
    setLoadedQuestionsData([]);
    loadSubjectData(subject, 'questions')
      .then(d => { if (!cancelled) setLoadedQuestionsData(d as any[]); })
      .finally(() => { if (!cancelled) setMicroLoading(false); });
    return () => { cancelled = true; };
  }, [subject]);

  useEffect(() => {
    let cancelled = false;
    loadSubjectData(subject, 'glossary')
      .then(d => { if (!cancelled) setDynamicGlossary((d as GlossaryItem[]).flat()); });
    return () => { cancelled = true; };
  }, [subject]);

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
    return questionsData.filter(q => {
      const matchSearch = !search || q.id.toString() === t || q.question.toLowerCase().includes(t);
      const matchFilter =
        filter === 'all'      ? true :
        filter === 'unstudied' ? !studiedIds.has(q.id) :
        filter === 'audio'    ? !!(q as any).audio :
        true;
      return matchSearch && matchFilter;
    });
  }, [search, filter, questionsData, studiedIds]);

  const progress = useMemo(() => questionsData.length ? (studiedIds.size / questionsData.length) * 100 : 0, [studiedIds, questionsData]);

  const glossaryTerms = useMemo(() => {
    return [...dynamicGlossary].sort((a, b) => b.term.length - a.term.length);
  }, [dynamicGlossary]);

  const [tooltipTarget, setTooltipTarget] = useState<{
    top: number; bottom: number; left: number; right: number; width: number;
  } | null>(null);


 useLayoutEffect(() => {
    if (!activeTermDef || !tooltipTarget || !tooltipRef.current) return;
    const popup = tooltipRef.current.getBoundingClientRect();
    
    const GAP = 24; 
    const PAD = 10;
    const vw  = window.innerWidth;
    const vh  = window.innerHeight;

    let y = tooltipTarget.top - popup.height - GAP;
    
    if (y < PAD) {
      y = tooltipTarget.bottom + GAP;
      if (y + popup.height > vh - PAD) {
        y = Math.max(PAD, vh - popup.height - PAD);
      }
    }

    let x = (vw / 2) - (popup.width / 2);

    setTooltipPos({ x, y });
  }, [activeTermDef, tooltipTarget]);

  // ЗАКРЫТИЕ СТЕКА ПО КЛИКУ
  useEffect(() => {
    if (termDefStack.length === 0) return;
    const h = () => setTermDefStack([]);
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, [termDefStack]);

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


  // ── РЕНДЕР С ПОДСВЕТКОЙ ГЛОССАРИЯ ─────────────────────────────────────────
  // ДОБАВЛЕН ФЛАГ isNested
 const renderWithGlossary = (text: string, relatedTerms?: string[], isNested: boolean = false) => {
    if (!text) return null;

    // Внутри тултипа ищем по всем терминам. Вне тултипа — только по relatedTerms
    const localGlossary: GlossaryItem[] = isNested 
      ? glossaryTerms 
      : (relatedTerms && relatedTerms.length)
        ? glossaryTerms.filter(g => relatedTerms.some(rt => rt.toLowerCase() === g.term.toLowerCase()))
        : [];

    return (
      <div className="w-full break-words whitespace-pre-wrap [word-break:break-word]">
        {text.split('\n').map((line, lineIdx) => {
          if (line.trim() === '') return <div key={lineIdx} className="h-1" />;

          const listMatch = line.match(/^(\s*[•\-\*]\s+|\s*\d+\.\s+)/);
          const isListItem = !!listMatch;
          let listMarker = isListItem ? listMatch![1].trim() : '';
          if (listMarker === '-' || listMarker === '*') listMarker = '•';
          const cleanLine = isListItem
            ? line.replace(/^(\s*[•\-\*]\s+|\s*\d+\.\s+)/, '')
            : line;

          const chars: { ch: string; bold: boolean; italic: boolean }[] = [];
          {
            let bold = false, italic = false;
            for (const tk of cleanLine.split(/(\*\*|_)/g)) {
              if (tk === '**') { bold = !bold; continue; }
              if (tk === '_')  { italic = !italic; continue; }
              for (const ch of tk) chars.push({ ch, bold, italic });
            }
          }
          const plain = chars.map(c => c.ch).join('');

          type Hit = { start: number; end: number; def: string };
          const hits: Hit[] = [];
          if (localGlossary.length && plain) {
            const plainNorm = plain.toLowerCase().replace(/ё/g, 'е');
            
            for (const g of localGlossary) {
              // ИЩЕМ САМ ТЕРМИН И ЕГО ВАРИАЦИИ
              const formsToSearch = [g.term, ...(g.variations || [])];
              
              for (const form of formsToSearch) {
                const src = _termRegexSource(form); // Используем ваш безопасный генератор регулярки
                if (!src) continue;
                
                let re: RegExp;
                try { re = new RegExp(src, 'g'); } catch { continue; }
                let m: RegExpExecArray | null;
                while ((m = re.exec(plainNorm)) !== null) {
                  if (m[0].length === 0) { re.lastIndex++; continue; }
                  
                  // ПРЕДОТВРАЩАЕМ БЕСКОНЕЧНЫЕ ССЫЛКИ САМО НА СЕБЯ
                  if (isNested && g.definition === text) continue;
                  
                  hits.push({ start: m.index, end: m.index + m[0].length, def: g.definition });
                }
              }
            }
          }
          
          hits.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
          const accepted: Hit[] = [];
          let lastEnd = -1;
          for (const h of hits) {
            if (h.start >= lastEnd) { accepted.push(h); lastEnd = h.end; }
          }

          const boundary = new Set<number>([0, plain.length]);
          for (let i = 1; i < chars.length; i++) {
            if (chars[i].bold !== chars[i - 1].bold || chars[i].italic !== chars[i - 1].italic) {
              boundary.add(i);
            }
          }
          for (const h of accepted) { boundary.add(h.start); boundary.add(h.end); }
          const bounds = [...boundary].sort((a, b) => a - b);

          const segs: React.ReactNode[] = [];
          for (let bi = 0; bi < bounds.length - 1; bi++) {
            const s = bounds[bi], e = bounds[bi + 1];
            if (s >= e) continue;
            const segText = plain.slice(s, e);
            const fmt = chars[s] || { bold: false, italic: false };
            const style: React.CSSProperties = {
              fontWeight: fmt.bold ? 700 : 'inherit',
              color: fmt.bold ? 'var(--c-text)' : 'inherit',
              fontStyle: fmt.italic ? 'italic' : 'normal',
            };
            const hit = accepted.find(h => s >= h.start && e <= h.end);
            
            if (hit) {
              segs.push(
                <span
                  key={`g-${lineIdx}-${bi}`}
                  className="transition-opacity active:opacity-70"
                  style={{ ...style, borderBottom: '1px dashed currentColor', cursor: 'pointer', color: 'var(--c-primary)' }}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    if (isNested) {
                      // ДОБАВЛЯЕМ В СТЕК БЕЗ СМЕЩЕНИЯ ОКНА
                      setTermDefStack(prev => [...prev, hit.def]);
                    } else {
                      // НОВЫЙ КЛИК - ПОЗИЦИОНИРУЕМ ОКНО
                      const r = (ev.currentTarget as HTMLElement).getBoundingClientRect();
                      setTooltipTarget({ top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width });
                      setTooltipPos({ x: -9999, y: -9999 });
                      setTermDefStack([hit.def]);
                    }
                  }}
                >
                  {segText}
                </span>
              );
            } else {
              segs.push(<span key={`t-${lineIdx}-${bi}`} style={style}>{segText}</span>);
            }
          }

          if (isListItem) {
            return (
              <div key={lineIdx} className="flex gap-2 mb-1.5 pl-2 mt-1">
                <span className="text-[14px] leading-snug font-bold" style={{ color: 'var(--c-amber)' }}>
                  {listMarker}
                </span>
                <p className="m-0 flex-1 leading-snug">{segs}</p>
              </div>
            );
          }
          return (
            <p key={lineIdx} className="indent-4 mb-2 mt-1 last:mb-0">{segs}</p>
          );
        })}
      </div>
    );
  };

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
    <div className="flex flex-col h-full overflow-hidden max-w-full" style={{ background: 'var(--c-bg)' }}>

      {/* ── ШАПКА ─────────────────────────────────── */}
      <div className="flex-shrink-0 px-4 py-2.5 sticky top-0 z-10"
        style={{
          background: 'color-mix(in srgb, var(--c-bg) 92%, transparent)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid var(--c-border)',
          paddingTop: 'var(--header-pt)',
        }}>
        <div className="flex items-center gap-3 px-1">
          <div className="w-9 h-9 rounded-[11px] flex items-center justify-center flex-shrink-0" style={{ background: 'var(--c-primary-dim)' }}>
            <ToothIcon className="w-6 h-6" style={{ color: accentColor }} variant={cfg?.iconVariant || 'perfect'} onClick={onSecretTap} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-[16px] font-bold tracking-tight leading-tight" style={{ color: 'var(--c-text)' }}>
              {cfg?.brandName || 'OrthoByNekruz'}
            </h1>
            <p className="text-[10px] font-bold uppercase tracking-widest mt-0.5" style={{ color: accentColor }}>
              Вопросы · {cfg?.label || subject}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 min-w-[64px]">
            <span className="text-[11px] font-mono font-bold" style={{ color: accentColor }}>
              {studiedIds.size}/{questionsData.length}
            </span>
            <div className="w-[60px] h-[3px] rounded-full overflow-hidden" style={{ background: 'var(--c-border)' }}>
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${progress}%`, background: accentColor }} />
            </div>
          </div>
        </div>

        {/* Поиск */}
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--c-muted)' }} />
          <Input placeholder="Поиск по вопросу или №…" value={search} onChange={e => setSearch(e.target.value)}
            className="pl-10 h-11 border focus-visible:ring-0 focus-visible:ring-offset-0 text-sm rounded-xl"
            style={{ background: 'var(--c-card)', borderColor: 'var(--c-border)', color: 'var(--c-text)', caretColor: 'var(--c-primary)' }} />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--c-muted)' }}><X className="w-4 h-4" /></button>}
        </div>

        {/* Фильтры-pills */}
        <div className="flex gap-1.5 mt-2.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {([
            ['all',       'Все',        questionsData.length],
            ['unstudied', 'Не изучены', Math.max(0, questionsData.length - studiedIds.size)],
            ['audio',     'С аудио',    questionsData.filter((q: any) => !!q.audio).length],
          ] as const).map(([val, label, cnt]) => {
            const act = filter === val;
            return (
              <button key={val} onClick={() => setFilter(val as any)}
                className="inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-[12px] font-bold whitespace-nowrap transition-all active:scale-95"
                style={act
                  ? { background: accentColor, color: '#fff' }
                  : { background: 'var(--c-card)', border: '1px solid var(--c-border)', color: 'var(--c-muted)' }}>
                {label}
                <span className="text-[10px] font-mono px-1.5 rounded-md"
                  style={act
                    ? { background: 'rgba(255,255,255,0.25)', color: '#fff' }
                    : { background: 'var(--c-chip)', color: 'var(--c-text-faint)' }}>
                  {cnt}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── СПИСОК ────────────────────────────────── */}
      <ScrollArea className="flex-1 scroll-container">
        <div className="py-3 px-3 mx-auto max-w-2xl w-full" style={{ paddingBottom: 'var(--scroll-pb)' }}>
          {microLoading ? (
              <div className="flex items-center justify-center py-24" style={{ color: 'var(--c-amber)' }}>
                <svg className="animate-spin w-8 h-8" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
              </div>
            ) : filtered.length > 0 ? (
            <Accordion type="single" collapsible className="space-y-2 w-full"
              onValueChange={val => setOpenAccordionId(val ?? '')}>
              {filtered.map(q => {
                const studied = studiedIds.has(q.id);
                const hasAudio = !!(q as any).audio;
                return (
                  <AccordionItem key={q.id} value={q.id.toString()} className="border-none rounded-2xl overflow-hidden w-full relative transition-all duration-200"
                    style={{ background: studied ? 'color-mix(in srgb, var(--c-primary) 6%, var(--c-card))' : 'var(--c-card)', border: studied ? '1px solid var(--c-primary-br)' : '1px solid var(--c-border)' }}>
                    <div className="absolute left-0 top-0 bottom-0 w-[3px]"
                      style={{ background: studied ? 'var(--c-primary)' : 'var(--c-border)' }} />
                    <AccordionTrigger className="px-4 py-3.5 pl-4 hover:no-underline [&>svg]:hidden">
                      <div className="flex items-start gap-3 text-left w-full pr-2">
                        <div className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border flex items-center justify-center transition-all"
                          style={studied ? { background: 'var(--c-primary-dim)', borderColor: 'var(--c-primary)' } : { borderColor: 'var(--c-border)' }}>
                          {studied && <div className="w-2 h-2 rounded-full" style={{ background: 'var(--c-primary)' }} />}
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="inline-block text-[10px] font-mono font-bold px-2 py-0.5 rounded-md"
                              style={studied
                                ? { background: 'var(--c-primary-dim)', color: 'var(--c-primary)', border: '1px solid var(--c-primary-br)' }
                                : { background: 'color-mix(in srgb, var(--c-border) 60%, transparent)', color: 'var(--c-muted)', border: '1px solid var(--c-border)' }}>
                              №{q.id}
                            </span>
                            {hasAudio && (
                              <span className="inline-flex items-center text-[9px] font-bold px-1.5 py-0.5 rounded-md"
                                style={{ background: `color-mix(in srgb, ${accentColor} 12%, transparent)`, color: accentColor, border: `1px solid color-mix(in srgb, ${accentColor} 25%, transparent)` }}>
                                🎧
                              </span>
                            )}
                          </div>
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
                          {renderWithGlossary(q.answer, (q as any).relatedTerms)}
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 h-8 pointer-events-none"
                          style={{ background: 'linear-gradient(to top, color-mix(in srgb, var(--c-bg) 60%, var(--c-card)), transparent)' }} />
                      </div>
                      {/* Кнопки */}
                      <div className="flex gap-2">
                        <button onClick={() => { _activeAudio?.pause(); setReadingQuestion(q); }}
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
                      {(q as any).audio && <AudioPlayer src={(q as any).audio} accentColor={accentColor} />}
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

            {/* Top bar */}
            <div className="flex items-center gap-2 px-3 py-2 flex-shrink-0"
              style={{
                background: 'color-mix(in srgb, var(--c-bg) 92%, transparent)',
                backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
                borderBottom: '1px solid var(--c-border)',
                paddingTop: 'calc(var(--header-pt) - 28px)',
              }}>
              <button onClick={() => setReadingQuestion(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center active:scale-95"
                style={{ background: 'transparent', border: '1px solid var(--c-border)', color: 'var(--c-muted)' }}>
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="flex-1 text-center min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--c-muted)' }}>Чтение</div>
                <div className="text-[12px] font-mono font-bold leading-tight" style={{ color: 'var(--c-text)' }}>
                  №{readingQuestion.id} · {cfg?.label || subject}
                </div>
              </div>
              <button onClick={() => setReadingQuestion(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center active:scale-95"
                style={{ background: 'transparent', border: '1px solid var(--c-border)', color: 'var(--c-muted)' }}>
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Контент */}
            <div className="flex-1 overflow-y-auto px-5 pt-2 scroll-container"
              onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
              
              <div className="space-y-4 pb-32 max-w-2xl mx-auto w-full overflow-x-hidden">
                <div className="flex items-center gap-2 pt-2">
                  <span className="text-[11px] font-mono font-bold px-3 py-1 rounded-lg"
                    style={{ background: 'var(--c-primary-dim)', color: 'var(--c-primary)', border: '1px solid var(--c-primary-br)' }}>
                    Вопрос №{readingQuestion.id}
                  </span>
                </div>
                <h2 className="font-semibold leading-snug break-words" style={{ fontSize: `${fontSize * 1.15}px`, color: 'var(--c-text)' }}>
                  {renderWithGlossary(readingQuestion.question, readingQuestion.relatedTerms)}
                </h2>
                <div className="flex items-center gap-3" style={{ borderTop: '1px solid var(--c-border)', paddingTop: '12px' }}>
                  <BookOpen className="w-4 h-4 flex-shrink-0" style={{ color: accentColor }} />
                  <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: accentColor }}>Ответ</span>
                </div>
                
                <div className="leading-snug font-normal break-words" style={{ fontSize: `${fontSize}px`, color: 'color-mix(in srgb, var(--c-text) 92%, transparent)' }}>
                  {renderWithGlossary(readingQuestion.answer, readingQuestion.relatedTerms)}
                </div>
                
                {(() => {
                  const raw = readingQuestion.images || readingQuestion.image;
                  if (!raw) return null;
                  const imgArr: string[] = Array.isArray(raw) ? raw : [raw];
                  return imgArr.map((img: string, i: number) => (
                    <div key={i}
                      className="img-protected-wrapper rounded-2xl overflow-hidden cursor-pointer relative"
                      style={{ border: '1px solid var(--c-border)' }}
                      onClick={() => openZoom(imgArr, i)}
                      onTouchStart={e => e.preventDefault()}
                      onContextMenu={e => e.preventDefault()}>
                      <CachedImage src={img} alt="" className="w-full h-auto object-contain max-h-80"
                        loading="lazy" draggable={false} />
                      <div className="absolute inset-0" style={{ WebkitTouchCallout: 'none' }} />
                    </div>
                  ));
                })()}
                <PersonalNote id={readingQuestion.id} />
                {readingQuestion.audio && <AudioPlayer src={readingQuestion.audio} accentColor={accentColor} />}
              </div>
            </div>

            {/* Плавающая пилюля */}
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
                <button
                  onClick={() => { const i = questionsData.findIndex(q => q.id === readingQuestion.id); setReadingQuestion(questionsData[(i - 1 + questionsData.length) % questionsData.length]); }}
                  className="w-10 h-10 flex items-center justify-center rounded-full flex-shrink-0 transition-all active:scale-95"
                  style={{ color: 'var(--c-muted)' }}
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>

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

                <button
                  onClick={() => setReadingQuestion(null)}
                  className="flex items-center justify-center gap-2 px-4 h-10 rounded-full text-sm font-semibold transition-all active:scale-[0.97]"
                  style={{ color: 'var(--c-muted)', border: '1px solid var(--c-border)' }}
                >
                  <X className="w-4 h-4" /> Выйти
                </button>

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
            style={{ 
              left: tooltipPos.x, 
              top: tooltipPos.y, 
          
              background: 'var(--c-card)', 
              border: '1px solid var(--c-primary-br)', 
              cursor: dragging ? 'grabbing' : 'grab' 
            }}
            onMouseDown={handleTooltipMouseDown} onTouchStart={handleTooltipTouchStart} onClick={e => e.stopPropagation()}>
            
            {/* Кнопка "Назад" во вложенном тултипе */}
            {termDefStack.length > 1 && (
              <div className="flex items-center gap-2 mb-3 pb-2 border-b" style={{ borderColor: 'color-mix(in srgb, var(--c-text) 10%, transparent)' }}>
                <button 
                  onClick={(e) => { e.stopPropagation(); setTermDefStack(p => p.slice(0, -1)); }}
                  className="flex items-center gap-1 text-[12px] font-bold active:scale-95 transition-transform"
                  style={{ color: 'var(--c-primary)' }}
                >
                  <ArrowLeft className="w-3 h-3" /> Назад
                </button>
                <span className="text-[10px] uppercase tracking-wider opacity-50" style={{ color: 'var(--c-text)' }}>
                  Вложенный термин
                </span>
              </div>
            )}

            {found?.image && (
              <GlossaryImages
                images={Array.isArray(found.image) ? found.image : [found.image]}
                onZoom={openZoom}
              />
            )}
            
            {/* Рендерим текст определения с поиском глоссария внутри него (isNested = true) */}
            <div className="text-sm font-normal" style={{ color: 'var(--c-text)' }}>
               {renderWithGlossary(found?.definition || '', undefined, true)}
            </div>
            
            <p className="text-[10px] mt-3 opacity-50 flex justify-center" style={{ color: 'var(--c-muted)' }}>↔ перетащите</p>
          </div>
        );
      })()}

      {/* ── ZOOM ИЗОБРАЖЕНИЯ ─────────────────────────────────────────────── */}
      {zoomList.length > 0 && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center"
          style={{
            background:     'hsl(0 0% 0% / 0.92)',
            backdropFilter: 'blur(8px)',
            touchAction:    'none',
            overscrollBehavior: 'contain',
          }}
          onClick={closeZoom}
          onWheel={e => {
            e.preventDefault();
            const delta    = e.deltaY > 0 ? -0.25 : 0.25;
            const newScale = Math.min(5, Math.max(1, scale + delta));
            const img      = zoomImgRef.current;
            if (!img) { setScale(newScale); return; }
            const rect = img.getBoundingClientRect();
            const dx   = e.clientX - (rect.left + rect.width  / 2);
            const dy   = e.clientY - (rect.top  + rect.height / 2);
            const r    = newScale / scale;
            const newT = { x: translate.x + dx * (1 - r), y: translate.y + dy * (1 - r) };
            setScale(newScale);
            setTranslate(clampZoom(newT, newScale));
          }}
          onTouchStart={e => {
            if (e.touches.length === 2) {
              const t1 = e.touches[0], t2 = e.touches[1];
              const dx = t1.clientX - t2.clientX;
              const dy = t1.clientY - t2.clientY;
              const cx = (t1.clientX + t2.clientX) / 2;
              const cy = (t1.clientY + t2.clientY) / 2;
              const img = zoomImgRef.current;
              const rect = img?.getBoundingClientRect();
              const ix = rect ? cx - (rect.left + rect.width  / 2) : 0;
              const iy = rect ? cy - (rect.top  + rect.height / 2) : 0;
              (e.currentTarget as any).__ps = {
                dist: Math.hypot(dx, dy),
                scale,
                translate,
                ix, iy,
              };
            } else if (e.touches.length === 1 && scale > 1) {
              (e.currentTarget as any).__pan = {
                x: e.touches[0].clientX,
                y: e.touches[0].clientY,
                translate,
              };
            } else if (e.touches.length === 1 && scale === 1 && zoomList.length > 1) {
              (e.currentTarget as any).__swipe = { x: e.touches[0].clientX };
            }
          }}
          onTouchMove={e => {
            const target = e.currentTarget as any;
            if (e.touches.length === 2 && target.__ps) {
              e.preventDefault();
              const ps = target.__ps;
              const dx = e.touches[0].clientX - e.touches[1].clientX;
              const dy = e.touches[0].clientY - e.touches[1].clientY;
              const ns = Math.min(5, Math.max(1, ps.scale * Math.hypot(dx, dy) / ps.dist));
              const r  = ns / ps.scale;
              const newT = {
                x: ps.translate.x + ps.ix * (1 - r),
                y: ps.translate.y + ps.iy * (1 - r),
              };
              setScale(ns);
              setTranslate(clampZoom(newT, ns));
            } else if (e.touches.length === 1 && target.__pan && scale > 1) {
              e.preventDefault();
              const p = target.__pan;
              const newT = {
                x: p.translate.x + e.touches[0].clientX - p.x,
                y: p.translate.y + e.touches[0].clientY - p.y,
              };
              setTranslate(clampZoom(newT, scale));
            }
          }}
          onTouchEnd={e => {
            const t = e.currentTarget as any;
            if (t.__swipe) {
              const dx = e.changedTouches[0].clientX - t.__swipe.x;
              if (Math.abs(dx) > 50) {
                if (dx < 0) setZoomIdx(i => Math.min(zoomList.length - 1, i + 1));
                else        setZoomIdx(i => Math.max(0, i - 1));
              }
            }
            delete t.__ps;
            delete t.__pan;
            delete t.__swipe;
          }}
        >
          <div
            className="img-protected-wrapper flex items-center justify-center"
            onClick={e => e.stopPropagation()}
            onContextMenu={e => e.preventDefault()}
          >
            <CachedImage
              ref={zoomImgRef}
              src={zoomList[zoomIdx]}
              alt=""
              className="object-contain rounded-2xl select-none"
              style={{
                maxWidth:        '95vw',
                maxHeight:       '85vh',
                transform:       `translate3d(${translate.x}px, ${translate.y}px, 0) scale(${scale})`,
                transformOrigin: 'center center',
                transition:      'transform 0.12s ease-out',
                touchAction:     'none',
                willChange:      'transform',
                userSelect:      'none',
              }}
              draggable={false}
              onDoubleClick={() => {
                if (scale > 1) {
                  setScale(1);
                  setTranslate({ x: 0, y: 0 });
                } else {
                  setScale(2.5);
                }
              }}
            />
          </div>

          {scale > 1 && (
            <div
              className="fixed top-4 left-4 z-[201] px-3 py-1.5 rounded-full text-[11px] font-bold tabular-nums pointer-events-none"
              style={{
                background: 'rgba(0,0,0,0.55)',
                color:      '#fff',
                backdropFilter: 'blur(8px)',
                border:     '1px solid rgba(255,255,255,0.15)',
              }}
            >
              {scale.toFixed(1)}×
            </div>
          )}

          <div
            className="fixed left-0 right-0 flex flex-col items-center gap-3 z-[201]"
            style={{ bottom: 'calc(var(--nav-bottom, 12px) + 16px)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Точки-индикатор + стрелки (если картинок несколько) */}
            {zoomList.length > 1 && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full"
                style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.15)' }}>
                {zoomList.map((_, i) => (
                  <button key={i} onClick={() => { setZoomIdx(i); setScale(1); setTranslate({ x: 0, y: 0 }); }}
                    className="rounded-full transition-all duration-200"
                    style={{
                      width: i === zoomIdx ? 18 : 7, height: 7,
                      background: i === zoomIdx ? '#fff' : 'rgba(255,255,255,0.4)',
                    }}
                    aria-label={`Картинка ${i + 1}`}
                  />
                ))}
              </div>
            )}
            <button
              onClick={closeZoom}
              className="flex items-center gap-2 px-6 h-11 rounded-full text-sm font-semibold transition-all active:scale-95 shadow-2xl"
              style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)', color: 'var(--c-text)' }}
            >
              <X className="w-4 h-4" /> Закрыть
            </button>
          </div>
        </div>
      )}
    </div>
  );
};