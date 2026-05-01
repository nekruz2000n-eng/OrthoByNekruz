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
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        />
        <meta name="apple-mobile-web-app-capable"          content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />

        {/*
          Telegram SDK — beforeInteractive: грузится до гидрации React.
          После загрузки SDK tg.safeAreaInsets / tg.contentSafeAreaInsets
          уже заполнены (особенно в BotFather Fullscreen режиме).
        */}
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />

        {/*
          КРИТИЧЕСКИЙ inline-скрипт: читает safe areas и пишет CSS-переменные
          ДО первого рендера React. Так шапка никогда не окажется под
          системными данными даже при самом быстром рендере.

          Запускается сразу после загрузки SDK (который beforeInteractive).
        */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            function apply() {
              var tg = window.Telegram && window.Telegram.WebApp;
              if (!tg) return false;

              var sysTop   = (tg.safeAreaInsets        && tg.safeAreaInsets.top)        || 0;
              var tgTop    = (tg.contentSafeAreaInsets  && tg.contentSafeAreaInsets.top) || 0;
              var tgBottom = (tg.contentSafeAreaInsets  && tg.contentSafeAreaInsets.bottom) || 0;

              // Fullsize: Telegram обрезает viewport сам — лишний отступ снизу не нужен
              var isFullscreen = tg.isFullscreen === true || tgTop > 0;

              var headerPt  = sysTop + tgTop + 16;
              var scrollPb  = tgBottom + (isFullscreen ? 100 : 84);
              var navBottom = tgBottom + (isFullscreen ? 20 : 0);

              var root = document.documentElement;
              root.style.setProperty('--header-pt',  headerPt  + 'px');
              root.style.setProperty('--scroll-pb',  scrollPb  + 'px');
              root.style.setProperty('--nav-bottom', navBottom + 'px');

              return (sysTop + tgTop) > 0;
            }

            // Первый вызов сразу
            var gotValue = apply();

            // Если сразу не получили значение — polling каждые 30мс
            // (inline, без async, с жёстким лимитом 3 сек)
            if (!gotValue) {
              var attempts = 0;
              var poll = setInterval(function() {
                attempts++;
                gotValue = apply();
                if (gotValue || attempts >= 100) clearInterval(poll);
              }, 30);
            }
          })();
        ` }} />
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
