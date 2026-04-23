"use client";

import React, { useState, useEffect } from 'react';
import { AuthScreen } from '@/components/AuthScreen';
import { Navigation, TabType } from '@/components/Navigation';
import { QuestionsTab } from '@/components/QuestionsTab';
import { TestsTab } from '@/components/TestsTab';
import { TasksTab } from '@/components/TasksTab';
import { StatsTab } from '@/components/StatsTab';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<TabType>('questions');

  useEffect(() => {
    const storedAuthed = localStorage.getItem('is_authed') === 'true';

    if (storedAuthed) {
      // Проверяем, что сохранённый Telegram ID совпадает с текущим (если он есть)
      const storedTgId = localStorage.getItem('user_tg_id');
      const tg = (window as any).Telegram?.WebApp;
      const currentTgId = tg?.initDataUnsafe?.user?.id;

      // Если текущий ID определён и не совпадает — сбрасываем сессию
      if (currentTgId && storedTgId && String(currentTgId) !== storedTgId) {
        localStorage.removeItem('is_authed');
        localStorage.removeItem('user_tg_id');
        localStorage.removeItem('welcome_seen');
        setIsAuthenticated(false);
      } else {
        // ID совпадает, либо текущий ID неизвестен (вне WebApp) — разрешаем вход
        setIsAuthenticated(true);
      }
    } else {
      setIsAuthenticated(false);
    }

    // Инициализация Telegram Mini App (не влияет на авторизацию)
    if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
      const tg = (window as any).Telegram.WebApp;
      tg.ready();
      tg.expand();
      tg.setHeaderColor('#0B0E14');
      tg.setBackgroundColor('#0B0E14');
    }

    setIsLoading(false);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0B0E14]">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthScreen onAuthenticated={() => setIsAuthenticated(true)} />;
  }

  // Основной интерфейс (явная кнопка выхода удалена – скрытый сброс в AuthScreen)
  return (
    <main className="flex flex-col h-full w-full relative overflow-hidden animate-in fade-in duration-1000">
      <div className="flex-1 overflow-hidden relative">
        {activeTab === 'questions' && <QuestionsTab />}
        {activeTab === 'tests' && <TestsTab />}
        {activeTab === 'tasks' && <TasksTab />}
        {activeTab === 'stats' && <StatsTab />}
      </div>
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
    </main>
  );
}