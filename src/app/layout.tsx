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

  // ── ВАЖНО: НЕ возвращаем null — всегда рендерим <html> ──────────────────
  // Если вернуть null пока isChecking=true, весь <head> не рендерится и
  // inline-скрипты (TG init, тема) не запускаются → свайп не блокируется.

  return (
    <html lang="ru">
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        />
        <meta name="apple-mobile-web-app-capable"          content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />

        {/* Telegram SDK — до гидрации React */}
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />

        {/*
          КРИТИЧЕСКИЙ inline-скрипт.
          Запускается ДО React на КАЖДОМ запуске — и при первом входе,
          и при последующих (когда авторизация уже сохранена).
          Делает три вещи:
            1. Применяет тему (dark/light/bright)
            2. Инициализирует Telegram (ready, expand, fullscreen)
            3. Сразу блокирует свайп вниз и показывает BackButton
            4. Вычисляет safe areas
        */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            // ── 1. ТЕМА ─────────────────────────────────────────────────────
            var theme = localStorage.getItem('theme');
            if (!theme || !['dark','light','bright'].includes(theme)) {
              theme = 'dark';
              localStorage.setItem('theme', 'dark');
            }
            var root = document.documentElement;
            root.classList.remove('dark', 'bright');
            if (theme === 'dark')   root.classList.add('dark');
            if (theme === 'bright') root.classList.add('dark', 'bright');

            // ── 2. TELEGRAM INIT ─────────────────────────────────────────────
            function initTG() {
              var tg = window.Telegram && window.Telegram.WebApp;
              if (!tg) return false;

              tg.ready();
              tg.expand();
              try { tg.requestFullscreen(); } catch(e) {}

              // ── Запрет свайпа вниз (главная защита) ─────────────────────
              function disableSwipe() {
                try { tg.disableVerticalSwipes(); } catch(e) {}
              }
              disableSwipe();
              setTimeout(disableSwipe, 200);
              setTimeout(disableSwipe, 600);
              setTimeout(disableSwipe, 1500);
              setTimeout(disableSwipe, 3000);

              // ── Кнопка Назад с подтверждением ───────────────────────────
              try {
                tg.BackButton.show();
                tg.BackButton.onClick(function() {
                  tg.showConfirm('Выйти из OrthoByNekruz?', function(ok) {
                    if (ok) tg.close();
                  });
                });
              } catch(e) {}

              // ── Подтверждение при закрытии X ────────────────────────────
              try { tg.enableClosingConfirmation(); } catch(e) {}

              // ── Цвет шапки/фона ──────────────────────────────────────────
              var bg = theme === 'light' ? '#F0EDE4' : '#111318';
              try { tg.setHeaderColor(bg); }     catch(e) {}
              try { tg.setBackgroundColor(bg); } catch(e) {}
              try { tg.setBottomBarColor(bg); }  catch(e) {}

              // ── Safe areas ───────────────────────────────────────────────
              var sysTop   = (tg.safeAreaInsets && tg.safeAreaInsets.top)               || 0;
              var tgTop    = (tg.contentSafeAreaInsets && tg.contentSafeAreaInsets.top)  || 0;
              var tgBottom = (tg.contentSafeAreaInsets && tg.contentSafeAreaInsets.bottom) || 0;
              var isFS     = tg.isFullscreen === true || tgTop > 0;
              root.style.setProperty('--header-pt',  (sysTop + tgTop + 65) + 'px');
              root.style.setProperty('--scroll-pb',  (tgBottom + (isFS ? 100 : 84)) + 'px');
              root.style.setProperty('--nav-bottom', (tgBottom + (isFS ? 20 : 0)) + 'px');

              return (sysTop + tgTop) > 0;
            }

            // Пробуем сразу, потом polling пока SDK не загрузится
            var gotSafeArea = initTG();
            if (!gotSafeArea) {
              var attempts = 0;
              var poll = setInterval(function() {
                attempts++;
                gotSafeArea = initTG();
                if (gotSafeArea || attempts >= 100) clearInterval(poll);
              }, 30);
            }

            // ── DOM touchmove — резервная защита от свайпа ───────────────
            document.addEventListener('touchstart', function(e) {
              window.__touchStartY = e.touches[0].clientY;
              window.__touchStartX = e.touches[0].clientX;
            }, { passive: true });

            document.addEventListener('touchmove', function(e) {
              var dy = e.touches[0].clientY - (window.__touchStartY || 0);
              var dx = e.touches[0].clientX - (window.__touchStartX || 0);
              if (Math.abs(dx) > Math.abs(dy) + 5) return;
              if (dy <= 5) return;

              // Жёсткая блокировка в верхней зоне
              if ((window.__touchStartY || 0) < 80) {
                e.preventDefault();
                return;
              }

              // Ищем скролл-контейнер
              var el = e.target;
              var scrollEl = null;
              while (el && el !== document.body) {
                if (el.hasAttribute && el.hasAttribute('data-radix-scroll-area-viewport')) { scrollEl = el; break; }
                if (el.classList && el.classList.contains('scroll-container')) { scrollEl = el; break; }
                var oy = window.getComputedStyle(el).overflowY;
                if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight) { scrollEl = el; break; }
                el = el.parentElement;
              }

              if (!scrollEl || scrollEl.scrollTop <= 0) e.preventDefault();
            }, { passive: false });

          })();
        ` }} />
      </head>
      <body className="antialiased">
        {isChecking ? (
          // Пока проверяем авторизацию — показываем тёмный экран без мигания
          <div style={{ minHeight: '100dvh', background: '#111318' }} />
        ) : isAuthenticated ? (
          <main>{children}</main>
        ) : (
          <AuthScreen onAuthenticated={() => setIsAuthenticated(true)} />
        )}
        <Toaster />
      </body>
    </html>
  );
}
