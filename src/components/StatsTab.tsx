"use client";

import React, { useState, useEffect, useMemo } from 'react';
import questionsData from '@/data/questions.json';
import tasksData from '@/data/tasks.json';
import testsData from '@/data/tests.json';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PieChart, Pie, Cell, ResponsiveContainer, Label } from 'recharts';
import { BookOpen, CheckCircle2, ClipboardList, PenTool, BarChart3, Star } from 'lucide-react';
import { ToothIcon } from './ToothIcon';
import { cn } from '@/lib/utils';

export const StatsTab = () => {
  const [stats, setStats] = useState({
    studiedQuestions: 0,
    resolvedTasks: 0,
    testScores: {} as Record<number, number>
  });

  useEffect(() => {
    const questions = JSON.parse(localStorage.getItem('studiedQuestions') || '[]');
    const tasks = JSON.parse(localStorage.getItem('resolvedTasks') || '[]');
    const tests = JSON.parse(localStorage.getItem('test_block_scores') || '{}');
    
    setStats({
      studiedQuestions: questions.length,
      resolvedTasks: tasks.length,
      testScores: tests
    });
  }, []);

  const qProgress = (stats.studiedQuestions / questionsData.length) * 100;
  const tProgress = (stats.resolvedTasks / tasksData.length) * 100;
  
  const testBlocksCount = Object.keys(stats.testScores).length;
  const avgTestScore = testBlocksCount > 0 
    ? (Object.values(stats.testScores).reduce((a, b) => a + b, 0) / (testBlocksCount * 20)) * 100 
    : 0;

  const totalPossible = questionsData.length + tasksData.length;
  const totalDone = stats.studiedQuestions + stats.resolvedTasks;
  const totalOverallProgress = (totalDone / totalPossible) * 100;

  const chartData = [
    { name: 'Готово', value: totalOverallProgress },
    { name: 'Осталось', value: 100 - totalOverallProgress },
  ];

  const COLORS = ['#4D9FFF', 'rgba(255, 255, 255, 0.05)'];

  return (
    <div className="flex flex-col h-full bg-background pb-32 overflow-x-hidden max-w-full">
      <div className="p-4 border-b border-white/5 bg-background/50 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3 px-2">
          <ToothIcon className="w-10 h-10 text-primary" />
          <h1 className="text-2xl font-bold font-headline tracking-tight text-foreground">OrthoByNekruz</h1>
        </div>
      </div>

      <ScrollArea className="flex-1 px-4">
        <div className="space-y-6 mx-auto max-w-2xl pt-4 overflow-hidden">
          {/* Main Progress Ring */}
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
                    value={`${Math.round(totalOverallProgress)}%`} 
                    position="center" 
                    fill="white" 
                    className="text-4xl font-bold font-headline"
                  />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute bottom-4 left-0 right-0 text-center">
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Общая готовность</span>
            </div>
          </div>

          <div className="grid gap-4 px-2">
            {/* Questions Card */}
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
                    <div className="text-2xl font-bold">{stats.studiedQuestions} <span className="text-sm font-normal text-muted-foreground">/ {questionsData.length}</span></div>
                    <p className="text-xs text-muted-foreground">Изучено разделов</p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-blue-400">{Math.round(qProgress)}%</span>
                  </div>
                </div>
                <div className="mt-3 h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${qProgress}%` }} />
                </div>
              </CardContent>
            </Card>

            {/* Tasks Card */}
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
                    <div className="text-2xl font-bold">{stats.resolvedTasks} <span className="text-sm font-normal text-muted-foreground">/ {tasksData.length}</span></div>
                    <p className="text-xs text-muted-foreground">Решено клинических случаев</p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-emerald-400">{Math.round(tProgress)}%</span>
                  </div>
                </div>
                <div className="mt-3 h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${tProgress}%` }} />
                </div>
              </CardContent>
            </Card>

            {/* Tests Card */}
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
                    <div className="text-2xl font-bold">{testBlocksCount} <span className="text-sm font-normal text-muted-foreground">блоков начато</span></div>
                    <p className="text-xs text-muted-foreground">Средний результат</p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-amber-400">{Math.round(avgTestScore)}%</span>
                  </div>
                </div>
                <div className="mt-3 h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 transition-all duration-1000" style={{ width: `${avgTestScore}%` }} />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="p-6 mx-2 rounded-2xl bg-primary/5 border border-primary/10 flex items-center gap-4 animate-pulse">
            <div className="p-3 rounded-full bg-primary/10">
              <Star className="w-6 h-6 text-primary" />
            </div>
            <div className="overflow-hidden">
              <h4 className="text-sm font-bold text-foreground">Ваша цель</h4>
              <p className="text-xs text-muted-foreground break-words">Изучите все вопросы и задачи, чтобы достичь 100% готовности!</p>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};