"use client"; // Указывает Next.js, что этот компонент должен выполняться на стороне клиента (в браузере), так как тут есть хуки состояния (useState, useEffect).

// ─── ИМПОРТЫ ─────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ToothIcon } from './ToothIcon'; // Твоя кастомная SVG-иконка зуба
import { Input } from '@/components/ui/input'; // Компонент поля ввода (из библиотеки shadcn/ui)
import { Button } from '@/components/ui/button'; // Компонент кнопки (из библиотеки shadcn/ui)
import { useToast } from '@/hooks/use-toast'; // Хук для показа всплывающих уведомлений (тостов)
import { Loader2, ExternalLink, Heart } from 'lucide-react'; // Иконки из библиотеки lucide-react
import { cn } from '@/lib/utils';
import {
  detectFacultyByInput,
  resolveFacultyPromoCode,
  MAX_INPUT_LENGTH,
  getDefaultDigitIcon,
  isLegacyPaidKey,
} from '@/lib/facultyCodes';

type FacultyVariant = 'tooth' | 'stethoscope' | 'pediatrics';

const LOGO_PHASES: FacultyVariant[] = ['tooth', 'stethoscope', 'pediatrics'];

/** SVG вместо emoji — в Telegram WebView текстовые эмодзи в анимации часто не рисуются */
const FacultyRainIcon = ({
  variant,
  size,
  strokeWidth = 1.5,
  fillOpacity = 0.25,
}: {
  variant: FacultyVariant;
  size: number;
  strokeWidth?: number;
  fillOpacity?: number;
}) => {
  const palette =
    variant === 'stethoscope'
      ? { stroke: '#FFFFFF', fill: 'rgb(96, 165, 250)' }
      : variant === 'pediatrics'
        ? { stroke: '#FFFFFF', fill: 'rgb(251, 191, 36)' }
        : { stroke: '#FFFFFF', fill: 'hsl(var(--primary))' };

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      {variant === 'tooth' && (
        <path
          d="M7.5 3C5.5 3 4 4.5 4 6.5C4 8.5 4.5 11 5.5 13.5C6.5 16 8.5 19.5 8.5 21C8.5 21.5 8.9 22 9.5 22C10.1 22 10.5 21.5 10.5 21C10.5 20.5 11 18 12 18C13 18 13.5 20.5 13.5 21C13.5 21.5 13.9 22 14.5 22C15.1 22 15.5 21.5 15.5 21C15.5 19.5 17.5 16 18.5 13.5C19.5 11 20 8.5 20 6.5C20 4.5 18.5 3 16.5 3C14.5 3 13 4 12 5C11 4 9.5 3 7.5 3Z"
          stroke={palette.stroke}
          strokeWidth={strokeWidth}
          fill={palette.fill}
          fillOpacity={fillOpacity}
        />
      )}
      {variant === 'stethoscope' && (
        <>
          <path d="M5 3v3.5a2.5 2.5 0 0 0 5 0V3" stroke={palette.stroke} strokeWidth={strokeWidth} strokeLinecap="round" fill="none" />
          <path d="M14 3v3.5a2.5 2.5 0 0 0 5 0V3" stroke={palette.stroke} strokeWidth={strokeWidth} strokeLinecap="round" fill="none" />
          <path d="M7.5 7h9" stroke={palette.stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
          <path d="M12 7v3a4 4 0 0 0 8 0V7" stroke={palette.stroke} strokeWidth={strokeWidth} strokeLinecap="round" fill="none" />
          <path d="M16 10v1.5a3 3 0 0 1-6 0V10" stroke={palette.stroke} strokeWidth={strokeWidth} strokeLinecap="round" fill="none" />
          <circle cx="13" cy="17" r="3" stroke={palette.stroke} strokeWidth={strokeWidth} fill={palette.fill} fillOpacity={fillOpacity} />
        </>
      )}
      {variant === 'pediatrics' && (
        <>
          <circle cx="12" cy="10" r="5" stroke={palette.stroke} strokeWidth={strokeWidth} fill={palette.fill} fillOpacity={fillOpacity} />
          <circle cx="10" cy="9.5" r="0.7" fill={palette.stroke} />
          <circle cx="14" cy="9.5" r="0.7" fill={palette.stroke} />
          <path d="M9 12.5Q12 14.5 15 12.5" stroke={palette.stroke} strokeWidth="1.2" strokeLinecap="round" fill="none" />
          <path d="M8 17h8" stroke={palette.stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
        </>
      )}
    </svg>
  );
};

// ─── ЦЕНТРАЛЬНЫЙ ЛОГОТИП: зуб → стетоскоп → педиатрия по кругу ───────────────
const AuthLogoCycle = () => {
  const [phase, setPhase] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const HOLD_MS = 2600;
    const FADE_MS = 500;
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const schedule = (fn: () => void, ms: number) => {
      const id = setTimeout(() => { if (!cancelled) fn(); }, ms);
      timers.push(id);
    };

    const tick = () => {
      setVisible(false);
      schedule(() => {
        setPhase(p => (p + 1) % 3);
        setVisible(true);
        schedule(tick, HOLD_MS);
      }, FADE_MS);
    };

    schedule(tick, HOLD_MS);
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, []);

  return (
    <div
      className="w-12 h-12 flex items-center justify-center transition-opacity duration-500 ease-in-out"
      style={{ opacity: visible ? 1 : 0 }}
    >
      {LOGO_PHASES[phase] === 'tooth' ? (
        <ToothIcon className="w-12 h-12 text-primary" variant="perfect" />
      ) : (
        <FacultyRainIcon
          variant={LOGO_PHASES[phase]}
          size={48}
          strokeWidth={1.6}
          fillOpacity={0.35}
        />
      )}
    </div>
  );
};

