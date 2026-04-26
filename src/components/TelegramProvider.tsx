"use client";

import { useEffect } from 'react';

export default function TelegramProvider() {
  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (!tg) return;

    // 1. Разворачиваем окно
    tg.expand();

    // 2. Блокируем свайп (Telegram >= 7.7)
    if (typeof tg.disableVerticalSwipes === 'function') {
      tg.disableVerticalSwipes();
    }

    // 3. Пытаемся запросить настоящий fullscreen (Telegram >= 8.0)
    if (typeof tg.requestFullscreen === 'function') {
      tg.requestFullscreen();
    }

    // 4. Делаем хедер прозрачным / под цвет фона, чтобы плашка слилась
    //    Используем ключевое слово 'secondary_bg_color' или 'bg_color' – оно возьмёт цвет из темы клиента.
    //    Если не поддерживается, задаём явный цвет фона приложения.
    try {
      tg.setHeaderColor('secondary_bg_color'); // для тёмной темы будет тёмным, для светлой – светлым
    } catch {
      tg.setHeaderColor('#0B0E14'); // запасной тёмный цвет
    }
    tg.setBackgroundColor('#0B0E14');

    // 5. Цвет фона самого WebView (нижней части, если видна)
    try {
      tg.setBottomBarColor('#0B0E14');
    } catch {}

    // 6. Сообщаем о готовности
    tg.ready();
  }, []);

  return null;
}