'use client';
import "./globals.css";
import React, { useEffect, useState } from 'react';
import { AuthScreen } from '@/components/AuthScreen';
import { Toaster }    from '@/components/ui/toaster';
import { useToast }   from '@/hooks/use-toast';
import Script         from 'next/script';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking,      setIsChecking]      = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    setIsAuthenticated(localStorage.getItem('is_authed') === 'true');
    setIsChecking(false);
  }, []);

  // Демо-доступ
  useEffect(() => {
    if (!isAuthenticated) return;
    const check = () => {
      if (localStorage.getItem('demo_mode') !== 'true') return;
      const start = localStorage.getItem('demo_start');
      if (start && Date.now() - parseInt(start, 10) >= 3 * 60_000) {
        localStorage.setItem('is_authed', 'false');
        localStorage.setItem('demo_expired', 'true');
        setIsAuthenticated(false);
        toast({ variant: 'destructive', title: 'Демо завершено', description: 'Требуется ключ доступа.' });
      }
    };
    const iv = setInterval(check, 2000);
    return () => clearInterval(iv);
  }, [isAuthenticated, toast]);

  if (isChecking) return null;

  return (
    <html lang="ru">
      <head>
        {/*
          viewport-fit=cover — обязательно для того чтобы
          env(safe-area-inset-*) и TG CSS-переменные работали корректно.
        */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        />
        <meta name="apple-mobile-web-app-capable"          content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />

        {/*
          Telegram WebApp SDK — beforeInteractive гарантирует загрузку
          ДО гидрации React. SDK сразу инжектирует CSS-переменные и
          tg.safeAreaInsets / tg.contentSafeAreaInsets будут доступны
          в initTelegramApp() (page.tsx).
        */}
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
      </head>
      <body className="antialiased dark">
        {isAuthenticated
          ? <main>{children}</main>
          : <AuthScreen onAuthenticated={() => setIsAuthenticated(true)} />
        }
        <Toaster />
      </body>
    </html>
  );
}