// Частицы дождя (фиксированный порядок — без random, чтобы не ломать гидратацию)
const RAIN_PARTICLES: { variant: FacultyVariant }[] = [
  { variant: 'tooth' },
  { variant: 'stethoscope' },
  { variant: 'tooth' },
  { variant: 'pediatrics' },
  { variant: 'tooth' },
  { variant: 'tooth' },
  { variant: 'stethoscope' },
  { variant: 'tooth' },
  { variant: 'pediatrics' },
  { variant: 'tooth' },
  { variant: 'stethoscope' },
  { variant: 'tooth' },
  { variant: 'tooth' },
  { variant: 'pediatrics' },
];

// ─── КОМПОНЕНТ ФОНА: ПАДАЮЩИЕ ЗУБИКИ + ЭМОДЗИ ФАКУЛЬТЕТОВ ───────────────────
const ToothRainBG = () => {
  const teeth = RAIN_PARTICLES.map((particle, i) => {
    const isAccent = particle.variant !== 'tooth';
    const size = isAccent ? 26 + ((i * 4) % 10) : 12 + ((i * 11) % 24);
    const isForeground = size > 24;

    return {
      id: i,
      variant: particle.variant,
      left: (i * 23 + 5) % 92,
      size,
      dur: isAccent ? 7 + (i % 3) : isForeground ? (6 + ((i * 3) % 4)) : (10 + ((i * 5) % 6)),
      delay: (i * 0.85) % 6.5,
      blur: isAccent ? 0 : isForeground ? 0 : 1.5,
      maxOpacity: isAccent ? 0.6 : isForeground ? 0.4 : 0.15,
      spinDir: i % 2 === 0 ? 1 : -1,
      isForeground: isAccent || isForeground,
    };
  });

  return (
    // Обертка на весь экран (absolute inset-0). pointer-events-none делает так, чтобы зубы не перекрывали клики по кнопкам.
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      
      {/* Глобальные стили для анимаций именно этой страницы */}
      <style>{`
        /* Анимация 3D падения зубов */
        @keyframes toothFall3D {
          0% {
            /* Старт чуть выше верхнего края экрана */
            transform: translateY(-50px) rotate(0deg) translateX(0px);
            opacity: 0; /* Начинают появляться плавно */
          }
          15% { opacity: var(--max-op); } /* Достигают своей максимальной яркости */
          85% { opacity: var(--max-op); } /* Держат яркость почти до самого низа */
          100% {
            /* Улетают за нижний край (110vh), крутятся (rotate) и немного смещаются вбок (translateX - имитация ветра) */
            transform: translateY(110vh) rotate(calc(360deg * var(--spin))) translateX(calc(30px * var(--spin)));
            opacity: 0; /* Плавно исчезают внизу */
          }
        }
        /* Анимация пульсации центрального логотипа-зуба */
        @keyframes authToothPulse {
          0%,100% { transform: scale(1);    filter: drop-shadow(0 0 8px  hsl(var(--primary) / 0.4)); }
          50%     { transform: scale(1.08); filter: drop-shadow(0 0 20px hsl(var(--primary) / 0.8)); }
        }
        /* Анимация плавного всплывания эмодзи-зубика при вводе пароля */
        @keyframes authToothSlideUp {
          from { transform: translateY(8px) scale(0.8); opacity: 0; }
          to   { transform: translateY(0)   scale(1);   opacity: 1; }
        }
        /* Анимация тряски (ошибки) при неверном пароле */
        @keyframes authShake {
          0%,100% { transform: translateX(0); }
          25%     { transform: translateX(-5px); }
          75%     { transform: translateX(5px); }
        }
        .auth-shake { animation: authShake 0.2s ease-in-out 0s 2; }
      `}</style>
      
      {teeth.map((t) => {
        const fallStyle = {
          position: 'absolute',
          left: `${t.left}%`,
          top: -50,
          animation: `toothFall3D ${t.dur}s ${t.delay}s linear infinite`,
          '--max-op': t.maxOpacity,
          '--spin': t.spinDir,
          filter: `blur(${t.blur}px) drop-shadow(0 0 ${t.isForeground ? '4px' : '2px'} rgba(255, 255, 255, ${t.maxOpacity * 1.5}))`,
        } as React.CSSProperties;

        return (
          <div key={t.id} style={fallStyle}>
            <FacultyRainIcon
              variant={t.variant}
              size={t.size}
              strokeWidth={t.isForeground ? 1.5 : 1}
              fillOpacity={t.variant === 'tooth' ? 0.2 : 0.35}
            />
          </div>
        );
      })}
    </div>
  );
};

