"use client";

// Подключаем необходимые зависимости и компоненты
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AuthScreen } from '@/components/AuthScreen';          // Экран ввода ключа
import { Navigation, TabType } from '@/components/Navigation';  // Нижняя панель навигации
import { QuestionsTab } from '@/components/QuestionsTab';      // Вкладка "Вопросы"
import { TestsTab } from '@/components/TestsTab';              // Вкладка "Тесты"
import { TasksTab } from '@/components/TasksTab';              // Вкладка "Задачи"
import { StatsTab } from '@/components/StatsTab';              // Вкладка "Статистика"
import { Loader2 } from 'lucide-react';                       // Иконка загрузки
import { useToast } from '@/hooks/use-toast';                 // Хук для показа уведомлений

export default function Home() {
  // ======================= СОСТОЯНИЯ =======================
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false); // Авторизован ли пользователь
  const [isLoading, setIsLoading] = useState<boolean>(true);               // Идёт ли первоначальная загрузка
  const [activeTab, setActiveTab] = useState<TabType>('questions');        // Активная вкладка
  const { toast } = useToast();                                            // Функция для показа тостов

  // ======== СКРЫТЫЙ СБРОС СЕССИИ (долгое нажатие 8 секунд в правом верхнем углу) ========
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Начинаем отсчёт при нажатии
  const handleLongPressStart = useCallback(() => {
    longPressTimerRef.current = setTimeout(() => {
      // Удаляем все данные авторизации и демо из localStorage
      localStorage.removeItem('is_authed');
      localStorage.removeItem('user_tg_id');
      localStorage.removeItem('welcome_seen');
      localStorage.removeItem('demo_mode');
      localStorage.removeItem('demo_start');
      localStorage.removeItem('demo_used');
      toast({ title: 'Session reset', description: 'Reloading...' });
      setTimeout(() => window.location.reload(), 500);
    }, 8000); // 8 секунд
  }, [toast]);

  // Отменяем сброс, если палец убрали раньше
  const handleLongPressEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);
  // =========================================================

  // ====== ГЛАВНЫЙ ЭФФЕКТ ПРИ ЗАГРУЗКЕ СТРАНИЦЫ ======
  useEffect(() => {
    // Читаем сохранённые данные из localStorage
    const storedAuthed = localStorage.getItem('is_authed') === 'true';  // Есть ли ключ активации
    const demoMode = localStorage.getItem('demo_mode') === 'true';      // Запущен ли демо-режим
    const demoStart = localStorage.getItem('demo_start');               // Время старта демо (timestamp)
    const demoUsed = localStorage.getItem('demo_used') === 'true';      // Был ли демо уже использован

    // ---------- 1. Проверка демо-режима ----------
    if (demoMode && demoStart && !demoUsed) {
      const elapsed = Date.now() - Number(demoStart);
      if (elapsed > 2 * 60 * 1000) {
        // Время демо (5 минут) истекло
        localStorage.removeItem('demo_mode');
        localStorage.removeItem('demo_start');
        localStorage.setItem('demo_used', 'true');  // Помечаем, что демо использован
        setIsAuthenticated(false);                  // Возвращаем на экран входа
        setIsLoading(false);
        return;
      }
      // Демо ещё активно — разрешаем вход
      setIsAuthenticated(true);
      setIsLoading(false);

      // Таймер, который автоматически выйдет через оставшееся время
      const remaining = 5 * 60 * 1000 - elapsed;
      const timer = setTimeout(() => {
        localStorage.removeItem('demo_mode');
        localStorage.removeItem('demo_start');
        localStorage.setItem('demo_used', 'true');
        window.location.reload();
      }, remaining);

      return () => clearTimeout(timer);
    }

    // Если демо уже был использован ранее — принудительно на экран входа
    if (demoUsed) {
      localStorage.removeItem('demo_mode');
      localStorage.removeItem('demo_start');
      setIsAuthenticated(false);
      setIsLoading(false);
      return;
    }

    // ---------- 2. Обычная проверка авторизации по ключу ----------
    if (storedAuthed) {
      const storedTgId = localStorage.getItem('user_tg_id');
      const tg = (window as any).Telegram?.WebApp;
      const currentTgId = tg?.initDataUnsafe?.user?.id;

      // Если Telegram ID не совпадает с сохранённым — сбрасываем сессию (защита от чужих)
      if (currentTgId && storedTgId && String(currentTgId) !== storedTgId) {
        localStorage.removeItem('is_authed');
        localStorage.removeItem('user_tg_id');
        localStorage.removeItem('welcome_seen');
        setIsAuthenticated(false);
      } else {
        setIsAuthenticated(true);
      }
    } else {
      setIsAuthenticated(false);
    }

    // ---------- 3. Инициализация Telegram Mini App ----------
    if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
      const tg = (window as any).Telegram.WebApp;
      tg.ready();                        // Сообщаем о готовности
      tg.expand();                       // Раскрываем на весь экран
      tg.setHeaderColor('#0B0E14');      // Цвет верхней панели
      tg.setBackgroundColor('#0B0E14');  // Цвет фона
    }

    setIsLoading(false);
  }, []);

  // ====== РЕНДЕР ======
  // Пока идёт первая загрузка — показываем спиннер
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0B0E14]">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  // Если не авторизован — показываем экран ввода ключа
  if (!isAuthenticated) {
    return <AuthScreen onAuthenticated={() => setIsAuthenticated(true)} />;
  }

  // Основной интерфейс приложения
  return (
    <main className="flex flex-col h-full w-full relative overflow-hidden animate-in fade-in duration-1000">
      {/* Невидимая зона для скрытого сброса сессии (правый верхний угол) */}
      <div
        className="absolute top-0 right-0 w-10 h-10 z-50"
        onTouchStart={handleLongPressStart}
        onTouchEnd={handleLongPressEnd}
        onTouchCancel={handleLongPressEnd}
        onMouseDown={handleLongPressStart}
        onMouseUp={handleLongPressEnd}
        onMouseLeave={handleLongPressEnd}
      />

      {/* Контент выбранной вкладки */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab === 'questions' && <QuestionsTab />}
        {activeTab === 'tests' && <TestsTab />}
        {activeTab === 'tasks' && <TasksTab />}
        {activeTab === 'stats' && <StatsTab />}
      </div>

      {/* Нижняя панель навигации */}
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
    </main>
  );
}