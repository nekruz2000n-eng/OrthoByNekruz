"use client";

import React, { useState, useEffect } from 'react';
import orthoQuestionsData from '@/data/questions.json';
import orthoTasksData     from '@/data/tasks.json';
import orthoTestsData     from '@/data/tests.json';
import microQuestionsData from '@/data/micro_questions.json';
import microTasksData     from '@/data/micro_tasks.json';
import microTestsData     from '@/data/micro_tests.json';
import {'{ SubjectType }'} from '@/components/SubjectSelectScreen';
import { ScrollArea }     from '@/components/ui/scroll-area';
import { PieChart, Pie, Cell, ResponsiveContainer, Label } from 'recharts';
import { BookOpen, ClipboardList, PenTool, Star, Trash2, Sun, Moon, Sparkles } from 'lucide-react';
import { ToothIcon }     from './ToothIcon';
import { SubjectType }   from '@/components/SubjectSelectScreen';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Types ────────────────────────────────────────────────────────────────────
type Theme = 'dark' | 'light' | 'bright';

const THEMES: { id: Theme; label: string; desc: string; icon: React.ReactNode }[] = [
  { id: 'dark',   label: 'Тёмная',  desc: 'Для ночи', icon: <Moon     className="w-5 h-5" /> },
  { id: 'light',  label: 'Светлая', desc: 'Бумага',   icon: <Sun      className="w-5 h-5" /> },
  { id: 'bright', label: 'Яркая',   desc: 'Контраст', icon: <Sparkles className="w-5 h-5" /> },
];

// ─── Subject bottom-sheet ─────────────────────────────────────────────────────
interface SubjectSheetProps {
  currentSubject: SubjectType;
  onSelect:       (s: SubjectType) => void;
  onClose:        () => void;
}

