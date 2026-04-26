"use client";

import { useEffect } from 'react';

export default function TelegramProvider() {
  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      tg.expand();
      tg.enableClosingConfirmation();
      tg.setHeaderColor('#0B0E14');
      tg.setBackgroundColor('#0B0E14');
      tg.ready();

      // Блокируем свайп сразу
      if (typeof tg.disableVerticalSwipes === 'function') {
        tg.disableVerticalSwipes();
      } else {
        // Если метод не появился, пробуем через 100 мс
        setTimeout(() => {
          const retryTg = (window as any).Telegram?.WebApp;
          if (retryTg && typeof retryTg.disableVerticalSwipes === 'function') {
            retryTg.disableVerticalSwipes();
          }
        }, 100);
      }

      // Дополнительная страховка: при изменении viewport снова запрещаем свайп
      tg.onEvent('viewportChanged', (data: any) => {
        if (data && data.isStateStable === false) {
          tg.disableVerticalSwipes?.();
        }
      });
    }
  }, []);

  return null;
}