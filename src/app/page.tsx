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
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('questions');

  useEffect(() => {
    // Check local storage for auth state
    const authed = localStorage.getItem('is_authed') === 'true';
    setIsAuthenticated(authed);
    
    // Telegram Mini App Initialization
    if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
      const tg = (window as any).Telegram.WebApp;
      tg.ready();
      tg.expand();
      
      // Sync theme colors with app background (#0B0E14)
      tg.setHeaderColor('#0B0E14');
      tg.setBackgroundColor('#0B0E14');
    }
  }, []);

  if (isAuthenticated === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthScreen onAuthenticated={() => setIsAuthenticated(true)} />;
  }

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
