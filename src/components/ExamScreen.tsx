"use client";

// ════════════════════════════════════════════════════════════════════════════
//  ExamScreen — модал «Проверка готовности» (Режим фиксированных билетов)
//
//  Логика:
//    1. Алгоритм предлагает выбрать конкретный билет из сетки или случайный.
//    2. Запускается таймер 20 минут. Пользователь видит номер билета.
//    3. На каждом задании показывается текст с кастомным рендером (жирный, курсив, списки).
//    4. Юзер тапает «Показать ответ» → видит ответ → отмечает «Знал» / «Не знал».
//    5. После 3-го ответа — экран результата с кнопкой выбора другого билета.
//    6. Результат записывается в localStorage с указанием номера билета.
// ════════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, Check, XCircle, Award, RefreshCw, BookOpen, Dices } from 'lucide-react';

// ─── Типы ───────────────────────────────────────────────────────────────────
interface RawItem { 
  id: number | string; 
  question: string; 
  answer: string; 
}

interface Item extends RawItem { 
  type: 'question' | 'task'; 
}

export interface Ticket {
  id: number | string;
  ticketNumber: string | number;
  questions: RawItem[]; // Ожидается массив из 2 элементов
  task: RawItem;        // 1 элемент (может быть с пустыми строками, если задачи пока нет)
}

export interface ExamHistoryEntry {
  ts:          number;  // timestamp начала попытки
  score:       number;  // 0..total
  total:       number;  // обычно 3
  durationSec: number;  // сколько потратил
  finished:    boolean; // дошёл до конца или прервал
  ticketId?:   string | number; // Сохраняем, какой билет попался
}

interface ExamScreenProps {
  subject:        string;
  subjectLabel:   string;
  accentColor:    string;
  dimColor:       string;
  borderColor:    string;
  ticketsData:    Ticket[]; 
  onClose:        () => void;
  onResultSaved?: () => void;
}

// ─── Константы ──────────────────────────────────────────────────────────────
const EXAM_DURATION_SEC = 20 * 60;   // 20 минут
const HISTORY_MAX       = 10;

// ─── localStorage helpers ───────────────────────────────────────────────────
export function getExamHistoryKey(subjectId: string): string {
  return subjectId === 'ortho' ? 'exam_history' : `${subjectId}_exam_history`;
}