const SubjectSheet: React.FC<SubjectSheetProps> = ({ currentSubject, onSelect, onClose }) => {
  const [selected, setSelected] = useState<SubjectType>(currentSubject);

  const items: { id: SubjectType; label: string; sub: string; color: string; dimVar: string; brVar: string; variant: 'perfect' | 'normal' }[] = [
    { id: 'ortho', label: 'Ортопедическая стоматология', sub: 'Вопросы · Тесты · Задачи', color: 'var(--c-primary)', dimVar: 'var(--c-primary-dim)', brVar: 'var(--c-primary-br)', variant: 'perfect' },
    { id: 'micro', label: 'Микробиология',               sub: 'Вопросы · Тесты · Задачи', color: 'var(--c-amber)',   dimVar: 'var(--c-amber-dim)',   brVar: 'var(--c-amber-br)',   variant: 'normal'  },
  ];

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <motion.div
        className="rounded-t-[28px] px-5 pb-10"
        style={{ background: 'var(--c-card)', borderTop: '1px solid var(--c-border)' }}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-5">
          <div className="w-9 h-1 rounded-full" style={{ background: 'var(--c-border)' }} />
        </div>

        <div className="text-center mb-6">
          <h3 className="text-base font-bold" style={{ color: 'var(--c-text)' }}>Сменить предмет</h3>
          <p className="text-xs mt-1" style={{ color: 'var(--c-muted)' }}>Выберите предмет для подготовки</p>
        </div>

        <div className="flex flex-col gap-3 mb-5">
          {items.map(item => {
            const isSel = selected  === item.id;
            const isCur = currentSubject === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setSelected(item.id)}
                className="flex items-center gap-4 rounded-[20px] p-4 text-left transition-all duration-200 active:scale-[0.98]"
                style={{
                  background: isSel ? item.dimVar : 'color-mix(in srgb, var(--c-border) 30%, transparent)',
                  border:     `1.5px solid ${isSel ? item.brVar : 'var(--c-border)'}`,
                }}
              >
                {/* Icon */}
                <div
                  className="w-[52px] h-[52px] rounded-[16px] flex items-center justify-center flex-shrink-0"
                  style={{ background: item.dimVar, border: `1px solid ${item.brVar}` }}
                >
                  <ToothIcon className="w-8 h-8" style={{ color: item.color }} variant={item.variant} />
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="text-sm font-bold" style={{ color: 'var(--c-text)' }}>{item.label}</span>
                    {isCur && (
                      <span
                        className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
                        style={{ background: item.dimVar, color: item.color }}
                      >
                        Сейчас
                      </span>
                    )}
                  </div>
                  <span className="text-[11px]" style={{ color: 'var(--c-muted)' }}>{item.sub}</span>
                </div>

                {/* Radio */}
                <div
                  className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center transition-all duration-200"
                  style={{
                    background: isSel ? item.color : 'transparent',
                    border:     `1.5px solid ${isSel ? item.color : 'var(--c-border)'}`,
                  }}
                >
                  {isSel && (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5l2.5 2.5 3.5-4" stroke="var(--c-bg)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Confirm */}
        <button
          disabled={selected === currentSubject}
          onClick={() => { onSelect(selected); onClose(); }}
          className="w-full h-[52px] rounded-[18px] text-[15px] font-bold transition-all duration-300 active:scale-[0.98]"
          style={selected !== currentSubject ? {
            background: selected === 'ortho' ? 'hsl(var(--primary))' : 'var(--c-amber)',
            color:      'hsl(var(--primary-foreground))',
            boxShadow:  selected === 'ortho'
              ? '0 8px 24px color-mix(in srgb, var(--c-primary) 30%, transparent)'
              : '0 8px 24px color-mix(in srgb, var(--c-amber) 30%, transparent)',
          } : {
            background: 'var(--c-card)',
            border:     '1px solid var(--c-border)',
            color:      'var(--c-muted)',
          }}
        >
          {selected === currentSubject
            ? 'Выбран текущий предмет'
            : `→ Переключиться на ${selected === 'ortho' ? 'Ортопедию' : 'Микробиологию'}`}
        </button>
      </motion.div>
    </motion.div>
  );
};

// ─── StatsTab ─────────────────────────────────────────────────────────────────
interface StatsTabProps {
  subject:         SubjectType;
  onSubjectChange: (s: SubjectType) => void;
}

export const StatsTab: React.FC<StatsTabProps> = ({ subject, onSubjectChange }) => {
  const isOrtho = subject === 'ortho';

  // Data sets per subject
  const questionsData = isOrtho ? orthoQuestionsData : microQuestionsData;
  const tasksData     = isOrtho ? orthoTasksData     : microTasksData;
  const testsData     = isOrtho ? orthoTestsData     : microTestsData;

  // localStorage keys per subject (separate progress!)
  const LS = {
    studied:     isOrtho ? 'studiedQuestions'    : 'microStudiedQuestions',
    tasks:       isOrtho ? 'resolvedTasks'        : 'microResolvedTasks',
    testScores:  isOrtho ? 'test_block_scores'    : 'micro_test_block_scores',
  };

  const [studiedCount,       setStudiedCount]       = useState(0);
  const [resolvedTasksCount, setResolvedTasksCount] = useState(0);
  const [testsResolvedCount, setTestsResolvedCount] = useState(0);
  const [theme,              setTheme]              = useState<Theme>('dark');
  const [showSubjectSheet,   setShowSubjectSheet]   = useState(false);

  const total = {
    q:  questionsData.length,
    t:  tasksData.length,
    ts: testsData.length,
  };

  // ── Theme ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const root = document.documentElement;
    if (root.classList.contains('bright'))     setTheme('bright');
    else if (root.classList.contains('dark'))  setTheme('dark');
    else                                        setTheme('light');
  }, []);

  const applyTheme = (t: Theme) => {
    const root = document.documentElement;
    root.classList.remove('dark', 'bright');
    if (t === 'dark')   root.classList.add('dark');
    if (t === 'bright') root.classList.add('dark', 'bright');
    localStorage.setItem('theme', t);
  };

  // ── Stats ────────────────────────────────────────────────────────────────
  const loadStats = () => {
    try { setStudiedCount(JSON.parse(localStorage.getItem(LS.studied) || '[]').length); }       catch { setStudiedCount(0); }
    try { setResolvedTasksCount(JSON.parse(localStorage.getItem(LS.tasks) || '[]').length); }   catch { setResolvedTasksCount(0); }
    try {
      const sc = JSON.parse(localStorage.getItem(LS.testScores) || '{}');
      setTestsResolvedCount(Math.min(
        Object.values(sc).reduce((a: number, b: any) => a + b, 0) as number,
        total.ts,
      ));
    } catch { setTestsResolvedCount(0); }
  };

  const resetAll = () => {
    if (!window.confirm('⚠️ Прогресс по этому предмету будет сброшен. Заметки останутся.')) return;
    [LS.studied, LS.tasks, LS.testScores].forEach(k => localStorage.removeItem(k));
    loadStats();
  };

  useEffect(() => {
    loadStats();
    const onVisible = () => { if (document.visibilityState === 'visible') loadStats(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject]);

  const pct = {
    q:  total.q  ? (studiedCount       / total.q)  * 100 : 0,
    t:  total.t  ? (resolvedTasksCount / total.t)  * 100 : 0,
    ts: total.ts ? (testsResolvedCount / total.ts) * 100 : 0,
  };
  const overall = (pct.q + pct.t + pct.ts) / 3;

  const accentColor    = isOrtho ? 'var(--c-primary)' : 'var(--c-amber)';
  const subjectLabel   = isOrtho ? 'Ортопедия'        : 'Микробиология';

  const stats = [
    { label: 'Вопросы', icon: <BookOpen     className="w-4 h-4" />, count: studiedCount,       tot: total.q,  p: pct.q,  barVar: 'hsl(210 70% 55%)' },
    { label: 'Задачи',  icon: <PenTool      className="w-4 h-4" />, count: resolvedTasksCount, tot: total.t,  p: pct.t,  barVar: accentColor },
    { label: 'Тесты',   icon: <ClipboardList className="w-4 h-4" />, count: testsResolvedCount, tot: total.ts, p: pct.ts, barVar: 'var(--c-amber)' },
  ];

  return (
    <>
      <div className="flex flex-col h-full overflow-x-hidden max-w-full" style={{ background: 'var(--c-bg)' }}>

        {/* Header */}
        <div
          className="px-4 py-3 sticky top-0 z-10"
          style={{
            background:           'color-mix(in srgb, var(--c-bg) 92%, transparent)',
            backdropFilter:       'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderBottom:         '1px solid var(--c-border)',
            paddingTop:           'var(--header-pt)',
          }}
        >
          <div className="flex justify-between items-center px-1">
            <div className="flex items-center gap-3">
              <ToothIcon className="w-9 h-9" style={{ color: accentColor }} variant={isOrtho ? 'perfect' : 'normal'} />
              <div>
                <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--c-text)' }}>OrthoByNekruz</h1>
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: accentColor }}>
                  {subjectLabel}
                </p>
              </div>
            </div>
            <button
              onClick={resetAll}
              className="p-2 rounded-xl transition-all active:scale-95"
              style={{
                background: 'hsl(var(--destructive) / 0.1)',
                border:     '1px solid hsl(var(--destructive) / 0.25)',
                color:      'hsl(var(--destructive))',
              }}
              title="Сбросить прогресс"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <ScrollArea className="flex-1 px-4 scroll-container">
          <div className="space-y-5 mx-auto max-w-2xl pt-4 overflow-hidden" style={{ paddingBottom: 'var(--scroll-pb)' }}>

            {/* Theme switcher */}
            <div className="rounded-2xl p-3" style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2.5 px-1" style={{ color: 'var(--c-muted)' }}>
                Тема оформления
              </p>
              <div className="grid grid-cols-3 gap-2">
                {THEMES.map(t => {
                  const active = theme === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => { setTheme(t.id); applyTheme(t.id); }}
                      className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl transition-all duration-200 active:scale-95"
                      style={active
                        ? { background: 'var(--c-primary-dim)', border: '1.5px solid var(--c-primary-br)' }
                        : { background: 'var(--c-bg)',          border: '1.5px solid var(--c-border)' }}
                    >
                      <span style={{ color: active ? 'var(--c-primary)' : 'var(--c-muted)' }}>{t.icon}</span>
                      <span className="text-[12px] font-bold" style={{ color: active ? 'var(--c-primary)' : 'var(--c-text)' }}>{t.label}</span>
                      <span className="text-[9px] font-mono uppercase tracking-widest" style={{ color: 'var(--c-muted)' }}>{t.desc}</span>
                      {active && <div className="w-1 h-1 rounded-full" style={{ background: 'var(--c-primary)' }} />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Donut */}
            <div className="flex flex-col items-center">
              <div className="h-56 w-full relative animate-in fade-in zoom-in-95 duration-700">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[{ v: overall }, { v: 100 - overall }]}
                      cx="50%" cy="50%" innerRadius={72} outerRadius={92}
                      paddingAngle={0} dataKey="v" startAngle={90} endAngle={-270}
                    >
                      <Cell fill={accentColor} stroke="none" />
                      <Cell fill="var(--c-border)" stroke="none" />
                      <Label
                        value={`${Math.round(overall)}%`}
                        position="center"
                        fill={accentColor}
                        style={{ fontSize: '26px', fontWeight: 700 }}
                      />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <span className="text-[10px] uppercase tracking-widest font-bold -mt-2" style={{ color: 'var(--c-muted)' }}>
                Общая готовность
              </span>
            </div>

            {/* Stat cards */}
            <div className="grid gap-3 px-1">
              {stats.map(s => (
                <div
                  key={s.label}
                  className="rounded-2xl overflow-hidden relative"
                  style={{ background: 'var(--c-card)', border: `1px solid color-mix(in srgb, ${s.barVar} 30%, transparent)` }}
                >
                  <div className="absolute top-0 left-0 w-[3px] h-full" style={{ background: s.barVar }} />
                  <div className="px-4 pt-3 pb-1 pl-5 flex justify-between items-end">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span style={{ color: s.barVar }}>{s.icon}</span>
                        <span className="text-sm font-semibold" style={{ color: s.barVar }}>{s.label}</span>
                      </div>
                      <div className="text-2xl font-bold" style={{ color: 'var(--c-text)' }}>
                        {s.count}
                        <span className="text-sm font-normal" style={{ color: 'var(--c-muted)' }}> / {s.tot}</span>
                      </div>
                      <p className="text-xs" style={{ color: 'var(--c-muted)' }}>
                        {s.label === 'Вопросы' ? 'изучено' : s.label === 'Задачи' ? 'решено' : 'правильно'}
                      </p>
                    </div>
                    <span className="text-lg font-bold" style={{ color: s.barVar }}>{Math.round(s.p)}%</span>
                  </div>
                  <div className="px-5 pb-3 pt-2">
                    <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: 'var(--c-border)' }}>
                      <div
                        className="h-full rounded-full transition-all duration-1000"
                        style={{ width: `${s.p}%`, background: s.barVar }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Goal */}
            <div
              className="p-5 mx-1 rounded-2xl flex items-center gap-4"
              style={{ background: 'var(--c-primary-glo)', border: '1px solid var(--c-primary-br)' }}
            >
              <div className="p-3 rounded-full flex-shrink-0" style={{ background: 'var(--c-primary-dim)' }}>
                <Star className="w-5 h-5" style={{ color: 'var(--c-primary)' }} />
              </div>
              <div>
                <h4 className="text-sm font-bold mb-0.5" style={{ color: 'var(--c-text)' }}>Ваша цель</h4>
                <p className="text-xs break-words" style={{ color: 'var(--c-muted)' }}>
                  Изучите все вопросы, решите задачи и пройдите тесты на 100%!
                </p>
              </div>
            </div>

            {/* ── CHANGE SUBJECT BUTTON ── */}
            <button
              onClick={() => setShowSubjectSheet(true)}
              className="w-full rounded-[20px] p-5 flex items-center gap-4 transition-all duration-200 active:scale-[0.98] mx-1"
              style={{
                background: isOrtho ? 'var(--c-primary-dim)' : 'var(--c-amber-dim)',
                border:     `1.5px solid ${isOrtho ? 'var(--c-primary-br)' : 'var(--c-amber-br)'}`,
              }}
            >
              {/* Icon */}
              <div
                className="w-11 h-11 rounded-[14px] flex items-center justify-center flex-shrink-0"
                style={{
                  background: isOrtho ? 'var(--c-primary-dim)' : 'var(--c-amber-dim)',
                  border:     `1px solid ${isOrtho ? 'var(--c-primary-br)' : 'var(--c-amber-br)'}`,
                }}
              >
                {/* Swap icon */}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                  stroke={accentColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 3H5a2 2 0 0 0-2 2v3"/>
                  <path d="M21 8V5a2 2 0 0 0-2-2h-3"/>
                  <path d="M3 16v3a2 2 0 0 0 2 2h3"/>
                  <path d="M16 21h3a2 2 0 0 0 2-2v-3"/>
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M12 9v6M9 12h6"/>
                </svg>
              </div>

              <div className="flex-1 text-left">
                <div className="text-sm font-bold" style={{ color: 'var(--c-text)' }}>Сменить предмет</div>
                <div className="text-[11px] mt-0.5" style={{ color: 'var(--c-muted)' }}>
                  Сейчас: {subjectLabel}
                </div>
              </div>

              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke={accentColor} strokeWidth="2" strokeLinecap="round">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </button>

          </div>
        </ScrollArea>
      </div>

      {/* Subject bottom sheet */}
      <AnimatePresence>
        {showSubjectSheet && (
          <SubjectSheet
            currentSubject={subject}
            onSelect={s => { onSubjectChange(s); setShowSubjectSheet(false); }}
            onClose={() => setShowSubjectSheet(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
};
