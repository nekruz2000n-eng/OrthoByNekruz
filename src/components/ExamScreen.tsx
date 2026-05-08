"use client";

// ════════════════════════════════════════════════════════════════════════════
//  ExamScreen — модал «Проверка готовности»
//
//  Логика:
//    1. Алгоритм рандомно выбирает 2 разных вопроса из questions.json
//       и 1 задачу из tasks.json для текущего предмета.
//    2. Запускается таймер 20 минут.
//    3. На каждом задании: показывается текст → юзер тапает «Показать ответ» →
//       видит правильный ответ (карточка с ответом скроллится при длинном
//       тексте) → отмечает «Знал» / «Не знал».
//    4. После 3-го ответа (или по истечении таймера) — экран результата с
//       баллом X/3, временем, кнопкой «Сохранить и закрыть».
//    5. Результат записывается в localStorage (последние 10 попыток).
//    6. Можно прервать в любой момент кнопкой «✕» наверху (с подтверждением).
// ════════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { X, Clock, Check, XCircle, ChevronRight, Award, RefreshCw } from 'lucide-react';

// ─── Типы ───────────────────────────────────────────────────────────────────
interface RawItem { id: number | string; question: string; answer: string; }
interface Item extends RawItem { type: 'question' | 'task'; }

export interface ExamHistoryEntry {
  ts:          number;  // timestamp начала попытки
  score:       number;  // 0..total
  total:       number;  // обычно 3
  durationSec: number;  // сколько потратил
  finished:    boolean; // дошёл до конца или прервал
}

