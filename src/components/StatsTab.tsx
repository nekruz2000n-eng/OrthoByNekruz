"use client";

import React, { useState, useEffect } from 'react';
import questionsData from '@/data/questions.json';
import tasksData from '@/data/tasks.json';
import testsData from '@/data/tests.json';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PieChart, Pie, Cell, ResponsiveContainer, Label } from 'recharts';
import { BookOpen, ClipboardList, PenTool, Star, Trash2, Sun, Moon } from 'lucide-react';
import { ToothIcon } from './ToothIcon';
import { Button } from '@/components/ui/button';

export const StatsTab = () => {
  const [studiedCount, setStudiedCount] = useState(0);
  const [resolvedTasksCount, setResolvedTasksCount] = useState(0);
  const [testsResolvedCount, setTestsResolvedCount] = useState(0);

  const totalQuestions = questionsData.length;
  const totalTasks = tasksData.length;
  const totalTests = testsData.length;

  // ----- состояние темы -----
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('theme') !== 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);
  // ---------------------------

  const loadStats = () => {
    // Вопросы
    const studied = localStorage.getItem('studiedQuestions');
    if (studied) {
      try {
        const arr = JSON.parse(studied);
        setStudiedCount(arr.length);
      } catch (e) {}
    } else {
      setStudiedCount(0);
    }
    // Задачи
    const resolved = localStorage.getItem('resolvedTasks');
    if (resolved) {
      try {
        const arr = JSON.parse(resolved);
        setResolvedTasksCount(arr.length);
      } catch (e) {}
    } else {
      setResolvedTasksCount(0);
    }
    // Тесты
    const scores = localStorage.getItem('test_block_scores');
    if (scores) {
      try {
        const blockScores = JSON.parse(scores);
        let sum = 0;
        for (let key in blockScores) {
          sum += blockScores[key];
        }
        setTestsResolvedCount(Math.min(sum, totalTests));
      } catch (e) {}
    } else {
      setTestsResolvedCount(0);
    }
  };

  const resetAllProgress = () => {
    const confirmed = window.confirm('⚠️ Вы уверены? Весь прогресс (вопросы, задачи, тесты) будет сброшен. Заметки останутся.');
    if (!confirmed) return;

    localStorage.removeItem('studiedQuestions');
    localStorage.removeItem('resolvedTasks');
    localStorage.removeItem('test_block_scores');
    loadStats();
  };

  useEffect(() => {
    loadStats();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') loadStats();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const questionsPercent = totalQuestions === 0 ? 0 : (studiedCount / totalQuestions) * 100;
  const tasksPercent = totalTasks === 0 ? 0 : (resolvedTasksCount / totalTasks) * 100;
  const testsPercent = totalTests === 0 ? 0 : (testsResolvedCount / totalTests) * 100;
  const overallPercent = (questionsPercent + tasksPercent + testsPercent) / 3;

  const chartData = [
    { name: 'Готово', value: overallPercent },
    { name: 'Осталось', value: 100 - overallPercent },
  ];
  const COLORS = ['#4D9FFF', 'rgba(255, 255, 255, 0.05)'];

  return (
    <div className="flex flex-col h-full bg-background pb-0 overflow-x-hidden max-w-full">
      {/* Верхняя панель с заголовком и кнопками */}
      <div className="p-4 border-b border-white/5 bg-background/50 backdrop-blur-md sticky top-0 z-10">
        <div className="flex justify-between items-center px-2">
          <div className="flex items-center gap-3">
            <ToothIcon className="w-10 h-10 text-primary" />
            <h1 className="text-2xl font-bold font-headline tracking-tight text-foreground">OrthoByNekruz</h1>
          </div>
          <div className="flex items-center gap-2">
            {/* Кнопка сброса прогресса */}
            
            {/* Переключатель темы */}
            <Button
  variant="outline"
  size="sm"
  onClick={() => setIsDark(prev => !prev)}
  className="gap-2 border-primary/30 text-primary hover:bg-primary/10"
>
  {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
  {isDark ? 'Светлая' : 'Тёмная'}
</Button>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 px-4">
        <div className="space-y-6 mx-auto max-w-2xl pt-4 pb-32 overflow-hidden">
          {/* Круговая диаграмма */}
          <div className="flex flex-col items-center">
            <div className="h-64 w-full relative animate-in fade-in zoom-in-95 duration-700">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={100}
                    paddingAngle={0}
                    dataKey="value"
                    startAngle={90}
                    endAngle={-270}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index]} stroke="none" />
                    ))}
                    <Label 
                      value={`${Math.round(overallPercent)}%`} 
                      position="center" 
                      fill="currentColor" 
                      className="text-4xl font-bold font-headline"
                    />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            <div className="absolute top-0 right-0 z-10">
    <Button
      variant="outline"
      size="sm"
      onClick={resetAllProgress}
      className="gap-2 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
    >
      <Trash2 className="w-4 h-4" />
      Сброс
    </Button>
  </div>

            </div>
            <div className="text-center mt-4">
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                Общая готовность
              </span>
            </div>
          </div>

          {/* Карточки со статистикой */}
          <div className="grid gap-4 px-2">
            {/* Вопросы */}
            <Card className="glass-card border-none overflow-hidden relative group max-w-full">
              <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2 text-blue-400">
                  <BookOpen className="w-4 h-4" />
                  Вопросы
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-end">
                  <div className="space-y-1">
                    <div className="text-2xl font-bold">{studiedCount} <span className="text-sm font-normal text-muted-foreground">/ {totalQuestions}</span></div>
                    <p className="text-xs text-muted-foreground">изучено</p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-blue-400">{Math.round(questionsPercent)}%</span>
                  </div>
                </div>
                <div className="mt-3 h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${questionsPercent}%` }} />
                </div>
              </CardContent>
            </Card>

            {/* Задачи */}
            <Card className="glass-card border-none overflow-hidden relative group max-w-full">
              <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2 text-emerald-400">
                  <PenTool className="w-4 h-4" />
                  Задачи
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-end">
                  <div className="space-y-1">
                    <div className="text-2xl font-bold">{resolvedTasksCount} <span className="text-sm font-normal text-muted-foreground">/ {totalTasks}</span></div>
                    <p className="text-xs text-muted-foreground">решено</p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-emerald-400">{Math.round(tasksPercent)}%</span>
                  </div>
                </div>
                <div className="mt-3 h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${tasksPercent}%` }} />
                </div>
              </CardContent>
            </Card>

            {/* Тесты */}
            <Card className="glass-card border-none overflow-hidden relative group max-w-full">
              <div className="absolute top-0 left-0 w-1 h-full bg-amber-500" />
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2 text-amber-400">
                  <ClipboardList className="w-4 h-4" />
                  Тесты
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-end">
                  <div className="space-y-1">
                    <div className="text-2xl font-bold">{testsResolvedCount} <span className="text-sm font-normal text-muted-foreground">/ {totalTests}</span></div>
                    <p className="text-xs text-muted-foreground">правильно решено</p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-amber-400">{Math.round(testsPercent)}%</span>
                  </div>
                </div>
                <div className="mt-3 h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 transition-all duration-1000" style={{ width: `${testsPercent}%` }} />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="p-6 mx-2 rounded-2xl bg-primary/5 border border-primary/10 flex items-center gap-4">
            <div className="p-3 rounded-full bg-primary/10">
              <Star className="w-6 h-6 text-primary" />
            </div>
            <div className="overflow-hidden">
              <h4 className="text-sm font-bold text-foreground">Ваша цель</h4>
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