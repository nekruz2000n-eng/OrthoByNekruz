"use client"; // Указывает Next.js, что этот компонент должен выполняться на стороне клиента (в браузере), так как тут есть хуки состояния (useState, useEffect).

// ─── ИМПОРТЫ ─────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Input } from '@/components/ui/input'; // Компонент поля ввода (из библиотеки shadcn/ui)
import { Button } from '@/components/ui/button'; // Компонент кнопки (из библиотеки shadcn/ui)
import { useToast } from '@/hooks/use-toast'; // Хук для показа всплывающих уведомлений (тостов)
import { Loader2, ExternalLink, Heart } from 'lucide-react'; // Иконки из библиотеки lucide-react
import { cn } from '@/lib/utils';
import { PREVIEW_AWAITING_CONFIRM_KEY } from '@/components/AccessWelcomeOverlay';
import {
  detectFacultyByInput,
  resolveFacultyPromoCode,
  MAX_INPUT_LENGTH,
  getDefaultDigitIcon,
  isLegacyPaidKey,
  FACULTY_PROMOS,
  EMOJI_FONT_STACK,
  persistFacultyId,
  persistFacultyFromAccessCode,
} from '@/lib/facultyCodes';

type FacultyVariant = 'tooth' | 'stethoscope' | 'pediatrics';

const LOGO_PHASES: FacultyVariant[] = ['tooth', 'stethoscope', 'pediatrics'];

function syncFacultyAfterAuth(data: { facultyId?: string | null }, accessCode: string) {
  if (data?.facultyId) persistFacultyId(String(data.facultyId));
  else if (accessCode.trim()) persistFacultyFromAccessCode(accessCode.trim());
}

/** Те же эмодзи, что в поле ввода кода (3950 / 5016 / 2314) */
const FACULTY_EMOJI: Record<FacultyVariant, string> = {
  tooth:         FACULTY_PROMOS.find(p => p.id === 'stomatology')!.digitIcon,
  stethoscope:   FACULTY_PROMOS.find(p => p.id === 'therapeutic')!.digitIcon,
  pediatrics:    FACULTY_PROMOS.find(p => p.id === 'pediatrics')!.digitIcon,
};

/** Эмодзи в дожде — как в поле ввода (статичный div, без blur) */
const FallingFacultyEmoji = ({
  emoji,
  size,
  fallStyle,
  blurPx,
}: {
  emoji: string;
  size: number;
  fallStyle: React.CSSProperties;
  blurPx: number;
}) => (
  <div
    aria-hidden
    style={{
      ...fallStyle,
      width: size,
      height: size,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: size * 0.92,
      lineHeight: 1,
      fontFamily: EMOJI_FONT_STACK,
      userSelect: 'none',
      filter: blurPx
        ? `blur(${blurPx}px) drop-shadow(0 0 6px rgba(255,255,255,0.5))`
        : 'drop-shadow(0 0 6px rgba(255,255,255,0.5))',
    }}
  >
    {emoji}
  </div>
);

const FallingFacultyParticle = ({
  variant,
  size,
  fallStyle,
  blurPx,
}: {
  variant: FacultyVariant;
  size: number;
  fallStyle: React.CSSProperties;
  blurPx: number;
}) => (
  <FallingFacultyEmoji
    emoji={FACULTY_EMOJI[variant]}
    size={size}
    fallStyle={fallStyle}
    blurPx={blurPx}
  />
);

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
      <span
        className="leading-none select-none"
        style={{
          fontSize: 44,
          fontFamily: EMOJI_FONT_STACK,
          filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.35))',
        }}
        aria-hidden
      >
        {FACULTY_EMOJI[LOGO_PHASES[phase]]}
      </span>
    </div>
  );
};

const RAIN_CYCLE: FacultyVariant[] = ['tooth', 'stethoscope', 'pediatrics'];

function buildRainParticles() {
  const background = Array.from({ length: 18 }, (_, i) => ({
    id: `bg-${i}`,
    variant: RAIN_CYCLE[i % 3],
    left: (i * 27) % 100,
    size: 12 + ((i * 11) % 20),
    dur: 10 + ((i * 5) % 6),
    delay: (i * 0.9) % 7,
    blur: 1.5,
    maxOpacity: 0.15,
    swayDir: i % 2 === 0 ? 1 : -1,
    isForeground: false,
  }));

  const foreground = Array.from({ length: 12 }, (_, i) => ({
    id: `fg-${i}`,
    variant: RAIN_CYCLE[(i + 1) % 3],
    left: (i * 19 + 11) % 94,
    size: 28 + ((i * 4) % 14),
    dur: 5 + ((i * 2) % 4) * 0.6,
    delay: (i * 0.65) % 6,
    blur: 0,
    maxOpacity: 0.44,
    swayDir: i % 2 === 0 ? -1 : 1,
    isForeground: true,
  }));

  return [...background, ...foreground];
}

// ─── КОМПОНЕНТ ФОНА: ПАДАЮЩИЕ ИКОНКИ ФАКУЛЬТЕТОВ ───────────────────────────
const ToothRainBG = () => {
  const teeth = buildRainParticles();

  return (
    // Обертка на весь экран (absolute inset-0). pointer-events-none делает так, чтобы зубы не перекрывали клики по кнопкам.
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      
      {/* Глобальные стили для анимаций именно этой страницы */}
      <style>{`
        /* Анимация 3D падения зубов */
        @keyframes toothFall3D {
          0% {
            transform: translateY(-50px) rotate(calc(-16deg * var(--sway))) translateX(0px);
            opacity: 0;
          }
          15% { opacity: var(--max-op); }
          50% {
            transform: translateY(52vh) rotate(calc(12deg * var(--sway))) translateX(calc(14px * var(--sway)));
            opacity: var(--max-op);
          }
          85% { opacity: var(--max-op); }
          100% {
            transform: translateY(110vh) rotate(calc(-10deg * var(--sway))) translateX(calc(22px * var(--sway)));
            opacity: 0;
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
          zIndex: t.isForeground ? 2 : 0,
          animation: `toothFall3D ${t.dur}s ${t.delay}s linear infinite`,
          '--max-op': t.maxOpacity,
          '--sway': t.swayDir,
        } as React.CSSProperties;

        return (
          <FallingFacultyParticle
            key={t.id}
            variant={t.variant}
            size={t.size}
            fallStyle={fallStyle}
            blurPx={t.blur}
          />
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
            syncFacultyAfterAuth(data, '');
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
        syncFacultyAfterAuth(data, inputKey);
        if (data.alreadyConfirmed) {
          toast({
            title: 'Доступ уже открыт',
            description: 'Код факультета сохранён — можно продолжать.',
          });
        }
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
          syncFacultyAfterAuth(data, inputKey);
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
      const confirmed = data.previewStatus === 'confirmed'
        || (data.previewConfirmedAt && !data.previewStatus);
      if (confirmed || data.previewStatus === 'active' || data.previewStatus === 'selecting') {
        localStorage.setItem('is_authed', 'true');
        if (confirmed && data.previewChosenSubject) {
          localStorage.setItem(PREVIEW_AWAITING_CONFIRM_KEY, '1');
        }
        syncFacultyAfterAuth(data, key);
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
            ByNekruz
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