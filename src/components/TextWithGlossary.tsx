"use client";

import React, { useState, useMemo } from 'react';

interface GlossaryItem {
  term: string;
  definition: string;
}

interface Props {
  text: string;
  glossary: GlossaryItem[];
}

export const TextWithGlossary: React.FC<Props> = ({ text, glossary }) => {
  const [activeWord, setActiveWord] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const escapeRegExp = (str: string) =>
    str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const regex = useMemo(() => {
    if (!glossary.length) return null;
    const terms = glossary
      .map(g => escapeRegExp(g.term))
      .filter(Boolean)
      .sort((a, b) => b.length - a.length); // длинные первыми
    if (terms.length === 0) return null;
    return new RegExp(`\\b(${terms.join('|')})\\b`, 'gi');
  }, [glossary]);

  const findDefinition = (word: string) => {
    const found = glossary.find(
      g => g.term.toLowerCase() === word.toLowerCase()
    );
    return found?.definition;
  };

  const handleTermClick = (e: React.MouseEvent, word: string) => {
    e.stopPropagation();
    const def = findDefinition(word);
    if (def) {
      setActiveWord(word);
      setTooltipPos({ x: e.clientX, y: e.clientY });
    }
  };

  const closeTooltip = () => setActiveWord(null);

  if (!regex) return <p className="whitespace-pre-wrap text-white">{text}</p>;

  // Разбиваем текст на куски
  const parts: { text: string; isTerm: boolean }[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const textCopy = text; // чтобы не мутировать

  // Создаём временную регулярку для поиска (каждый раз новая, но в useMemo сохранена основная)
  const execRegex = new RegExp(regex.source, 'gi');
  while ((match = execRegex.exec(textCopy)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: textCopy.substring(lastIndex, match.index), isTerm: false });
    }
    parts.push({ text: match[0], isTerm: true });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < textCopy.length) {
    parts.push({ text: textCopy.substring(lastIndex), isTerm: false });
  }

  return (
    <div className="relative">
      <p className="whitespace-pre-wrap text-white">
        {parts.map((part, i) =>
          part.isTerm ? (
            <span
              key={i}
              className="text-primary underline decoration-dotted cursor-pointer hover:text-primary/80"
              onClick={(e) => handleTermClick(e, part.text)}
              title="Нажми, чтобы увидеть определение"
            >
              {part.text}
            </span>
          ) : (
            <span key={i}>{part.text}</span>
          )
        )}
      </p>

      {/* Тултип с определением */}
      {activeWord && (
        <div
          className="fixed z-50 bg-card border border-white/10 rounded-2xl p-4 shadow-2xl max-w-xs"
          style={{ left: tooltipPos.x + 10, top: tooltipPos.y + 10 }}
          onClick={closeTooltip}
        >
          <h4 className="text-white font-bold mb-1">{activeWord}</h4>
          <p className="text-muted-foreground text-sm">{findDefinition(activeWord)}</p>
          <button
            onClick={closeTooltip}
            className="mt-2 text-xs text-primary underline"
          >
            Закрыть
          </button>
        </div>
      )}
    </div>
  );
};