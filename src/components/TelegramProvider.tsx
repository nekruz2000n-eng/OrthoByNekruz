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
    }
  }, []);

  return null;
}