interface ExamScreenProps {
  subject:        string;
  subjectLabel:   string;
  accentColor:    string;
  dimColor:       string;
  borderColor:    string;
  questionsData:  RawItem[];
  tasksData:      RawItem[];
  onClose:       () => void;
  /** Колбэк после сохранения результата — чтобы StatsTab перерисовал график */
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

// ─── Рандомизация ───────────────────────────────────────────────────────────
function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pickExamItems(questions: RawItem[], tasks: RawItem[]): Item[] | null {
  if (questions.length < 2 || tasks.length < 1) return null;
  const q = shuffle(questions);
  const t = shuffle(tasks);
  return [
    { ...q[0], type: 'question' },
    { ...q[1], type: 'question' },
    { ...t[0], type: 'task' },
  ];
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
  questionsData, tasksData, onClose, onResultSaved,
}) => {
  const [phase, setPhase] = useState<'intro'|'question'|'answer'|'result'|'no-data'>('intro');
  const [items, setItems] = useState<Item[]>([]);
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
    if (questionsData.length < 2 || tasksData.length < 1) {
      setPhase('no-data');
    }
  }, [questionsData.length, tasksData.length]);

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

  // Старт
  const startExam = () => {
    const picked = pickExamItems(questionsData, tasksData);
    if (!picked) { setPhase('no-data'); return; }
    setItems(picked);
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
    });
    onResultSaved?.();
    setPhase('result');
  };

  // Самооценка после показа ответа
  const handleSelfGrade = (knew: boolean) => {
    const newScore = knew ? score + 1 : score;
    setScore(newScore);
    if (currentIdx + 1 >= items.length) {
      // Финал: сохраняем с актуальным баллом
      finishedRef.current = true;
      finalDurationRef.current = Math.floor((Date.now() - startTimeRef.current) / 1000);
      saveExamResult(subject, {
        ts:          startTimeRef.current,
        score:       newScore,
        total:       items.length,
        durationSec: finalDurationRef.current,
        finished:    true,
      });
      onResultSaved?.();
      setPhase('result');
    } else {
      setCurrentIdx(i => i + 1);
      setPhase('question');
    }
  };

  // Прерывание (без сохранения)
  const handleHardExit = () => {
    if (phase === 'question' || phase === 'answer') {
      // Сохраняем как незавершённую попытку
      const dur = Math.floor((Date.now() - startTimeRef.current) / 1000);
      saveExamResult(subject, {
        ts:          startTimeRef.current,
        score,
        total:       items.length,
        durationSec: dur,
        finished:    false,
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
  const timerLow    = secondsLeft <= 120; // последние 2 минуты — красным
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
      {/* ── ШАПКА: таймер + прогресс + крест ── */}
      <div
        className="flex-shrink-0 flex items-center gap-3 px-4 pt-5 pb-3"
        style={{ borderBottom: '1px solid var(--c-border)' }}
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
            <div className="flex-1 flex items-center gap-2">
              <span className="text-[11px] font-bold" style={{ color: 'var(--c-muted)' }}>
                {currentIdx + 1}/{total}
              </span>
              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--c-border)' }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%`, background: accentColor }}
                />
              </div>
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
          className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition active:scale-90"
          style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}
        >
          <X className="w-4 h-4" style={{ color: 'var(--c-muted)' }} />
        </button>
      </div>

      {/* ── ОСНОВНОЕ СОДЕРЖИМОЕ ── */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="max-w-xl mx-auto px-5 py-5">

          {/* INTRO */}
          {phase === 'intro' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div
                className="rounded-2xl p-5 mb-5"
                style={{ background: dimColor, border: `1.5px solid ${borderColor}` }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{ background: 'var(--c-bg)', color: accentColor }}
                  >
                    <Award className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-base font-bold" style={{ color: 'var(--c-text)' }}>{subjectLabel}</div>
                    <div className="text-[11px]" style={{ color: 'var(--c-muted)' }}>3 задания · 20 минут</div>
                  </div>
                </div>
                <p className="text-[13px] leading-relaxed mb-3" style={{ color: 'var(--c-text)' }}>
                  Алгоритм случайно выберет <b>2 вопроса</b> и <b>1 задачу</b>. Подумай ответ
                  устно или мысленно, тапни <b>«Показать ответ»</b> и сам себя оцени —
                  <b> «Знал»</b> или <b> «Не знал»</b>.
                </p>
                <p className="text-[12px]" style={{ color: 'var(--c-muted)' }}>
                  Таймер 20 минут запустится после кнопки «Начать». Можно прервать в любой
                  момент — попытка сохранится с текущим результатом.
                </p>
              </div>

              <button
                onClick={startExam}
                className="w-full h-[52px] rounded-2xl font-bold text-[15px] transition active:scale-[0.98]"
                style={{
                  background: accentColor,
                  color: 'var(--c-bg)',
                  boxShadow: `0 8px 24px color-mix(in srgb, ${accentColor} 35%, transparent)`,
                }}
              >
                Начать экзамен
              </button>
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
                Чтобы запустить экзамен, по предмету «{subjectLabel}» должно быть минимум
                2 вопроса и 1 задача.
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
                {currentItem.type === 'question' ? `Вопрос ${currentIdx + 1}` : 'Задача'}
              </div>
              <div
                className="rounded-2xl p-5 mb-5"
                style={{ background: 'var(--c-card)', border: '1.5px solid var(--c-border)' }}
              >
                <div
                  className="text-[15px] leading-relaxed prose-sm"
                  style={{ color: 'var(--c-text)' }}
                >
                  <ReactMarkdown>{currentItem.question}</ReactMarkdown>
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
              {/* Сам вопрос (короче, для контекста) */}
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
                <div
                  className="text-[13px] leading-snug"
                  style={{ color: 'var(--c-text)' }}
                >
                  <ReactMarkdown>{currentItem.question}</ReactMarkdown>
                </div>
              </div>

              {/* Ответ — большой, контентный, скроллируется при длинном тексте через
                  родительский overflow-y-auto */}
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
                <div
                  className="text-[14px] leading-relaxed prose-sm"
                  style={{ color: 'var(--c-text)' }}
                >
                  <ReactMarkdown>{currentItem.answer}</ReactMarkdown>
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
                      <div className="text-[11px]" style={{ color: 'var(--c-muted)' }}>
                        Время: {fmtTime(finalDurationRef.current)}
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => { startExam(); }}
                        className="flex-1 h-[52px] rounded-2xl font-bold text-[14px] flex items-center justify-center gap-2 transition active:scale-[0.97]"
                        style={{
                          background: 'var(--c-card)',
                          border: '1.5px solid var(--c-border)',
                          color: 'var(--c-text)',
                        }}
                      >
                        <RefreshCw className="w-4 h-4" />
                        Ещё раз
                      </button>
                      <button
                        onClick={onClose}
                        className="flex-1 h-[52px] rounded-2xl font-bold text-[14px] transition active:scale-[0.97]"
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
                Текущая попытка ({score}/{items.length}) сохранится как незавершённая.
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
