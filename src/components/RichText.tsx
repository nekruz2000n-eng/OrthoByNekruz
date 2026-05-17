"use client";

import React, { useState, useMemo, useRef, useLayoutEffect, useEffect } from 'react';
import { CachedImage } from '@/components/CachedImage';

export interface GlossaryItem {
  term:        string;
  definition:  string;
  image?:      string | string[];
}

// ── Russian stemming ──────────────────────────────────────────────────────────
const _RU_ENDINGS = [
  'ого','его','ому','ему','ыми','ими','ая','яя','ое','ее','ой','ый','ий',
  'ую','юю','ые','ие','ых','их','ам','ям','ах','ях','ов','ев','ём','ом',
  'ем','ей','а','я','ы','и','у','ю','е','о','й','ь',
];
function _ruStem(word: string): string {
  const w = word.toLowerCase().replace(/ё/g, 'е');
  if (w.length <= 3) return w;
  for (const end of _RU_ENDINGS) {
    if (w.length - end.length >= 3 && w.endsWith(end)) return w.slice(0, -end.length);
  }
  return w;
}
function _escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function _termRegexSource(term: string): string {
  const words = term.split(/[\s-]+/).filter(Boolean);
  if (!words.length) return '';
  const parts = words.map(w => {
    const lw = w.toLowerCase().replace(/ё/g, 'е');
    if (lw.length <= 2) return _escapeRe(lw);
    return _escapeRe(_ruStem(lw)) + '[а-яё]*';
  });
  return '(?<=^|[^а-яёa-z0-9])(?:' + parts.join('[^а-яёa-z0-9]{1,6}') + ')(?=$|[^а-яёa-z0-9])';
}

