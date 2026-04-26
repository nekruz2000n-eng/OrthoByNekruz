"use client";

import { useEffect } from 'react';

export default function TelegramProvider() {
  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      // 1. Разворачиваем окно на всю доступную высоту
      tg.expand();

      // 2. Блокируем закрытие свайпом вниз (требуется Telegram версии 7.7+)
      if (typeof tg.disableVerticalSwipes === 'function') {
        tg.disableVerticalSwipes();
      }

      // 3. Включаем подтверждение закрытия (на случай, если свайп всё-таки возможен)
      tg.enableClosingConfirmation();

      // 4. НАСТРОЙКА ПРОЗРАЧНОГО ЗАГОЛОВКА
      // Вместо конкретного цвета фона используем ключевое слово 'bg_color' или 'secondary_bg_color',
      // чтобы плашка заголовка сливалась с фоном твоего приложения.
      // Но Telegram также позволяет передать 'bottom_bar_bg_color' и т.д.
      // Мы укажем шестнадцатеричное значение, совпадающее с твоим фоном (#0B0E14)
      tg.setHeaderColor('#0B0E14');
      tg.setBackgroundColor('#0B0E14');

      // 5. ПОЛНОЭКРАННЫЙ РЕЖИМ (скрывает верхнюю плашку, если поддерживается)
      if (tg.isVersionAtLeast && tg.isVersionAtLeast('8.0') && typeof tg.requestFullscreen === 'function') {
        tg.requestFullscreen();
      }

      // 6. Сообщаем Telegram, что приложение полностью загружено и готово
      tg.ready();
    }
  }, []);

  return null;
}