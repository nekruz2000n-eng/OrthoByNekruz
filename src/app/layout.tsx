'use client';

import React, { useEffect, useState } from 'react';
import { AuthScreen } from '@/components/AuthScreen'; // Убедись, что путь к AuthScreen верный
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/hooks/use-toast';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const { toast } = useToast();

  // 1. Проверка авторизации при загрузке
  useEffect(() => {
    const authStatus = localStorage.getItem('is_authed') === 'true';
    setIsAuthenticated(authStatus);
    setIsChecking(false);
  }, []);

  // 2. ИНЖЕНЕРНЫЙ ТАЙМЕР (Watcher)
  useEffect(() => {
    if (!isAuthenticated) return;

    const checkDemoExpiry = () => {
      const isDemo = localStorage.getItem('demo_mode') === 'true';
      const demoStart = localStorage.getItem('demo_start');
      
      if (isDemo && demoStart) {
        const elapsed = Date.now() - parseInt(demoStart, 10);
        const THREE_MINUTES = 3 * 60 * 1000; 

        if (elapsed >= THREE_MINUTES) {
          // ВРЕМЯ ВЫШЛО
          localStorage.setItem('is_authed', 'false');
          localStorage.setItem('demo_expired', 'true');
          setIsAuthenticated(false);
          
          toast({
            variant: 'destructive',
            title: 'Демо-период завершен',
            description: 'Для продолжения работы необходим ключ доступа.',
          });
        }
      }
    };

    // Проверяем каждые 2 секунды, чтобы юзер не успел дочитать
    const interval = setInterval(checkDemoExpiry, 2000);
    return () => clearInterval(interval);
  }, [isAuthenticated, toast]);

  // Если идет первичная проверка — не показываем ничего, чтобы не было "мигания"
  if (isChecking) return null;

  return (
    <html lang="ru">
      <body className="antialiased dark">
        {isAuthenticated ? (
          // Если авторизован (или в демо) — показываем контент приложения
          <main>{children}</main>
        ) : (
          // Если не авторизован или демо кончилось — экран входа
          <AuthScreen onAuthenticated={() => setIsAuthenticated(true)} />
        )}
        <Toaster />
      </body>
    </html>
  );
}