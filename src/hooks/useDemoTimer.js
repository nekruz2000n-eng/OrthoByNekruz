'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function useDemoTimer() {
  const router = useRouter();

  useEffect(() => {
    // Если пользователь уже вводил ключ, пропускаем таймер
    const hasValidKey = localStorage.getItem('hasValidKey');
    if (hasValidKey === 'true') return;

    // Если демо уже истекло ранее, сразу выкидываем
    if (localStorage.getItem('demoExpired') === 'true') {
      router.push('/enter-key'); // Замени на свой URL страницы с ключом
      return;
    }

    // Инициализируем время первого входа
    let demoStartTime = localStorage.getItem('demoStartTime');
    if (!demoStartTime) {
      demoStartTime = Date.now().toString();
      localStorage.setItem('demoStartTime', demoStartTime);
    }

    const DEMO_DURATION = 3 * 60 * 1000; // 3 минуты в миллисекундах

    const checkTime = () => {
      const elapsed = Date.now() - parseInt(demoStartTime, 10);
      
      if (elapsed >= DEMO_DURATION) {
        localStorage.setItem('demoExpired', 'true');
        router.push('/enter-key'); // Замени на свой URL страницы с ключом
      }
    };

    // Проверяем сразу при монтировании
    checkTime();

    // Запускаем интервал проверки каждую секунду
    const interval = setInterval(checkTime, 1000);

    // Очищаем интервал при размонтировании компонента
    return () => clearInterval(interval);
  }, [router]);
}