"use client";

import React, { useState, useEffect } from 'react';
import questionsData from '@/data/questions.json';
import tasksData from '@/data/tasks.json';
import testsData from '@/data/tests.json';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PieChart, Pie, Cell, ResponsiveContainer, Label } from 'recharts';
import { BookOpen, ClipboardList, PenTool, Star, Trash2, Sun, Moon, Sparkles } from 'lucide-react';
import { ToothIcon } from './ToothIcon';

type Theme = 'dark' | 'light' | 'bright';

const THEMES: { id: Theme; label: string; desc: string; icon: React.ReactNode }[] = [
  { id: 'dark',   label: 'Тёмная',  desc: 'Для ночи',  icon: <Moon     className="w-5 h-5" /> },
  { id: 'light',  label: 'Светлая', desc: 'Бумага',    icon: <Sun      className="w-5 h-5" /> },
  { id: 'bright', label: 'Яркая',   desc: 'Контраст',  icon: <Sparkles className="w-5 h-5" /> },
];

export const StatsTab = () => {
  const [studiedCount,       setStudiedCount]       = useState(0);
  const [resolvedTasksCount, setResolvedTasksCount] = useState(0);
  const [testsResolvedCount, setTestsResolvedCount] = useState(0);

  const total = { q: questionsData.length, t: tasksData.length, ts: testsData.length };

  // ── ТЕМА ────────────────────────────────────────────
  // Читаем текущую тему из классов <html> — это безопасно при SSR,
  // потому что layout.tsx уже выставил правильные классы до рендера.
  // useEffect на монтирование НАМЕРЕННО убран — он перетирал тему через SSR-баг
  // (сервер не знает localStorage → всегда 'dark' → гидрация ломала тему).
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    // Читаем тему из <html> классов — они уже правильные после inline-скрипта
    const root = document.documentElement;
    if (root.classList.contains('bright')) setTheme('bright');
    else if (root.classList.contains('dark')) setTheme('dark');
    else setTheme('light');
  }, []); // только при монтировании — для синхронизации UI кнопок

  const applyTheme = (t: Theme) => {
    const root = document.documentElement;
    root.classList.remove('dark', 'bright');
    if (t === 'dark')   root.classList.add('dark');
    if (t === 'bright') root.classList.add('dark', 'bright');
    localStorage.setItem('theme', t);
  };

  const handleThemeChange = (t: Theme) => {
    setTheme(t);
    applyTheme(t);
  };
  // ────────────────────────────────────────────────────

  const loadStats = () => {
    try { setStudiedCount(JSON.parse(localStorage.getItem('studiedQuestions') || '[]').length); } catch { setStudiedCount(0); }
    try { setResolvedTasksCount(JSON.parse(localStorage.getItem('resolvedTasks') || '[]').length); } catch { setResolvedTasksCount(0); }
    try {
      const sc = JSON.parse(localStorage.getItem('test_block_scores') || '{}');
      setTestsResolvedCount(Math.min(Object.values(sc).reduce((a: number, b: any) => a + b, 0) as number, total.ts));
    } catch { setTestsResolvedCount(0); }
  };

  const resetAll = () => {
    if (!window.confirm('⚠️ Весь прогресс будет сброшен. Заметки останутся.')) return;
    ['studiedQuestions', 'resolvedTasks', 'test_block_scores'].forEach(k => localStorage.removeItem(k));
    loadStats();
  };

  useEffect(() => {
    loadStats();
    const onVisible = () => { if (document.visibilityState === 'visible') loadStats(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const pct = {
    q:   total.q  ? (studiedCount       / total.q)  * 100 : 0,
    t:   total.t  ? (resolvedTasksCount / total.t)  * 100 : 0,
    ts:  total.ts ? (testsResolvedCount / total.ts) * 100 : 0,
  };
  const overall = (pct.q + pct.t + pct.ts) / 3;

  const stats = [
    { label: 'Вопросы', icon: <BookOpen    className="w-4 h-4" />, count: studiedCount,       tot: total.q,  p: pct.q,  borderVar: 'hsl(210 70% 55%)',       barVar: 'hsl(210 70% 55%)' },
    { label: 'Задачи',  icon: <PenTool     className="w-4 h-4" />, count: resolvedTasksCount, tot: total.t,  p: pct.t,  borderVar: 'var(--c-primary-br)',     barVar: 'var(--c-primary)' },
    { label: 'Тесты',   icon: <ClipboardList className="w-4 h-4" />, count: testsResolvedCount, tot: total.ts, p: pct.ts, borderVar: 'var(--c-amber-br)',      barVar: 'var(--c-amber)' },
  ];

  return (
    <div className="flex flex-col h-full overflow-x-hidden max-w-full" style={{ background: 'var(--c-bg)' }}>

      {/* ── ШАПКА ─────────────────────────────────── */}
      <div className="px-4 py-3 sticky top-0 z-10"
        style={{ background: 'color-mix(in srgb, var(--c-bg) 92%, transparent)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderBottom: '1px solid var(--c-border)', paddingTop: 'var(--header-pt)' }}>
        <div className="flex justify-between items-center px-1">
          <div className="flex items-center gap-3">
            <ToothIcon className="w-9 h-9 text-primary" />
            <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--c-text)' }}>OrthoByNekruz</h1>
          </div>
          <button onClick={resetAll} className="p-2 rounded-xl transition-all active:scale-95"
            style={{ background: 'hsl(var(--destructive) / 0.1)', border: '1px solid hsl(var(--destructive) / 0.25)', color: 'hsl(var(--destructive))' }}
            title="Сбросить прогресс"><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>

      <ScrollArea className="flex-1 px-4 scroll-container">
        <div className="space-y-5 mx-auto max-w-2xl pt-4 overflow-hidden" style={{ paddingBottom: 'var(--scroll-pb)' }}>

          {/* ── ПЕРЕКЛЮЧАТЕЛЬ ТЕМ ───────────────────── */}
          <div className="rounded-2xl p-3" style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2.5 px-1" style={{ color: 'var(--c-muted)' }}>
              Тема оформления
            </p>
            <div className="grid grid-cols-3 gap-2">
              {THEMES.map(t => {
                const active = theme === t.id;
                return (
                  <button key={t.id} onClick={() => handleThemeChange(t.id)}
                    className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl transition-all duration-200 active:scale-95"
                    style={active
                      ? { background: 'var(--c-primary-dim)', border: '1.5px solid var(--c-primary-br)' }
                      : { background: 'var(--c-bg)',           border: '1.5px solid var(--c-border)' }}>
                    <span style={{ color: active ? 'var(--c-primary)' : 'var(--c-muted)' }}>{t.icon}</span>
                    <span className="text-[12px] font-bold" style={{ color: active ? 'var(--c-primary)' : 'var(--c-text)' }}>{t.label}</span>
                    <span className="text-[9px] font-mono uppercase tracking-widest" style={{ color: 'var(--c-muted)' }}>{t.desc}</span>
                    {active && <div className="w-1 h-1 rounded-full" style={{ background: 'var(--c-primary)' }} />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── DONUT ДИАГРАММА ──────────────────────── */}
          <div className="flex flex-col items-center">
            <div className="h-56 w-full relative animate-in fade-in zoom-in-95 duration-700">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={[{ v: overall }, { v: 100 - overall }]} cx="50%" cy="50%" innerRadius={72} outerRadius={92} paddingAngle={0} dataKey="v" startAngle={90} endAngle={-270}>
                    <Cell fill="var(--c-primary)" stroke="none" />
                    <Cell fill="var(--c-border)"  stroke="none" />
                    <Label value={`${Math.round(overall)}%`} position="center" fill="var(--c-primary)" style={{ fontSize: '26px', fontWeight: 700 }} />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <span className="text-[10px] uppercase tracking-widest font-bold -mt-2" style={{ color: 'var(--c-muted)' }}>Общая готовность</span>
          </div>

          {/* ── КАРТОЧКИ ──────────────────────────────── */}
          <div className="grid gap-3 px-1">
            {stats.map(s => (
              <div key={s.label} className="rounded-2xl overflow-hidden relative" style={{ background: 'var(--c-card)', border: `1px solid ${s.borderVar}` }}>
                <div className="absolute top-0 left-0 w-[3px] h-full" style={{ background: s.barVar }} />
                <div className="px-4 pt-3 pb-1 pl-5 flex justify-between items-end">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span style={{ color: s.barVar }}>{s.icon}</span>
                      <span className="text-sm font-semibold" style={{ color: s.barVar }}>{s.label}</span>
                    </div>
                    <div className="text-2xl font-bold" style={{ color: 'var(--c-text)' }}>
                      {s.count}<span className="text-sm font-normal" style={{ color: 'var(--c-muted)' }}> / {s.tot}</span>
                    </div>
                    <p className="text-xs" style={{ color: 'var(--c-muted)' }}>
                      {s.label === 'Вопросы' ? 'изучено' : s.label === 'Задачи' ? 'решено' : 'правильно'}
                    </p>
                  </div>
                  <span className="text-lg font-bold" style={{ color: s.barVar }}>{Math.round(s.p)}%</span>
                </div>
                <div className="px-5 pb-3 pt-2">
                  <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: 'var(--c-border)' }}>
                    <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${s.p}%`, background: s.barVar }} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ── ЦЕЛЬ ─────────────────────────────────── */}
          <div className="p-5 mx-1 rounded-2xl flex items-center gap-4" style={{ background: 'var(--c-primary-glo)', border: '1px solid var(--c-primary-br)' }}>
            <div className="p-3 rounded-full flex-shrink-0" style={{ background: 'var(--c-primary-dim)' }}>
              <Star className="w-5 h-5" style={{ color: 'var(--c-primary)' }} />
            </div>
            <div>
              <h4 className="text-sm font-bold mb-0.5" style={{ color: 'var(--c-text)' }}>Ваша цель</h4>
              <p className="text-xs break-words" style={{ color: 'var(--c-muted)' }}>
                Изучите все вопросы, решите задачи и пройдите тесты на 100%, чтобы достичь полной готовности!
              </p>
            </div>
          </div>

        </div>
      </ScrollArea>
    </div>
  );
};
