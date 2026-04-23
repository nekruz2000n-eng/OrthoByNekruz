"use client";

import { useEffect } from 'react';

export default function TelegramProvider() {
  useEffect(() => {
    // Проверяем, что мы в окружении браузера и SDK загрузился
    const tg = (window as any).Telegram?.WebApp;

    if (tg) {
      // 1. Разворачиваем на всю высоту экрана
      tg.expand();

      // 2. Включаем подтверждение закрытия (свайп вниз вызовет диалог)
      tg.enableClosingConfirmation();

      // 3. Устанавливаем цвета хедера под твою темную тему
      tg.setHeaderColor('#0a0a0a'); // Цвет фона твоего сайта
      tg.setBackgroundColor('#0a0a0a');

      // 4. Сообщаем Telegram, что приложение готово
      tg.ready();
    }
  }, []);

  return null; // Компонент ничего не рендерит, только исполняет логику
}