// ── Миниатюры картинок с листанием ───────────────────────────────────────────
const GlossaryImages: React.FC<{
  images: string[];
  onZoom: (list: string[], idx: number) => void;
}> = ({ images, onZoom }) => {
  const [idx, setIdx] = useState(0);
  const startX = useRef(0);
  const moved  = useRef(false);

  if (!images.length) return null;
  const safeIdx = Math.min(idx, images.length - 1);
  const single  = images.length === 1;

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
          e.stopPropagation();
          if (!moved.current) onZoom(images, safeIdx);
        }}
      >
        <CachedImage
          src={images[safeIdx]}
          alt=""
          className="w-full h-auto object-contain max-h-32"
          loading="lazy"
          draggable={false}
        />
      </div>
      {!single && (
        <div className="flex justify-center items-center gap-1.5 mt-1.5">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={e => { e.stopPropagation(); setIdx(i); }}
              className="rounded-full transition-all duration-200"
              style={{
                width:      i === safeIdx ? 16 : 6,
                height:     6,
                background: i === safeIdx ? 'var(--c-primary)' : 'var(--c-border)',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  text:          string;
  relatedTerms?: string[];
  glossaryTerms: GlossaryItem[];
  fontSize?:     number;
  className?:    string;
}

export const RichText: React.FC<Props> = ({
  text, relatedTerms, glossaryTerms, fontSize = 16, className = '',
}) => {
  // ── Тултип ──────────────────────────────────────────────────────────────────
  const [activeTerm,    setActiveTerm]    = useState<GlossaryItem | null>(null);
  const [tooltipTarget, setTooltipTarget] = useState<{ top: number; bottom: number; left: number; right: number; width: number } | null>(null);
  const [tooltipPos,    setTooltipPos]    = useState({ x: -9999, y: -9999 });
  const tooltipRef  = useRef<HTMLDivElement>(null);

  // ── Перетаскивание тултипа ──────────────────────────────────────────────────
  const [dragging,        setDragging]        = useState(false);
  const dragStartPos    = useRef({ x: 0, y: 0 });
  const tooltipStartPos = useRef({ x: 0, y: 0 });

  const handleTooltipMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation(); setDragging(true);
    dragStartPos.current    = { x: e.clientX, y: e.clientY };
    tooltipStartPos.current = { x: tooltipPos.x, y: tooltipPos.y };
  };
  const handleTooltipTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation(); const t = e.touches[0]; setDragging(true);
    dragStartPos.current    = { x: t.clientX, y: t.clientY };
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
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    window.addEventListener('touchmove', move as any, { passive: false });
    window.addEventListener('touchend', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('touchmove', move as any);
      window.removeEventListener('touchend', up);
    };
  }, [dragging]);

  // ── Зум картинки ────────────────────────────────────────────────────────────
  const [zoomList,   setZoomList]   = useState<string[]>([]);
  const [zoomIdx,    setZoomIdx]    = useState(0);
  const [scale,      setScale]      = useState(1);
  const [translate,  setTranslate]  = useState({ x: 0, y: 0 });
  const zoomImgRef = useRef<HTMLImageElement | null>(null);

  const openZoom = (list: string[], idx = 0) => {
    setZoomList(list); setZoomIdx(idx);
    setScale(1); setTranslate({ x: 0, y: 0 });
  };
  const clampZoom = (t: { x: number; y: number }, s: number) => {
    const img = zoomImgRef.current;
    if (!img) return t;
    const maxX = Math.max(0, ((s - 1) * img.clientWidth)  / 2);
    const maxY = Math.max(0, ((s - 1) * img.clientHeight) / 2);
    return { x: Math.max(-maxX, Math.min(maxX, t.x)), y: Math.max(-maxY, Math.min(maxY, t.y)) };
  };
  const closeZoom = () => { setZoomList([]); setScale(1); setTranslate({ x: 0, y: 0 }); };

  // ── Позиционирование тултипа над/под термином ────────────────────────────────
  useLayoutEffect(() => {
    if (!activeTerm || !tooltipTarget || !tooltipRef.current) return;
    const popup = tooltipRef.current.getBoundingClientRect();
    const GAP = 24, PAD = 10;
    const vw = window.innerWidth, vh = window.innerHeight;
    let y = tooltipTarget.top - popup.height - GAP;
    if (y < PAD) y = tooltipTarget.bottom + GAP;
    if (y + popup.height > vh - PAD) y = vh - popup.height - PAD;
    let x = tooltipTarget.left + tooltipTarget.width / 2 - popup.width / 2;
    if (x < PAD) x = PAD;
    if (x + popup.width > vw - PAD) x = vw - popup.width - PAD;
    setTooltipPos({ x, y });
  }, [activeTerm, tooltipTarget]);

  // ── Закрытие тултипа по клику снаружи ───────────────────────────────────────
  useEffect(() => {
    if (!activeTerm) return;
    const h = () => setActiveTerm(null);
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, [activeTerm]);

  // ── Глоссарий: только термины из relatedTerms ────────────────────────────────
  const localGlossary = useMemo(() => {
    if (!relatedTerms?.length) return [];
    return [...glossaryTerms
      .filter(g => relatedTerms.some(rt => rt.toLowerCase() === g.term.toLowerCase()))]
      .sort((a, b) => b.term.length - a.term.length);
  }, [relatedTerms, glossaryTerms]);

  if (!text) return null;

  // ── Рендер строки: markdown + подсветка терминов ────────────────────────────
  const renderLine = (line: string, lineIdx: number): React.ReactNode => {
    if (line.trim() === '') return <div key={lineIdx} className="h-1" />;

    const listMatch  = line.match(/^(\s*[•\-\*]\s+|\s*\d+\.\s+)/);
    const isListItem = !!listMatch;
    let   listMarker = isListItem ? listMatch![1].trim() : '';
    if (listMarker === '-' || listMarker === '*') listMarker = '•';
    const cleanLine  = isListItem ? line.replace(/^(\s*[•\-\*]\s+|\s*\d+\.\s+)/, '') : line;

    // 1. Парсим markdown → символы с форматом
    const chars: { ch: string; bold: boolean; italic: boolean }[] = [];
    let bold = false, italic = false;
    for (const tk of cleanLine.split(/(\*\*|_)/g)) {
      if (tk === '**') { bold = !bold; continue; }
      if (tk === '_')  { italic = !italic; continue; }
      for (const ch of tk) chars.push({ ch, bold, italic });
    }
    const plain = chars.map(c => c.ch).join('');

    // 2. Ищем термины
    type Hit = { start: number; end: number; item: GlossaryItem };
    const hits: Hit[] = [];
    if (localGlossary.length && plain) {
      const norm = plain.toLowerCase().replace(/ё/g, 'е');
      for (const g of localGlossary) {
        const src = _termRegexSource(g.term);
        if (!src) continue;
        let re: RegExp;
        try { re = new RegExp(src, 'g'); } catch { continue; }
        let m: RegExpExecArray | null;
        while ((m = re.exec(norm)) !== null) {
          if (m[0].length === 0) { re.lastIndex++; continue; }
          hits.push({ start: m.index, end: m.index + m[0].length, item: g });
        }
      }
    }
    hits.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
    const accepted: Hit[] = [];
    let lastEnd = -1;
    for (const h of hits) { if (h.start >= lastEnd) { accepted.push(h); lastEnd = h.end; } }

    // 3. Нарезаем на сегменты
    const boundary = new Set<number>([0, plain.length]);
    for (let i = 1; i < chars.length; i++) {
      if (chars[i].bold !== chars[i - 1].bold || chars[i].italic !== chars[i - 1].italic) boundary.add(i);
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
        color:      fmt.bold ? 'var(--c-text)' : 'inherit',
        fontStyle:  fmt.italic ? 'italic' : 'normal',
      };
      const hit = accepted.find(h => s >= h.start && e <= h.end);
      if (hit) {
        segs.push(
          <span
            key={`g-${lineIdx}-${bi}`}
            style={{ ...style, borderBottom: '1px dashed currentColor', cursor: 'pointer' }}
            className="transition-opacity active:opacity-70"
            onClick={ev => {
              ev.stopPropagation();
              const r = (ev.currentTarget as HTMLElement).getBoundingClientRect();
              setTooltipTarget({ top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width });
              setTooltipPos({ x: -9999, y: -9999 });
              setActiveTerm(hit.item);
            }}
          >{segText}</span>
        );
      } else {
        segs.push(<span key={`t-${lineIdx}-${bi}`} style={style}>{segText}</span>);
      }
    }

    if (isListItem) {
      return (
        <div key={lineIdx} className="flex gap-2 mb-1.5 pl-2 mt-1">
          <span className="text-[14px] leading-snug font-bold" style={{ color: 'var(--c-amber)' }}>{listMarker}</span>
          <p className="m-0 flex-1 leading-snug">{segs}</p>
        </div>
      );
    }
    return <p key={lineIdx} className="indent-4 mb-2 mt-1 last:mb-0">{segs}</p>;
  };

  return (
    <div
      className={`relative w-full break-words whitespace-pre-wrap [word-break:break-word] ${className}`}
      style={{ fontSize }}
    >
      {text.split('\n').map((line, i) => renderLine(line, i))}

      {/* ── Тултип с определением (плавающий, перетаскиваемый) ── */}
      {activeTerm && (
        <div
          ref={tooltipRef}
          className="fixed z-[200] rounded-2xl p-4 shadow-2xl select-none"
          style={{
            left:       tooltipPos.x,
            top:        tooltipPos.y,
            width:      '80vw',
            maxWidth:   280,
            background: 'var(--c-card)',
            border:     '1px solid var(--c-primary-br)',
            boxShadow:  '0 8px 32px rgba(0,0,0,0.3)',
            cursor:     dragging ? 'grabbing' : 'grab',
          }}
          onMouseDown={handleTooltipMouseDown}
          onTouchStart={handleTooltipTouchStart}
          onClick={e => e.stopPropagation()}
        >
          {activeTerm.image && (
            <GlossaryImages
              images={Array.isArray(activeTerm.image) ? activeTerm.image : [activeTerm.image]}
              onZoom={openZoom}
            />
          )}
          <h4 className="font-bold mb-1 text-sm" style={{ color: 'var(--c-text)' }}>
            {activeTerm.term}
          </h4>
          <p className="text-sm leading-snug" style={{ color: 'var(--c-text)' }}>
            {activeTerm.definition}
          </p>
          <p className="text-[10px] mt-2 opacity-50" style={{ color: 'var(--c-muted)' }}>
            ↔ перетащите
          </p>
        </div>
      )}

      {/* ── Зум картинки ── */}
      {zoomList.length > 0 && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center"
          style={{
            background:         'hsl(0 0% 0% / 0.92)',
            backdropFilter:     'blur(8px)',
            touchAction:        'none',
            overscrollBehavior: 'contain',
          }}
          onClick={closeZoom}
          onWheel={e => {
            e.preventDefault();
            const delta    = e.deltaY > 0 ? -0.25 : 0.25;
            const newScale = Math.min(5, Math.max(1, scale + delta));
            const img  = zoomImgRef.current;
            if (!img) { setScale(newScale); return; }
            const rect = img.getBoundingClientRect();
            const dx   = e.clientX - (rect.left + rect.width  / 2);
            const dy   = e.clientY - (rect.top  + rect.height / 2);
            const r    = newScale / scale;
            setScale(newScale);
            setTranslate(clampZoom({ x: translate.x + dx * (1 - r), y: translate.y + dy * (1 - r) }, newScale));
          }}
          onTouchStart={e => {
            if (e.touches.length === 2) {
              const t1 = e.touches[0], t2 = e.touches[1];
              const dx = t1.clientX - t2.clientX, dy = t1.clientY - t2.clientY;
              const cx = (t1.clientX + t2.clientX) / 2, cy = (t1.clientY + t2.clientY) / 2;
              const img  = zoomImgRef.current;
              const rect = img?.getBoundingClientRect();
              const ix   = rect ? cx - (rect.left + rect.width  / 2) : 0;
              const iy   = rect ? cy - (rect.top  + rect.height / 2) : 0;
              (e.currentTarget as any).__ps = { dist: Math.hypot(dx, dy), scale, translate, ix, iy };
            } else if (e.touches.length === 1 && scale > 1) {
              (e.currentTarget as any).__pan = { x: e.touches[0].clientX, y: e.touches[0].clientY, translate };
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
              setScale(ns);
              setTranslate(clampZoom({ x: ps.translate.x + ps.ix * (1 - r), y: ps.translate.y + ps.iy * (1 - r) }, ns));
            } else if (e.touches.length === 1 && target.__pan && scale > 1) {
              e.preventDefault();
              const p = target.__pan;
              setTranslate(clampZoom({ x: p.translate.x + e.touches[0].clientX - p.x, y: p.translate.y + e.touches[0].clientY - p.y }, scale));
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
            delete t.__ps; delete t.__pan; delete t.__swipe;
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
                maxWidth:  '95vw',
                maxHeight: '85vh',
                transform: `scale(${scale}) translate(${translate.x / scale}px, ${translate.y / scale}px)`,
                transformOrigin: 'center center',
                transition: dragging ? 'none' : 'transform 0.05s',
                userSelect: 'none',
                WebkitUserSelect: 'none',
              }}
              draggable={false}
            />
          </div>

          {/* счётчик и точки */}
          {zoomList.length > 1 && (
            <div className="fixed bottom-8 left-0 right-0 flex justify-center gap-2">
              {zoomList.map((_, i) => (
                <div
                  key={i}
                  className="rounded-full transition-all"
                  style={{
                    width:      i === zoomIdx ? 20 : 7,
                    height:     7,
                    background: i === zoomIdx ? 'white' : 'rgba(255,255,255,0.4)',
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
