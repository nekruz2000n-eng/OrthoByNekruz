"use client";

import { useEffect } from 'react';

export default function TelegramProvider() {
  useEffect(() => {
    // Дожидаемся, пока Telegram WebApp SDK полностью загрузится
    const tg = (window as any).Telegram?.WebApp;

    if (tg) {
      // 1. Разворачиваем на весь экран
      tg.expand();

      // 2. Включаем подтверждение закрытия (свайп вниз вызовет диалог)
      tg.enableClosingConfirmation();

      // 3. Блокируем закрытие свайпом вниз (Telegram версии 7.7 и выше)
      if (tg.isVersionAtLeast && tg.isVersionAtLeast('7.7')) {
        tg.disableVerticalSwipes();
      } else if (tg.disableVerticalSwipes) {
        // На случай, если метод есть, но проверка версий не работает
        tg.disableVerticalSwipes();
      }

      // 4. Устанавливаем цвета хедера под твою тёмную тему
      tg.setHeaderColor('#0B0E14');
      tg.setBackgroundColor('#0B0E14');

      // 5. Сообщаем Telegram, что приложение готово
      tg.ready();
    }
  }, []);

  return null; // Компонент ничего не рендерит, только исполняет логику
}