// ─── ГЛАВНЫЙ КОМПОНЕНТ АВТОРИЗАЦИИ ───────────────────────────────────────────
export const AuthScreen = ({ onAuthenticated }: { onAuthenticated: () => void }) => {
  const { toast } = useToast();

  // ── Стейты (Состояния компонента) ──
  const [mounted, setMounted] = useState(false); // Флаг: загрузился ли компонент в браузере
  const [key, setKey] = useState(''); // Введенный пользователем ключ (до 8 цифр)
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [focused, setFocused] = useState(false);
  const [isPaidKeysEnabled, setIsPaidKeysEnabled] = useState(true);

  useEffect(() => {
    fetch('/api/admin-config')
      .then(res => res.json())
      .then(data => {
        if (typeof data.isPaidKeysEnabled === 'boolean') {
          setIsPaidKeysEnabled(data.isPaidKeysEnabled);
        }
      })
      .catch(err => console.error('Ошибка загрузки конфига:', err));
  }, []);

  // Время блокировки (в секундах) при неверном вводе. Берем из localStorage, если юзер обновил страницу.
  const [lockoutTime, setLockoutTime] = useState(() => {
    if (typeof window === 'undefined') return 0;
    const until = Number(localStorage.getItem('lockout_until') || '0');
    const left  = Math.ceil((until - Date.now()) / 1000);
    return left > 0 ? left : 0;
  });

  const [needsSubscription, setNeedsSubscription] = useState(false); // Флаг: нужно ли подписаться на канал
  const [showWelcome, setShowWelcome] = useState(false); // Показывать ли приветственное окно ("Рад видеть!")
  const [manualTgId, setManualTgId] = useState(''); // Telegram ID, если юзер вводит его вручную
  const [autoTgId, setAutoTgId] = useState<string | null>(null); // Telegram ID, полученный автоматически
  const [idChecked, setIdChecked] = useState(false); // Проверили ли мы наличие Telegram ID
  const [idCheckAttempts, setIdCheckAttempts] = useState(0); // Количество попыток получить ID
  const [debugInfo, setDebugInfo] = useState(''); // Техническая инфа (для отладки)
  const [initData, setInitData] = useState(''); // Данные инициализации от Telegram
  const [demoMessage, setDemoMessage] = useState(''); // Сообщение об ошибке демо-режима
  const [errorMessage, setErrorMessage] = useState(''); // Текст ошибки ключа

  const maxAttempts = 20; // Макс. попыток дождаться Telegram
  const attemptInterval = 500; // Интервал между попытками (полсекунды)

  // ── Хуки жизненного цикла ──

  // Устанавливаем mounted в true после первой загрузки (защита от ошибок гидратации Next.js)
  useEffect(() => { setMounted(true); }, []);

  // Таймер блокировки. Каждую секунду отнимает 1 от lockoutTime, пока не дойдет до 0.
  useEffect(() => {
    if (lockoutTime <= 0) return;
    const iv = setInterval(() => {
      setLockoutTime(t => {
        if (t <= 1) { clearInterval(iv); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [lockoutTime]);

  // Инициализация Telegram WebApp
  useEffect(() => {
    if (!mounted) return;
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      tg.ready(); // Сообщаем Telegram, что приложение готово
      tg.expand?.(); // Разворачиваем на весь экран
      try { tg.setBackgroundColor('#0A0E0C'); } catch {} // Красим шапку Telegram в цвет нашего фона
      if (tg.initData) setInitData(tg.initData); // Сохраняем данные для проверки подлинности на сервере
    }
  }, [mounted]);

  // Автоматический поиск Telegram ID пользователя
  useEffect(() => {
    if (!mounted || autoTgId !== null || idCheckAttempts >= maxAttempts) {
      if (idCheckAttempts >= maxAttempts) setIdChecked(true); // Если попытки кончились, сдаемся
      return;
    }
    const timer = setTimeout(() => {
      const tg = (window as any).Telegram?.WebApp;
      if (tg) {
        // Обновляем initData при каждой попытке — он может появиться позже
        if (tg.initData) setInitData(tg.initData);

        // Пытаемся достать ID из разных мест
        let id = tg.initDataUnsafe?.user?.id;
        if (!id && tg.initData) {
          try { id = JSON.parse(new URLSearchParams(tg.initData).get('user') || '{}').id; } catch {}
        }
        if (id) {
          setAutoTgId(String(id)); // Успешно нашли!
          setIdChecked(true);
        }
        else {
          setDebugInfo(`Attempt ${idCheckAttempts}: No ID`);
          setIdCheckAttempts(p => p + 1);
        }
      } else {
        setIdCheckAttempts(p => p + 1);
      }
    }, attemptInterval);
    return () => clearTimeout(timer);
  }, [mounted, autoTgId, idCheckAttempts]);

  // Продолжаем искать ID в фоне после показа поля ручного ввода
  // На некоторых версиях Telegram initData появляется с задержкой > 10 секунд
  const [bgAttempts, setBgAttempts] = useState(0);
  const maxBgAttempts = 40;
  useEffect(() => {
    if (!mounted || !idChecked || autoTgId !== null || bgAttempts >= maxBgAttempts) return;
    const timer = setTimeout(() => {
      const tg = (window as any).Telegram?.WebApp;
      if (tg) {
        if (tg.initData) setInitData(prev => prev || tg.initData);
        let id = tg.initDataUnsafe?.user?.id;
        if (!id && tg.initData) {
          try { id = JSON.parse(new URLSearchParams(tg.initData).get('user') || '{}').id; } catch {}
        }
        if (id) setAutoTgId(String(id));
      }
      setBgAttempts(p => p + 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [mounted, idChecked, autoTgId, bgAttempts]);

  // Уже зарегистрированные клиенты — без повторного ввода ключа
  const silentLoginTried = useRef(false);
  useEffect(() => {
    if (!mounted || !autoTgId || !initData || silentLoginTried.current) return;
    silentLoginTried.current = true;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            telegramId: String(autoTgId),
            mode: 'check_subjects',
            initData,
          }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (res.ok && data.registered !== false) {
          const hasAccess = Array.isArray(data.subjects) && data.subjects.length > 0;
          const inFlow = data.previewStatus === 'selecting'
            || data.previewStatus === 'active'
            || data.previewStatus === 'expired'
            || data.previewStatus === 'confirmed'
            || data.needsStudyGroup === true;
          if (hasAccess || inFlow) {
            localStorage.setItem('is_authed', 'true');
            localStorage.setItem('user_tg_id', String(autoTgId));
            onAuthenticated();
          }
        }
      } catch { /* остаёмся на экране кода */ }
    })();
    return () => { cancelled = true; };
  }, [mounted, autoTgId, initData, onAuthenticated]);

  // ── Секретная функция сброса (6 быстрых тапов по названию) ──
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleTitleClick = useCallback(() => {
    tapCountRef.current += 1;
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    
    if (tapCountRef.current >= 6) {
      localStorage.clear(); // Полностью очищаем память (сессию)
      toast({ title: 'Session reset', description: 'Storage cleared.' });
      setTimeout(() => window.location.reload(), 500); // Перезагружаем страницу
      tapCountRef.current = 0;
    } else {
      tapTimerRef.current = setTimeout(() => { tapCountRef.current = 0; }, 2000); // Если пауза между тапами > 2 сек, счетчик обнуляется
    }
  }, [toast]);

  // ── Основная функция проверки ключа (Обращение к серверу API) ──
  const handleAuth = useCallback(async (inputKey: string, inputTgId: string) => {
    if (loading || lockoutTime > 0 || !inputTgId) return;
    setLoading(true); setError(false); setNeedsSubscription(false);
    
    try {
      // Отправляем запрос на наш бэкенд
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: inputKey.trim(), telegramId: String(inputTgId), initData }),
      });
      const data = await res.json();
      
      if (res.ok) {
        localStorage.setItem('is_authed', 'true');
        localStorage.setItem('user_tg_id', String(inputTgId));
        if (data.previewStatus || data.preview) {
          onAuthenticated();
          return;
        }
        if (!localStorage.getItem('welcome_seen') && inputKey !== '') {
          setShowWelcome(true);
        } else {
          onAuthenticated();
        }
      } else {
        // Ошибки сервера
        if (res.status === 403 && data.blocked) {
          setError(true);
          setErrorMessage('Твой аккаунт заблокирован. Свяжись с администратором.');
          setTimeout(() => setErrorMessage(''), 6000);
        } else if (res.status === 403 && data.noInitData) {
          setError(true);
          setErrorMessage('Открой приложение через кнопку бота в Telegram, а не через браузер.');
          setTimeout(() => setErrorMessage(''), 8000);
        } else if (res.status === 403 && data.previewAwaiting) {
          localStorage.setItem('is_authed', 'true');
          localStorage.setItem('user_tg_id', String(inputTgId));
          onAuthenticated();
        } else if (res.status === 403 && data.needSubscription) {
          setNeedsSubscription(true);
        } else if (res.status === 403) {
          setError(true);
          setErrorMessage(data.error || 'Доступ запрещён');
          setTimeout(() => setErrorMessage(''), 5000);
        } else {
          // Неверный ключ. Блокируем ввод на 60 секунд (Защита от подбора)
          const LOCKOUT_SEC = 60;
          localStorage.setItem('lockout_until', String(Date.now() + LOCKOUT_SEC * 1000));
          setLockoutTime(LOCKOUT_SEC);
          setError(true); // Запускает анимацию тряски
          setErrorMessage(data.error || 'Неверный ключ доступа');
          setTimeout(() => setErrorMessage(''), 4000);
        }
      }
    } catch {
      setErrorMessage('Ошибка соединения с сервером');
      setTimeout(() => setErrorMessage(''), 4000);
    } finally {
      setLoading(false);
    }
  }, [loading, lockoutTime, onAuthenticated, toast, initData]);

  // ── Обработчик клика по кнопке "Войти" ──
  const handleLoginClick = () => {
    const id = autoTgId || manualTgId.trim();
    if (!id) { toast({ variant: 'destructive', title: 'ID не найден', description: 'Введи ID вручную' }); return; }
    if (!/^\d{5,12}$/.test(id) || Number(id) < 10000) {
      toast({ variant: 'destructive', title: 'Неверный ID', description: 'Telegram ID должен быть числовым (5-12 цифр)' }); return;
    }
    if (!canEnter) {
      const msg = legacyReady && !isPaidKeysEnabled
        ? 'Платные ключи временно отключены — введи код из канала'
        : 'Введи код из канала полностью';
      toast({ variant: 'destructive', title: 'Неверный код', description: msg });
      return;
    }
    handleAuth(key, id);
  };

  const handleCheckStatusClick = async () => {
    const id = autoTgId || manualTgId.trim();
    if (!id) { toast({ variant: 'destructive', title: 'Ошибка', description: 'Не удалось определить ID.' }); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramId: String(id), mode: 'check_preview_status', initData }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDemoMessage(data.error || 'Заявка не найдена');
        setTimeout(() => setDemoMessage(''), 3500);
        return;
      }
      localStorage.setItem('user_tg_id', String(id));
      if (data.previewStatus === 'confirmed' || data.previewStatus === 'active' || data.previewStatus === 'selecting') {
        localStorage.setItem('is_authed', 'true');
        onAuthenticated();
        return;
      }
      setDemoMessage('Заявка на рассмотрении — администратор скоро подтвердит доступ');
      setTimeout(() => setDemoMessage(''), 4500);
    } catch {
      toast({ variant: 'destructive', title: 'Ошибка', description: 'Проблемы с соединением' });
    } finally {
      setLoading(false);
    }
  };

  // Пока компонент не смонтирован (hydration), ничего не рендерим, чтобы избежать мерцаний
  if (!mounted) return null;

  const promoHint   = isLegacyPaidKey(key) ? null : detectFacultyByInput(key);
  const digitIcon   = promoHint?.digitIcon ?? getDefaultDigitIcon();
  const promoReady  = !!resolveFacultyPromoCode(key);
  const legacyReady = isLegacyPaidKey(key) && isPaidKeysEnabled;
  const canEnter    = promoReady || legacyReady;

  const inputBorder = focused
    ? promoHint?.id === 'stomatology'
      ? 'rgba(52, 211, 153, 0.45)'
      : promoHint?.id === 'therapeutic'
        ? 'rgba(96, 165, 250, 0.45)'
        : promoHint?.id === 'pediatrics'
          ? 'rgba(251, 191, 36, 0.45)'
          : 'hsl(var(--primary) / 0.4)'
    : promoHint
      ? promoHint.id === 'stomatology'
        ? 'rgba(52, 211, 153, 0.22)'
        : promoHint.id === 'therapeutic'
          ? 'rgba(96, 165, 250, 0.22)'
          : 'rgba(251, 191, 36, 0.22)'
      : 'rgba(255,255,255,0.08)';

  // ── ВИЗУАЛЬНАЯ ЧАСТЬ (RENDER) ───────────────────────────────────────────────
  return (
    // Главный контейнер. Темный, растянут на весь экран. Цвет фона - глубокий изумрудно-черный (#0A0E0C).
    <div
      className="dark flex flex-col items-center justify-center min-h-screen p-6 relative overflow-hidden pt-16"
      style={{ background: '#0A0E0C' }} 
    >
      {/* ── Окно Приветствия (Оверлей) ── */}
      {/* Показывается только один раз после успешного ввода ключа */}
      {showWelcome && (
        <div className="dark fixed inset-0 z-50 flex items-center justify-center p-6 backdrop-blur-xl animate-in fade-in zoom-in duration-300"
          style={{ background: 'rgba(10,14,12,0.85)' }}>
          <div className="w-full max-w-sm bg-[#121815] border border-white/10 p-8 rounded-[32px] shadow-2xl text-center space-y-6">
            <div className="inline-flex p-3 bg-primary/10 rounded-full text-primary">
              <Heart className="w-8 h-8 fill-primary/20" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight text-white">Рад тебя видеть!</h2>
              <p className="text-sm text-muted-foreground">Учись, исследуй, развивайся.</p>
            </div>
            <Button onClick={() => {
              localStorage.setItem('welcome_seen', 'true'); // Запоминаем, что юзер это уже видел
              setShowWelcome(false);
              onAuthenticated(); // Пускаем в приложение
            }} className="w-full h-14 rounded-2xl text-lg font-bold">Погнали!</Button>
          </div>
        </div>
      )}

      {/* ── Анимация Дождя из Зубов на заднем фоне ── */}
      <ToothRainBG />

      {/* ── Контейнер с контентом авторизации ── */}
      {/* z-10 поднимает этот блок над дождем зубов */}
      <div className="w-full max-w-sm flex flex-col items-center z-10">
        
        {/* ── Блок Логотипа и Заголовка ── */}
        <div className="mb-8 flex flex-col items-center space-y-4 text-center">
          {/* Контейнер иконки зуба с пульсацией и свечением */}
          <div
            className="w-20 h-20 rounded-[28px] flex items-center justify-center"
            style={{
              background: 'hsl(var(--primary) / 0.08)', // Полупрозрачный фон
              border: '1.5px solid hsl(var(--primary) / 0.2)', // Тонкая рамка
              animation: 'authToothPulse 2.5s ease-in-out infinite', // Анимация дыхания
              filter: 'drop-shadow(0 0 12px hsl(var(--primary) / 0.5))', // Неоновое свечение вокруг
            }}
          >
            <AuthLogoCycle />
          </div>
          
          <h1
            className="text-3xl font-bold tracking-tighter text-white select-none cursor-default"
            onClick={handleTitleClick} // Обработчик 6 тапов для сброса
          >
            OrthoByNekruz
          </h1>
          <p className="text-[13px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Подготовка к экзамену</p>
          
          {/* Режим отладки (если не удалось определить ID) */}
          {debugInfo && (
            <p className="text-[10px] text-white/20 font-mono break-all px-4">{debugInfo}</p>
          )}
        </div>

        {/* ── Карточка с полями ввода и кнопками ── */}
        {/* Если state `error` = true, добавляем класс 'auth-shake', чтобы карточка затряслась */}
        <div className={cn('w-full space-y-4', error && 'auth-shake')}>
          
          {/* Фон карточки: глухой темно-зеленый с эффектом размытия заднего фона */}
          <div className="space-y-4 bg-[#141A17]/80 p-6 rounded-[28px] border border-white/5 backdrop-blur-md shadow-2xl">

            {/* ── ПОЛЕ ВВОДА КЛЮЧА ── */}
            {/* Это кастомное поле. Настоящий <input> скрыт (opacity-0), а мы визуализируем то, что юзер ввел, с помощью эмодзи */}
            <div
              className="relative h-14 rounded-2xl flex items-center justify-center overflow-hidden cursor-text transition-colors"
              style={{
                background: 'rgba(255,255,255,0.03)', 
                border: `1px solid ${inputBorder}`,
              }}
            >
              {/* Placeholder: показываем текст, если поле пустое */}
              {key.length === 0 && (
                <span className="absolute text-[15px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  {lockoutTime > 0 ? `Подожди ${lockoutTime}с` : 'Введи код'}
                </span>
              )}
              
              <div className="flex gap-1 items-center z-10">
                {key.split('').map((_, i) => {
                  const dynamicSize = Math.max(20, 44 - (key.length * 3));
                  return (
                    <div 
                      key={i} 
                      style={{ 
                        animation: 'authToothSlideUp 0.2s ease forwards',
                        fontSize: `${dynamicSize}px`,
                        filter: 'drop-shadow(0 0 5px rgba(255, 255, 255, 0.49))',
                        transition: 'font-size 0.2s ease-in-out',
                        lineHeight: 1,
                      }}
                    >
                      {digitIcon}
                    </div>
                  );
                })}
              </div>
              
              <input
                value={key}
                onChange={e => setKey(e.target.value.replace(/\D/g, '').slice(0, MAX_INPUT_LENGTH))}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                disabled={loading || lockoutTime > 0}
                maxLength={8}
                inputMode="numeric"
                className="absolute inset-0 opacity-0 cursor-text"
                style={{ fontSize: 1 }}
              />
            </div>

            {/* ── РУЧНОЙ ВВОД TELEGRAM ID (Показывается, если скрипт не смог найти его сам) ── */}
            {idChecked && !autoTgId && (
              <Input
                type="text" inputMode="numeric"
                placeholder="Твой Telegram ID (числовой)"
                value={manualTgId}
                onChange={e => setManualTgId(e.target.value.replace(/\D/g, '').slice(0, 12))}
                className="h-14 text-center text-lg bg-background/40 border-white/10 rounded-2xl text-white animate-in slide-in-from-top-2"
              />
            )}

            {/* ── КНОПКА "ВОЙТИ" ── */}
            <button
              onClick={handleLoginClick}
              disabled={loading || lockoutTime > 0}
              className="w-full h-[52px] rounded-2xl text-[15px] font-medium transition-all duration-250 active:scale-[0.98] flex items-center justify-center gap-2"
              // СТИЛИ МЕНЯЮТСЯ, если введено 4 или больше символов (кнопка "загорается")
              style={canEnter ? {
                background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.8))',
                color: 'hsl(var(--primary-foreground))',
                boxShadow: '0 8px 24px hsl(var(--primary) / 0.3)',
              } : {
                background: 'hsl(var(--primary) / 0.12)',
                border: '1px solid transparent',
                color: 'hsl(var(--primary) / 0.85)',
              }}
            >
              {loading
                ? <Loader2 className="w-5 h-5 animate-spin" />
                : promoReady
                  ? `${digitIcon} Войти`
                  : promoHint && key.length > 0
                    ? digitIcon
                    : canEnter
                      ? 'Войти'
                      : 'Войти'}
            </button>

            <button
              onClick={handleCheckStatusClick}
              disabled={loading}
              className="w-full h-[44px] rounded-2xl text-[13px] font-medium transition-all mt-2"
              style={{
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.55)',
              }}
            >
              Проверить статус заявки
            </button>

            {/* ── БЛОК ОШИБКИ ДЕМО ── (Выезжает только если есть ошибка демо-режима) */}
            {demoMessage && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300 rounded-2xl p-4 text-center text-[14px]"
                style={{
                  background: 'rgba(220,38,38,0.15)', // Красный фон ошибки
                  border: '1px solid rgba(220,38,38,0.2)',
                  color: '#fca5a5',
                  animation: 'fadeInOut 4s ease forwards',
                }}>
                {demoMessage}
              </div>
            )}

            {/* ── БЛОК ОШИБКИ КЛЮЧА ── (Выезжает при неверном ключе) */}
            {errorMessage && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300 rounded-2xl p-4 text-center text-[14px]"
                style={{
                  background: 'rgba(220,38,38,0.15)',
                  border: '1px solid rgba(220,38,38,0.2)',
                  color: '#fca5a5',
                  animation: 'fadeInOut 4s ease forwards',
                }}>
                {errorMessage}
              </div>
            )}

            {/* ── ПРОСЬБА ПОДПИСАТЬСЯ ── */}
            {needsSubscription && (
              <p className="text-[10px] text-center text-destructive animate-pulse">
                Подпишись на{' '}
                <a
                  href="https://t.me/nzsdental"
                  target="_blank"
                  rel="noreferrer"
                  style={{ textDecoration: 'underline' }}
                >
                  @nzsdental
                </a>
                {' '}и попробуй снова
              </p>
            )}
          </div>

          {/* ── ССЫЛКА НА ТЕХПОДДЕРЖКУ (DM) ── */}
          <div className="text-center mt-6">
            <a href="https://t.me/evoeidos"
              className="inline-flex items-center text-sm font-medium transition-colors"
              style={{ color: 'hsl(var(--primary) / 0.8)' }}>
              Нужен ключ? DM @evoeidos <ExternalLink className="ml-1 w-4 h-4" />
            </a>
          </div>
          
        </div>
      </div>
    </div>
  );
};