"use client";

// Универсальный компонент рендеринга текста с подсветкой глоссария.
// Используется в QuestionsTab, TestsTab, TasksTab.
import React, { useState, useMemo, useRef, useLayoutEffect } from 'react';

export interface GlossaryItem {
  term:        string;
  definition:  string;
  image?:      string | string[];
}

// ── Russian stemming (same as QuestionsTab) ───────────────────────────────────
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

interface Props {
  text:          string;
  relatedTerms?: string[];
  glossaryTerms: GlossaryItem[];
  fontSize?:     number;
  /** Доп. className на корневой div */
  className?:    string;
}

export const RichText: React.FC<Props> = ({
  text, relatedTerms, glossaryTerms, fontSize = 16, className = '',
}) => {
  const [activeTerm,    setActiveTerm]    = useState<GlossaryItem | null>(null);
  const [tooltipTarget, setTooltipTarget] = useState<{ top: number; bottom: number; left: number; right: number; width: number } | null>(null);
  const [tooltipPos,    setTooltipPos]    = useState({ x: -9999, y: -9999 });
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Только термины, которые входят в relatedTerms данного элемента
  const localGlossary = useMemo(() => {
    if (!relatedTerms?.length) return [];
    return [...glossaryTerms
      .filter(g => relatedTerms.some(rt => rt.toLowerCase() === g.term.toLowerCase()))]
      .sort((a, b) => b.term.length - a.term.length);
  }, [relatedTerms, glossaryTerms]);

  // Позиционирование тултипа над/под термином
  useLayoutEffect(() => {
    if (!activeTerm || !tooltipTarget || !tooltipRef.current) return;
    const popup = tooltipRef.current.getBoundingClientRect();
    const GAP = 20, PAD = 10;
    const vw = window.innerWidth, vh = window.innerHeight;
    let y = tooltipTarget.top - popup.height - GAP;
    if (y < PAD) y = tooltipTarget.bottom + GAP;
    if (y + popup.height > vh - PAD) y = vh - popup.height - PAD;
    let x = tooltipTarget.left + tooltipTarget.width / 2 - popup.width / 2;
    if (x < PAD) x = PAD;
    if (x + popup.width > vw - PAD) x = vw - popup.width - PAD;
    setTooltipPos({ x, y });
  }, [activeTerm, tooltipTarget]);

  if (!text) return null;

  // Рендер одной строки: markdown (bold/italic) + подсветка терминов
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

    // 3. Нарезаем на сегменты по границам форматирования + хитов
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

      {/* Тултип с определением */}
      {activeTerm && (
        <div
          className="fixed inset-0 z-[200]"
          onClick={() => setActiveTerm(null)}
        >
          <div
            ref={tooltipRef}
            className="absolute rounded-2xl p-4 shadow-2xl w-[85vw] max-w-xs"
            style={{
              background:  'var(--c-card)',
              border:      '1px solid var(--c-border)',
              left:         tooltipPos.x,
              top:          tooltipPos.y,
              boxShadow:   '0 8px 32px rgba(0,0,0,0.3)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {activeTerm.image && (
              <img
                src={Array.isArray(activeTerm.image) ? activeTerm.image[0] : activeTerm.image}
                alt={activeTerm.term}
                className="w-full rounded-xl mb-3 object-cover"
                style={{ maxHeight: 160 }}
              />
            )}
            <h4 className="font-bold mb-1.5 text-sm" style={{ color: 'var(--c-text)' }}>
              {activeTerm.term}
            </h4>
            <p className="text-sm leading-snug" style={{ color: 'var(--c-muted)' }}>
              {activeTerm.definition}
            </p>
            <button
              onClick={() => setActiveTerm(null)}
              className="mt-3 text-xs font-semibold"
              style={{ color: 'var(--c-primary)' }}
            >
              Закрыть
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
