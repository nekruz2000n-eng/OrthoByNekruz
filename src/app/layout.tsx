'use client';
import "./globals.css";
import React, { useEffect, useState } from 'react';
import { AuthScreen } from '@/components/AuthScreen';
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/hooks/use-toast';
import Script from 'next/script';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
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
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />

        {/*
          Telegram WebApp SDK — грузим ПЕРЕД всем остальным.
          Это гарантирует что CSS-переменные --tg-safe-area-inset-*
          будут доступны до первого render.
        */}
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />

        {/*
          INLINE-скрипт: запрет свайпа на самом раннем этапе —
          до того как React успеет смонтироваться.
          Это самый надёжный способ, работает даже при рефреше.
        */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            var attempts = 0;
            function tryDisable() {
              var tg = window.Telegram && window.Telegram.WebApp;
              if (tg && tg.disableVerticalSwipes) {
                tg.disableVerticalSwipes();
                // Повторяем ещё несколько раз для надёжности
                if (attempts < 5) {
                  attempts++;
                  setTimeout(tryDisable, 300);
                }
              } else if (attempts < 20) {
                attempts++;
                setTimeout(tryDisable, 100);
              }
            }
            tryDisable();
          })();
        ` }} />
      </head>
      <body className="antialiased dark">
        {isAuthenticated ? (
          <main>{children}</main>
        ) : (
          <AuthScreen onAuthenticated={() => setIsAuthenticated(true)} />
        )}
        <Toaster />
      </body>
    </html>
  );
}
