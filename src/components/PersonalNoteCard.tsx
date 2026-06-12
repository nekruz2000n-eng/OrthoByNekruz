"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

/** iOS/Telegram WebView не зумит поле, если шрифт ≥ 16px. */
const NOTE_INPUT_FONT_PX = 16;

type PersonalNoteCardProps = {
  note: string;
  onSave: (text: string) => void;
  onClear: () => void;
  /** Прокручиваемый контейнер режима чтения — чтобы заметка не уезжала под клавиатуру. */
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
  className?: string;
};

function findScrollParent(el: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = el.parentElement;
  while (node) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === 'auto' || overflowY === 'scroll') return node;
    node = node.parentElement;
  }
  return null;
}

function scrollNoteIntoView(
  noteEl: HTMLElement,
  scrollContainer?: HTMLElement | null,
) {
  requestAnimationFrame(() => {
    const scroller = scrollContainer ?? findScrollParent(noteEl);
    noteEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

    const vv = window.visualViewport;
    if (!vv) return;

    const rect = noteEl.getBoundingClientRect();
    const visibleBottom = vv.offsetTop + vv.height;
    const gap = 24;
    if (rect.bottom > visibleBottom - gap) {
      const delta = rect.bottom - visibleBottom + gap + 48;
      if (scroller) {
        scroller.scrollBy({ top: delta, behavior: 'smooth' });
      } else {
        window.scrollBy({ top: delta, behavior: 'smooth' });
      }
    }
  });
}

export const PersonalNoteCard: React.FC<PersonalNoteCardProps> = ({
  note,
  onSave,
  onClear,
  scrollContainerRef,
  className = '',
}) => {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(note);
  const rootRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setLocal(note); }, [note]);

  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(72, el.scrollHeight)}px`;
  }, []);

  const beginEdit = useCallback(() => {
    setEditing(true);
  }, []);

  const finishEdit = useCallback(() => {
    onSave(local);
    setEditing(false);
  }, [local, onSave]);

  useEffect(() => {
    if (!editing) return;
    const el = textareaRef.current;
    const root = rootRef.current;
    if (!el || !root) return;

    resizeTextarea();

    const focusTimer = window.setTimeout(() => {
      el.focus({ preventScroll: true });
      const len = el.value.length;
      el.setSelectionRange(len, len);
      scrollNoteIntoView(root, scrollContainerRef?.current);
    }, 50);

    return () => window.clearTimeout(focusTimer);
  }, [editing, resizeTextarea, scrollContainerRef]);

  useEffect(() => {
    if (!editing) return;
    const vv = window.visualViewport;
    if (!vv) return;

    const onViewportChange = () => {
      const root = rootRef.current;
      if (!root) return;
      scrollNoteIntoView(root, scrollContainerRef?.current);
    };

    vv.addEventListener('resize', onViewportChange);
    vv.addEventListener('scroll', onViewportChange);
    return () => {
      vv.removeEventListener('resize', onViewportChange);
      vv.removeEventListener('scroll', onViewportChange);
    };
  }, [editing, scrollContainerRef]);

  return (
    <div
      ref={rootRef}
      className={`mt-4 p-3.5 rounded-2xl ${className}`}
      style={{ background: 'var(--c-amber-dim)', border: '1px solid var(--c-amber-br)' }}
    >
      <div className="flex items-center justify-between mb-2">
        <div
          className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest"
          style={{ color: 'var(--c-amber)' }}
        >
          <Pencil className="w-3 h-3" /> Моя заметка
        </div>
        <div className="flex gap-3 items-center">
          {note && (
            <button
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => { onClear(); setLocal(''); setEditing(false); }}
              style={{ color: 'hsl(var(--destructive))' }}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onMouseDown={e => e.preventDefault()}
            onClick={() => { if (editing) finishEdit(); else beginEdit(); }}
            className="text-[11px] font-semibold"
            style={{ color: 'var(--c-amber)' }}
          >
            {editing ? 'Готово' : 'Править'}
          </button>
        </div>
      </div>

      {editing ? (
        <textarea
          ref={textareaRef}
          value={local}
          onChange={e => { setLocal(e.target.value); resizeTextarea(); }}
          onFocus={() => {
            const root = rootRef.current;
            if (root) {
              window.setTimeout(
                () => scrollNoteIntoView(root, scrollContainerRef?.current),
                300,
              );
            }
          }}
          onBlur={() => onSave(local)}
          placeholder="Добавьте примечания…"
          inputMode="text"
          autoComplete="off"
          autoCorrect="on"
          spellCheck
          rows={3}
          className="w-full bg-transparent border-none focus:ring-0 p-0 resize-none outline-none touch-manipulation"
          style={{
            color: 'var(--c-text)',
            caretColor: 'var(--c-amber)',
            fontSize: `${NOTE_INPUT_FONT_PX}px`,
            lineHeight: 1.5,
            minHeight: '72px',
          }}
        />
      ) : (
        <div
          role="button"
          tabIndex={0}
          className="text-sm prose prose-invert max-w-none break-words whitespace-pre-wrap min-h-[24px] cursor-text"
          onClick={beginEdit}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') beginEdit(); }}
        >
          {note
            ? <ReactMarkdown>{note}</ReactMarkdown>
            : (
              <p
                className="italic text-sm"
                style={{ color: 'color-mix(in srgb, var(--c-amber) 45%, transparent)' }}
              >
                Нет примечаний. Нажмите «Править»…
              </p>
            )}
        </div>
      )}
    </div>
  );
};