export function loadExamHistory(subjectId: string): ExamHistoryEntry[] {
  try {
    const raw = localStorage.getItem(getExamHistoryKey(subjectId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function saveExamResult(subjectId: string, entry: ExamHistoryEntry) {
  const history = loadExamHistory(subjectId);
  history.push(entry);
  const trimmed = history.slice(-HISTORY_MAX);
  localStorage.setItem(getExamHistoryKey(subjectId), JSON.stringify(trimmed));
}

// ─── Форматирование ─────────────────────────────────────────────────────────
function fmtTime(sec: number): string {
  const m = Math.floor(Math.max(0, sec) / 60);
  const s = Math.max(0, sec) % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ════════════════════════════════════════════════════════════════════════════
//  Компонент
// ════════════════════════════════════════════════════════════════════════════
export const ExamScreen: React.FC<ExamScreenProps> = ({
  subject, subjectLabel, accentColor, dimColor, borderColor,
  ticketsData, onClose, onResultSaved,
}) => {
  const [phase, setPhase] = useState<'intro'|'question'|'answer'|'result'|'no-data'>('intro');
  const [items, setItems] = useState<Item[]>([]);
  const [currentTicket, setCurrentTicket] = useState<string | number>('');
  const [currentIdx, setCurrentIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(EXAM_DURATION_SEC);
  const [confirmExit, setConfirmExit] = useState(false);
  const startTimeRef = useRef<number>(0);
  const finalDurationRef = useRef<number>(0);
  const finishedRef = useRef<boolean>(false);

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Если данных недостаточно — показать заглушку
  useEffect(() => {
    if (!ticketsData || ticketsData.length === 0) {
      setPhase('no-data');
    }
  }, [ticketsData]);

  // Таймер
  useEffect(() => {
    if (phase !== 'question' && phase !== 'answer') return;
    const t = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) {
          finishExam(false);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ─── Кастомный рендер текста (замена ReactMarkdown) ───
  const renderFormattedText = (text: string) => {
    if (!text) return null;

    return (
      <div className="w-full break-words whitespace-pre-wrap [word-break:break-word]">
        {text.split('\n').map((line, lineIdx) => {
          let isBoldState = false;
          let isItalicState = false;

          if (line.trim() === '') return <div key={lineIdx} className="h-1" />;

          const listMatch = line.match(/^(\s*[•\-\*]\s+|\s*\d+\.\s+)/);
          const isListItem = !!listMatch;
          let listMarker = isListItem ? listMatch![1].trim() : '';
          if (listMarker === '-' || listMarker === '*') listMarker = '•';
          
          const cleanLine = isListItem
            ? line.replace(/^(\s*[•\-\*]\s+|\s*\d+\.\s+)/, '')
            : line;

          const tokens = cleanLine.split(/(\*\*|_)/g);

          const renderedTokens = tokens.map((token, tIdx) => {
            if (!token) return null;

            if (token === '**') {
              isBoldState = !isBoldState;
              return null;
            }
            if (token === '_') {
              isItalicState = !isItalicState;
              return null;
            }

            const baseStyle: React.CSSProperties = {
              fontWeight: isBoldState ? 700 : 'inherit',
              color: isBoldState ? 'var(--c-text)' : 'inherit',
              fontStyle: isItalicState ? 'italic' : 'normal',
            };

            return <span key={`text-${lineIdx}-${tIdx}`} style={baseStyle}>{token}</span>;
          });

          if (isListItem) {
            return (
              <div key={lineIdx} className="flex gap-2 mb-1.5 pl-2 mt-1">
                <span
                  className="text-[14px] leading-snug font-bold"
                  style={{ color: accentColor }}
                >
                  {listMarker}
                </span>
                <p className="m-0 flex-1 leading-snug">{renderedTokens}</p>
              </div>
            );
          }

          return (
            <p key={lineIdx} className="indent-4 mb-2 mt-1 last:mb-0">
              {renderedTokens}
            </p>
          );
        })}
      </div>
    );
  };

  // Старт экзамена (выбор конкретного или случайного билета)
  const startExam = (ticketId?: string | number) => {
    let selectedTicket: Ticket | undefined;

    if (ticketId !== undefined) {
      selectedTicket = ticketsData.find(t => t.id === ticketId);
    } else {
      // Случайный билет
      const randomIndex = Math.floor(Math.random() * ticketsData.length);
      selectedTicket = ticketsData[randomIndex];
    }

    if (!selectedTicket) { setPhase('no-data'); return; }
    
    // Формируем плоский массив: 2 вопроса + 1 задача (даже если она пустая)
    const pickedItems: Item[] = [
      { ...selectedTicket.questions[0], type: 'question' },
      { ...selectedTicket.questions[1], type: 'question' },
      { ...selectedTicket.task, type: 'task' },
    ];

    setItems(pickedItems);
    setCurrentTicket(selectedTicket.ticketNumber);
    setCurrentIdx(0);
    setScore(0);
    setSecondsLeft(EXAM_DURATION_SEC);
    startTimeRef.current = Date.now();
    finishedRef.current = false;
    setPhase('question');
  };

  // Завершение (естественное или по таймеру)
  const finishExam = (manual: boolean) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    finalDurationRef.current = Math.floor((Date.now() - startTimeRef.current) / 1000);
    saveExamResult(subject, {
      ts:          startTimeRef.current,
      score,
      total:       items.length || 3,
      durationSec: finalDurationRef.current,
      finished:    true,
      ticketId:    currentTicket,
    });
    onResultSaved?.();
    setPhase('result');
  };

  // Самооценка после показа ответа
  const handleSelfGrade = (knew: boolean) => {
    const newScore = knew ? score + 1 : score;
    setScore(newScore);
    if (currentIdx + 1 >= items.length) {
      finishedRef.current = true;
      finalDurationRef.current = Math.floor((Date.now() - startTimeRef.current) / 1000);
      saveExamResult(subject, {
        ts:          startTimeRef.current,
        score:       newScore,
        total:       items.length,
        durationSec: finalDurationRef.current,
        finished:    true,
        ticketId:    currentTicket,
      });
      onResultSaved?.();
      setPhase('result');
    } else {
      setCurrentIdx(i => i + 1);
      setPhase('question');
    }
  };

  // Прерывание (без сохранения как завершенного)
  const handleHardExit = () => {
    if (phase === 'question' || phase === 'answer') {
      const dur = Math.floor((Date.now() - startTimeRef.current) / 1000);
      saveExamResult(subject, {
        ts:          startTimeRef.current,
        score,
        total:       items.length,
        durationSec: dur,
        finished:    false,
        ticketId:    currentTicket,
      });
      onResultSaved?.();
    }
    onClose();
  };

  if (!mounted) return null;

  // ── Подсчёты для UI ──
  const currentItem = items[currentIdx];
  const total       = items.length || 3;
  const progressPct = total > 0 ? ((currentIdx + (phase === 'answer' ? 0.5 : 0)) / total) * 100 : 0;
  const timerLow    = secondsLeft <= 120;
  const timerColor  = timerLow ? 'hsl(var(--destructive))' : accentColor;

  // ════════════════════════════════════════════════════════════════════════
  //  Render
  // ════════════════════════════════════════════════════════════════════════
  return createPortal(
    <motion.div
      className="fixed inset-0 flex flex-col"
      style={{ zIndex: 9999, background: 'var(--c-bg)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* ── ШАПКА ── */}
      <div
        className="flex-shrink-0 flex items-center gap-3 px-4 pt-5 pb-3 sticky top-0 z-10"
        style={{ 
          background: 'color-mix(in srgb, var(--c-bg) 92%, transparent)', 
          backdropFilter: 'blur(16px)', 
          WebkitBackdropFilter: 'blur(16px)', 
          borderBottom: '1px solid var(--c-border)',
          paddingTop: 'var(--header-pt)'
        }}
      >
        {phase === 'question' || phase === 'answer' ? (
          <>
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold text-sm tabular-nums"
              style={{
                background: timerLow ? 'hsla(var(--destructive), 0.12)' : dimColor,
                color: timerColor,
                border: `1px solid ${timerLow ? 'hsla(var(--destructive), 0.4)' : borderColor}`,
              }}
            >
              <Clock className="w-4 h-4" />
              {fmtTime(secondsLeft)}
            </div>
            
            <div 
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold text-sm"
              style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)', color: 'var(--c-text)' }}
            >
              <BookOpen className="w-4 h-4" style={{ color: accentColor }} />
              Билет {currentTicket}
            </div>
            
            <div className="flex-1 flex items-center gap-2 justify-end">
              <span className="text-[11px] font-bold" style={{ color: 'var(--c-muted)' }}>
                {currentIdx + 1}/{total}
              </span>
            </div>
          </>
        ) : (
          <div className="flex-1">
            <div className="text-base font-bold" style={{ color: 'var(--c-text)' }}>
              {phase === 'intro'   && 'Проверка готовности'}
              {phase === 'result'  && 'Результат'}
              {phase === 'no-data' && 'Экзамен недоступен'}
            </div>
            <div className="text-[11px] mt-0.5" style={{ color: 'var(--c-muted)' }}>{subjectLabel}</div>
          </div>
        )}

        <button
          onClick={() => {
            if (phase === 'question' || phase === 'answer') setConfirmExit(true);
            else onClose();
          }}
          className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition active:scale-90 ml-auto"
          style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}
        >
          <X className="w-4 h-4" style={{ color: 'var(--c-muted)' }} />
        </button>
      </div>

      {/* ПРОГРЕСС-БАР (Под шапкой) */}
      {(phase === 'question' || phase === 'answer') && (
         <div className="w-full h-1" style={{ background: 'var(--c-border)' }}>
           <div
             className="h-full transition-all duration-500"
             style={{ width: `${progressPct}%`, background: accentColor }}
           />
         </div>
      )}

      {/* ── ОСНОВНОЕ СОДЕРЖИМОЕ ── */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="max-w-xl mx-auto px-5 py-5">

          {/* INTRO */}
          {phase === 'intro' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <button
                onClick={() => startExam()} // Без параметров = случайный
                className="w-full h-[60px] rounded-2xl font-bold text-[16px] flex items-center justify-center gap-3 transition active:scale-[0.98] mb-6"
                style={{
                  background: accentColor,
                  color: 'var(--c-bg)',
                  boxShadow: `0 8px 24px color-mix(in srgb, ${accentColor} 35%, transparent)`,
                }}
              >
                <Dices className="w-6 h-6" />
                Случайный билет
              </button>

              <div className="mb-3 text-[13px] font-bold uppercase tracking-widest" style={{ color: 'var(--c-muted)' }}>
                Или выберите конкретный ({ticketsData.length}):
              </div>

              {/* Сетка билетов */}
              <div className="grid grid-cols-5 gap-2 sm:grid-cols-6 md:grid-cols-8">
                {ticketsData.map((ticket) => (
                  <button
                    key={ticket.id}
                    onClick={() => startExam(ticket.id)}
                    className="aspect-square rounded-xl font-bold text-[15px] flex items-center justify-center transition active:scale-90"
                    style={{
                      background: 'var(--c-card)',
                      border: '1.5px solid var(--c-border)',
                      color: 'var(--c-text)',
                    }}
                  >
                    {ticket.ticketNumber}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* NO-DATA */}
          {phase === 'no-data' && (
            <div className="text-center py-10">
              <div className="text-5xl mb-3">📭</div>
              <h3 className="text-base font-bold mb-2" style={{ color: 'var(--c-text)' }}>
                Недостаточно материала
              </h3>
              <p className="text-[13px] max-w-xs mx-auto" style={{ color: 'var(--c-muted)' }}>
                Ожидается загрузка файла с билетами.
              </p>
            </div>
          )}

          {/* QUESTION */}
          {phase === 'question' && currentItem && (
            <motion.div
              key={`q-${currentIdx}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div
                className="text-[10px] font-bold uppercase tracking-widest mb-2"
                style={{ color: accentColor }}
              >
                {currentItem.type === 'question' ? `Вопрос ${currentIdx + 1}` : 'Задача (Вопрос 3)'}
              </div>
              <div
                className="rounded-2xl p-5 mb-5"
                style={{ background: 'var(--c-card)', border: '1.5px solid var(--c-border)' }}
              >
                <div className="text-[15px] leading-relaxed" style={{ color: 'var(--c-text)' }}>
                  {renderFormattedText(currentItem.question)}
                </div>
              </div>

              <button
                onClick={() => setPhase('answer')}
                className="w-full h-[52px] rounded-2xl font-bold text-[15px] transition active:scale-[0.98]"
                style={{
                  background: accentColor,
                  color: 'var(--c-bg)',
                  boxShadow: `0 8px 24px color-mix(in srgb, ${accentColor} 35%, transparent)`,
                }}
              >
                Показать ответ
              </button>
            </motion.div>
          )}

          {/* ANSWER */}
          {phase === 'answer' && currentItem && (
            <motion.div
              key={`a-${currentIdx}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div
                className="rounded-2xl p-4 mb-3"
                style={{ background: dimColor, border: `1px solid ${borderColor}` }}
              >
                <div
                  className="text-[10px] font-bold uppercase tracking-widest mb-1.5"
                  style={{ color: accentColor }}
                >
                  {currentItem.type === 'question' ? `Вопрос ${currentIdx + 1}` : 'Задача'}
                </div>
                <div className="text-[13px] leading-snug" style={{ color: 'var(--c-text)' }}>
                  {renderFormattedText(currentItem.question)}
                </div>
              </div>

              <div
                className="rounded-2xl p-5 mb-5"
                style={{
                  background: 'var(--c-card)',
                  border: `1.5px solid ${borderColor}`,
                }}
              >
                <div
                  className="text-[10px] font-bold uppercase tracking-widest mb-2 flex items-center gap-2"
                  style={{ color: accentColor }}
                >
                  <Check className="w-3.5 h-3.5" />
                  Правильный ответ
                </div>
                <div className="text-[14px] leading-relaxed" style={{ color: 'var(--c-text)' }}>
                  {renderFormattedText(currentItem.answer)}
                </div>
              </div>

              <div
                className="text-[12px] text-center mb-3"
                style={{ color: 'var(--c-muted)' }}
              >
                Оцените свой ответ
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => handleSelfGrade(false)}
                  className="flex-1 h-[52px] rounded-2xl font-bold text-[14px] flex items-center justify-center gap-2 transition active:scale-[0.97]"
                  style={{
                    background: 'hsla(var(--destructive), 0.1)',
                    border: '1.5px solid hsla(var(--destructive), 0.3)',
                    color: 'hsl(var(--destructive))',
                  }}
                >
                  <XCircle className="w-5 h-5" />
                  Не знал
                </button>
                <button
                  onClick={() => handleSelfGrade(true)}
                  className="flex-1 h-[52px] rounded-2xl font-bold text-[14px] flex items-center justify-center gap-2 transition active:scale-[0.97]"
                  style={{
                    background: dimColor,
                    border: `1.5px solid ${borderColor}`,
                    color: accentColor,
                  }}
                >
                  <Check className="w-5 h-5" />
                  Знал
                </button>
              </div>
            </motion.div>
          )}

          {/* RESULT */}
          {phase === 'result' && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              {(() => {
                const t = items.length || 3;
                const pct = Math.round((score / t) * 100);
                const verdict =
                  pct >= 90 ? { label: 'Отлично', emoji: '🏆', color: '#22c55e' } :
                  pct >= 67 ? { label: 'Хорошо',  emoji: '👍', color: accentColor } :
                  pct >= 34 ? { label: 'Слабо',   emoji: '📚', color: '#f59e0b' } :
                              { label: 'Подготовься ещё', emoji: '😅', color: '#ef4444' };

                return (
                  <>
                    <div
                      className="rounded-2xl p-6 mb-4 text-center"
                      style={{
                        background: dimColor,
                        border: `1.5px solid ${borderColor}`,
                      }}
                    >
                      <div className="text-5xl mb-3">{verdict.emoji}</div>
                      <div
                        className="text-3xl font-extrabold mb-1 tabular-nums"
                        style={{ color: verdict.color }}
                      >
                        {score} / {t}
                      </div>
                      <div className="text-sm font-bold mb-2" style={{ color: verdict.color }}>
                        {pct}% — {verdict.label}
                      </div>
                      <div className="text-[12px] font-medium mb-1" style={{ color: 'var(--c-text)' }}>
                        Сдан Билет № {currentTicket}
                      </div>
                      <div className="text-[11px]" style={{ color: 'var(--c-muted)' }}>
                        Время: {fmtTime(finalDurationRef.current)}
                      </div>
                    </div>

                    <div className="flex flex-col gap-3">
                      <button
                        onClick={() => { setPhase('intro'); }}
                        className="w-full h-[52px] rounded-2xl font-bold text-[14px] flex items-center justify-center gap-2 transition active:scale-[0.97]"
                        style={{
                          background: 'var(--c-card)',
                          border: '1.5px solid var(--c-border)',
                          color: 'var(--c-text)',
                        }}
                      >
                        <RefreshCw className="w-4 h-4" />
                        Выбрать другой билет
                      </button>
                      <button
                        onClick={onClose}
                        className="w-full h-[52px] rounded-2xl font-bold text-[14px] transition active:scale-[0.97]"
                        style={{
                          background: accentColor,
                          color: 'var(--c-bg)',
                        }}
                      >
                        Закрыть
                      </button>
                    </div>
                  </>
                );
              })()}
            </motion.div>
          )}

        </div>
      </div>

      {/* ── Confirm exit dialog ── */}
      <AnimatePresence>
        {confirmExit && (
          <motion.div
            className="fixed inset-0 flex items-center justify-center px-5"
            style={{ zIndex: 10000, background: 'rgba(0,0,0,0.55)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setConfirmExit(false)}
          >
            <motion.div
              className="rounded-3xl p-5 max-w-xs w-full"
              style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="text-base font-bold mb-2" style={{ color: 'var(--c-text)' }}>
                Прервать экзамен?
              </div>
              <div className="text-[13px] mb-5" style={{ color: 'var(--c-muted)' }}>
                Текущая попытка по Билету {currentTicket} ({score}/{items.length}) сохранится как незавершённая.
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmExit(false)}
                  className="flex-1 h-11 rounded-xl font-bold text-[13px]"
                  style={{ background: 'var(--c-border)', color: 'var(--c-text)' }}
                >
                  Продолжить
                </button>
                <button
                  onClick={handleHardExit}
                  className="flex-1 h-11 rounded-xl font-bold text-[13px]"
                  style={{ background: 'hsl(var(--destructive))', color: 'var(--c-bg)' }}
                >
                  Выйти
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>,
    document.body
  );
};