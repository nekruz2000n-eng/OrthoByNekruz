"use client";

import React, { useState, useEffect } from 'react';
import questionsData from '@/data/questions.json';
import tasksData from '@/data/tasks.json';
import testsData from '@/data/tests.json';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PieChart, Pie, Cell, ResponsiveContainer, Label } from 'recharts';
import { BookOpen, ClipboardList, PenTool, Star, Trash2, Sun, Moon, Sparkles } from 'lucide-react';
import { ToothIcon } from './ToothIcon';
import { cn } from '@/lib/utils';

type Theme = 'dark' | 'light' | 'bright';

const THEMES: { id: Theme; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: 'dark',   label: 'Тёмная',  icon: <Moon className="w-4 h-4" />,     desc: 'Для ночи'  },
  { id: 'light',  label: 'Светлая', icon: <Sun className="w-4 h-4" />,      desc: 'Классика'  },
  { id: 'bright', label: 'Яркая',   icon: <Sparkles className="w-4 h-4" />, desc: 'Контраст'  },
];

export const StatsTab = () => {
  const [studiedCount, setStudiedCount] = useState(0);
  const [resolvedTasksCount, setResolvedTasksCount] = useState(0);
  const [testsResolvedCount, setTestsResolvedCount] = useState(0);

  const totalQuestions = questionsData.length;
  const totalTasks     = tasksData.length;
  const totalTests     = testsData.length;

  // ── ТЕМА ────────────────────────────────────────────────
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'dark';
    return (localStorage.getItem('theme') as Theme) || 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark', 'bright');
    if (theme === 'dark')   root.classList.add('dark');
    if (theme === 'bright') root.classList.add('dark', 'bright');
    localStorage.setItem('theme', theme);
  }, [theme]);
  // ────────────────────────────────────────────────────────

  const loadStats = () => {
    try { setStudiedCount(JSON.parse(localStorage.getItem('studiedQuestions') || '[]').length); } catch { setStudiedCount(0); }
    try { setResolvedTasksCount(JSON.parse(localStorage.getItem('resolvedTasks') || '[]').length); } catch { setResolvedTasksCount(0); }
    try {
      const scores = JSON.parse(localStorage.getItem('test_block_scores') || '{}');
      setTestsResolvedCount(Math.min(Object.values(scores).reduce((a: number, b: any) => a + b, 0) as number, totalTests));
    } catch { setTestsResolvedCount(0); }
  };

  const resetAllProgress = () => {
    if (!window.confirm('⚠️ Весь прогресс будет сброшен. Заметки останутся.')) return;
    localStorage.removeItem('studiedQuestions');
    localStorage.removeItem('resolvedTasks');
    localStorage.removeItem('test_block_scores');
    loadStats();
  };

  useEffect(() => {
    loadStats();
    const onVisible = () => { if (document.visibilityState === 'visible') loadStats(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const questionsPercent = totalQuestions ? (studiedCount / totalQuestions) * 100 : 0;
  const tasksPercent     = totalTasks     ? (resolvedTasksCount / totalTasks) * 100 : 0;
  const testsPercent     = totalTests     ? (testsResolvedCount / totalTests) * 100 : 0;
  const overallPercent   = (questionsPercent + tasksPercent + testsPercent) / 3;

  const chartData = [
    { name: 'Готово',   value: overallPercent },
    { name: 'Осталось', value: 100 - overallPercent },
  ];

  const barColors = {
    questions: 'hsl(210 80% 55%)',
    tasks:     'hsl(142 70% 45%)',
    tests:     'hsl(38 92% 50%)',
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-x-hidden max-w-full">

      {/* ── ШАПКА ───────────────────────────────────── */}
      <div
        className="p-4 sticky top-0 z-10"
        style={{
          background: 'hsl(var(--background) / 0.9)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid hsl(var(--border))',
          paddingTop: 'var(--header-pt)',
        }}
      >
        <div className="flex justify-between items-center px-1">
          <div className="flex items-center gap-3">
            <ToothIcon className="w-9 h-9 text-primary" />
            <h1 className="text-xl font-bold tracking-tight text-foreground">OrthoByNekruz</h1>
          </div>
          <button
            onClick={resetAllProgress}
            className="p-2 rounded-xl transition-all active:scale-95"
            style={{ background: 'hsl(0 70% 10%)', border: '1px solid hsl(0 60% 22%)', color: 'hsl(0 72% 55%)' }}
            title="Сбросить прогресс"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <ScrollArea className="flex-1 px-4">
        <div className="space-y-5 mx-auto max-w-2xl pt-4 pb-32 overflow-hidden">

          {/* ── ПЕРЕКЛЮЧАТЕЛЬ ТЕМ ───────────────────── */}
          <div
            className="rounded-2xl p-3"
            style={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
            }}
          >
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2.5 px-1 text-muted-foreground">
              Тема оформления
            </p>
            <div className="grid grid-cols-3 gap-2">
              {THEMES.map((t) => {
                const active = theme === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    className="flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl transition-all duration-200 active:scale-95"
                    style={active ? {
                      background: 'hsl(142 70% 45% / 0.15)',
                      border: '1.5px solid hsl(142 70% 45% / 0.45)',
                    } : {
                      background: 'hsl(var(--background))',
                      border: '1.5px solid hsl(var(--border))',
                    }}
                  >
                    <span style={{ color: active ? 'hsl(142 70% 55%)' : 'hsl(var(--muted-foreground))' }}>
                      {t.icon}
                    </span>
                    <span
                      className="text-[12px] font-bold"
                      style={{ color: active ? 'hsl(142 70% 60%)' : 'hsl(var(--foreground))' }}
                    >
                      {t.label}
                    </span>
                    <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
                      {t.desc}
                    </span>
                    {active && (
                      <div className="w-1 h-1 rounded-full" style={{ background: 'hsl(142 70% 52%)' }} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── ДОNUT-ДИАГРАММА ──────────────────────── */}
          <div className="flex flex-col items-center">
            <div className="h-56 w-full relative animate-in fade-in zoom-in-95 duration-700">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%" cy="50%"
                    innerRadius={72} outerRadius={92}
                    paddingAngle={0}
                    dataKey="value"
                    startAngle={90} endAngle={-270}
                  >
                    <Cell fill="hsl(142 70% 45%)" stroke="none" />
                    <Cell fill="hsl(142 28% 12%)"  stroke="none" />
                    <Label
                      value={`${Math.round(overallPercent)}%`}
                      position="center"
                      fill="hsl(142 70% 50%)"
                      style={{ fontSize: '28px', fontWeight: 700 }}
                    />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <span className="text-[10px] uppercase tracking-widest font-bold -mt-2 text-muted-foreground">
              Общая готовность
            </span>
          </div>

          {/* ── КАРТОЧКИ ──────────────────────────────── */}
          <div className="grid gap-3 px-1">
            {(
              [
                { label: 'Вопросы',   icon: <BookOpen   className="w-4 h-4" />, count: studiedCount,       total: totalQuestions, pct: questionsPercent, color: barColors.questions, border: 'hsl(210 40% 20%)' },
                { label: 'Задачи',    icon: <PenTool    className="w-4 h-4" />, count: resolvedTasksCount, total: totalTasks,     pct: tasksPercent,     color: barColors.tasks,     border: 'hsl(142 28% 16%)' },
                { label: 'Тесты',     icon: <ClipboardList className="w-4 h-4" />, count: testsResolvedCount, total: totalTests,  pct: testsPercent,     color: barColors.tests,     border: 'hsl(38 30% 18%)'  },
              ] as const
            ).map((item) => (
              <div
                key={item.label}
                className="rounded-2xl overflow-hidden relative"
                style={{ background: 'hsl(var(--card))', border: `1px solid ${item.border}` }}
              >
                <div className="absolute top-0 left-0 w-[3px] h-full" style={{ background: item.color }} />
                <div className="px-4 pt-3 pb-1 pl-5 flex justify-between items-end">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span style={{ color: item.color }}>{item.icon}</span>
                      <span className="text-sm font-semibold" style={{ color: item.color }}>{item.label}</span>
                    </div>
                    <div className="text-2xl font-bold text-foreground">
                      {item.count}
                      <span className="text-sm font-normal text-muted-foreground"> / {item.total}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {item.label === 'Вопросы' ? 'изучено' : item.label === 'Задачи' ? 'решено' : 'правильно'}
                    </p>
                  </div>
                  <span className="text-lg font-bold" style={{ color: item.color }}>
                    {Math.round(item.pct)}%
                  </span>
                </div>
                <div className="px-5 pb-3 pt-2">
                  <div className="h-1.5 w-full rounded-full overflow-hidden bg-white/5">
                    <div
                      className="h-full rounded-full transition-all duration-1000"
                      style={{ width: `${item.pct}%`, background: item.color }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ── ЦЕЛЬ ─────────────────────────────────── */}
          <div
            className="p-5 mx-1 rounded-2xl flex items-center gap-4"
            style={{ background: 'hsl(142 70% 45% / 0.06)', border: '1px solid hsl(142 70% 45% / 0.18)' }}
          >
            <div className="p-3 rounded-full flex-shrink-0" style={{ background: 'hsl(142 70% 45% / 0.12)' }}>
              <Star className="w-5 h-5" style={{ color: 'hsl(142 70% 52%)' }} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-foreground mb-0.5">Ваша цель</h4>
              <p className="text-xs text-muted-foreground break-words">
                Изучите все вопросы, решите задачи и пройдите тесты на 100%, чтобы достичь полной готовности!
              </p>
            </div>
          </div>

        </div>
      </ScrollArea>
    </div>
  );
};
