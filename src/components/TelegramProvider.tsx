"use client";

import { useEffect } from 'react';

export default function TelegramProvider() {
  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (!tg) return;

    // Разворачиваем и блокируем свайп
    tg.expand();
    if (typeof tg.disableVerticalSwipes === 'function') {
      tg.disableVerticalSwipes();
    }

    // Пытаемся спрятать верхнюю плашку
    if (typeof tg.requestFullscreen === 'function') {
      tg.requestFullscreen();           // настоящий fullscreen (если поддерживается)
    }
    if (typeof tg.hideHeader === 'function') {
      tg.hideHeader();                  // скрываем заголовок совсем (новый метод)
    } else {
      // Если hideHeader нет – делаем заголовок прозрачным под цвет фона
      try {
        tg.setHeaderColor('secondary_bg_color');
      } catch {
        tg.setHeaderColor('#0B0E14');
      }
    }

    tg.setBackgroundColor('#0B0E14');
    try { tg.setBottomBarColor('#0B0E14'); } catch {}

    tg.ready();
  }, []);

  return null;
}