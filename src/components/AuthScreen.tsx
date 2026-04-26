"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { ToothIcon } from './ToothIcon';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ExternalLink, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';

export const AuthScreen = ({ onAuthenticated }: { onAuthenticated: () => void }) => {
  const searchParams = useSearchParams();
  const { toast } = useToast();

  // ---------- СОСТОЯНИЯ ----------
  const [key, setKey] = useState('');                     // введённый ключ активации
  const [loading, setLoading] = useState(false);          // флаг загрузки запроса
  const [error, setError] = useState(false);              // флаг ошибки (для анимации)
  const [lockoutTime, setLockoutTime] = useState(0);      // таймер блокировки после неверных попыток
  const [needsSubscription, setNeedsSubscription] = useState(false); // требуется подписка на канал
  const [showWelcome, setShowWelcome] = useState(false);  // показывать ли приветственное окно
  const [manualTgId, setManualTgId] = useState('');       // ID, введённый вручную
  const [autoTgId, setAutoTgId] = useState<string | null>(null); // ID, полученный автоматически
  const [idChecked, setIdChecked] = useState(false);      // завершена ли проверка авто-ID

  // ---------- УЛУЧШЕННОЕ АВТООПРЕДЕЛЕНИЕ TELEGRAM ID (повторные попытки) ----------
  const maxAttempts = 10;          // всего попыток
  const attemptInterval = 500;     // интервал 500 мс (итого 5 секунд)
  const [idCheckAttempts, setIdCheckAttempts] = useState(0);

  useEffect(() => {
    // Если ID уже найден или попытки кончились — останавливаемся
    if (autoTgId !== null || idCheckAttempts >= maxAttempts) {
      setIdChecked(true);
      return;
    }

    const timer = setTimeout(() => {
      const tg = (window as any).Telegram?.WebApp;
      const id = tg?.initDataUnsafe?.user?.id;
      if (id) {
        setAutoTgId(String(id));
      } else {
        setIdCheckAttempts(prev => prev + 1);
      }
    }, attemptInterval);

    return () => clearTimeout(timer);
  }, [autoTgId, idCheckAttempts]);

  // Пока идёт проверка, считаем что инициализируемся
  const isInitializing = !idChecked;
  // --------------------------------------------------------

  // Ref'ы для блокировки повторных запросов
  const loadingRef = useRef(false);

  // --- СКРЫТЫЙ СБРОС СЕССИИ (6 быстрых касаний по заголовку) ---
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTitleClick = useCallback(() => {
    if (typeof window === 'undefined') return;
    tapCountRef.current += 1;
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);

    if (tapCountRef.current >= 6) {
      localStorage.removeItem('is_authed');
      localStorage.removeItem('user_tg_id');
      localStorage.removeItem('welcome_seen');
      toast({
        title: 'Session reset',
        description: 'Local storage cleared. Reloading...',
      });
      setTimeout(() => window.location.reload(), 500);
      tapCountRef.current = 0;
    } else {
      tapTimerRef.current = setTimeout(() => {
        tapCountRef.current = 0;
      }, 2000); // 2 секунды на 6 нажатий
    }
  }, [toast]);
  // --------------------------------------------------------

  // -------- ОСНОВНАЯ ФУНКЦИЯ АВТОРИЗАЦИИ ----------
  const handleAuth = useCallback(
    async (inputKey: string, inputTgId: string) => {
      if (loadingRef.current || lockoutTime > 0 || !inputTgId) return;

      loadingRef.current = true;
      setLoading(true);
      setError(false);
      setNeedsSubscription(false);

      try {
        const response = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key: inputKey.trim(),
            telegramId: String(inputTgId),
          }),
        });

        const data = await response.json();

        if (response.ok) {
          window.localStorage.setItem('is_authed', 'true');
          window.localStorage.setItem('user_tg_id', String(inputTgId));

          const hasSeenWelcome = window.localStorage.getItem('welcome_seen');
          if (!hasSeenWelcome && inputKey !== '') {
            setShowWelcome(true);
          } else {
            onAuthenticated();
          }
        } else {
          if (response.status === 403) {
            setNeedsSubscription(true);
          } else {
            if (inputKey !== '') {
              setLockoutTime(15);
              setError(true);
              toast({
                variant: 'destructive',
                title: 'Access denied',
                description: data.error || 'Invalid key',
              });
            }
          }
        }
      } catch (err) {
        if (inputKey !== '') {
          toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Server unavailable',
          });
        }
      } finally {
        setLoading(false);
        loadingRef.current = false;
      }
    },
    [lockoutTime, onAuthenticated, toast]
  );

  // -------- ЗАКРЫТИЕ ПРИВЕТСТВЕННОГО ОКНА ----------
  const closeWelcome = useCallback(() => {
    window.localStorage.setItem('welcome_seen', 'true');
    setShowWelcome(false);
    onAuthenticated();
  }, [onAuthenticated]);

  // -------- ТАЙМЕР БЛОКИРОВКИ ----------
  useEffect(() => {
    if (lockoutTime > 0) {
      const timer = setInterval(() => setLockoutTime(prev => prev - 1), 1000);
      return () => clearInterval(timer);
    }
  }, [lockoutTime]);

  // -------- ОБРАБОТЧИК НАЖАТИЯ НА КНОПКУ ВХОДА ----------
  const handleLoginClick = useCallback(() => {
    const currentTgId = autoTgId || manualTgId.trim();

    if (!currentTgId) {
      toast({
        variant: 'destructive',
        title: 'ID not found',
        description: 'Enter your Telegram ID manually.',
      });
      return;
    }

    if (!autoTgId && manualTgId.trim()) {
      window.localStorage.setItem('user_tg_id', manualTgId.trim());
    }

    handleAuth(key, currentTgId);
  }, [key, handleAuth, toast, autoTgId, manualTgId]);

  // -------- АВТОМАТИЧЕСКИЙ ВХОД ПРИ СОХРАНЁННОЙ СЕССИИ ----------
  useEffect(() => {
    const authed = localStorage.getItem('is_authed') === 'true';
    if (authed && onAuthenticated) {
      onAuthenticated();
    }
  }, [onAuthenticated]);

  // ========== РЕНДЕР ==========
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-background relative overflow-hidden">
      {/* ПРИВЕТСТВЕННОЕ ОКНО */}
      {showWelcome && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-background/80 backdrop-blur-xl animate-in fade-in zoom-in duration-300">
          <div className="w-full max-w-sm bg-card border border-white/10 p-8 rounded-[32px] shadow-2xl text-center space-y-6">
            <div className="inline-flex p-3 bg-primary/10 rounded-full text-primary">
              <Heart className="w-8 h-8 fill-primary/20" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight text-white">Рад тебя видеть!</h2>
              <p className="text-sm text-muted-foreground">
                Спасибо за доверие. Учись, исследуй, развивайся — тут всё чтоб ты сдал ортопедию. 
                В каждом разделе есть заметки — сохраняй важное лично для себя. 
                Если заметишь баг или неточность в тестах, или идеи какие-то знаешь кому писать, всё починим.
              </p>
            </div>
            <Button onClick={closeWelcome} className="w-full h-14 rounded-2xl text-lg font-bold">
              Погнали!
            </Button>
          </div>
        </div>
      )}

      {/* ОСНОВНОЙ ЭКРАН ВВОДА */}
      <div className="w-full max-w-sm flex flex-col items-center z-10">
        <div className="mb-8 flex flex-col items-center space-y-4">
          <ToothIcon className={cn("w-16 h-16 text-primary transition-all", loading && "animate-pulse")} />
          <h1
            className="text-3xl font-bold tracking-tighter text-white select-none cursor-default"
            onClick={handleTitleClick}
          >
            OrthoByNekruz
          </h1>
        </div>

        <div className={cn("w-full space-y-4", error && "animate-shake")}>
          <div className="space-y-4 bg-card/30 p-6 rounded-3xl border border-white/5 backdrop-blur-md shadow-2xl">
            <div className="space-y-4">
              {/* Поле ввода ключа */}
              <div className="relative">
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={8}
                  placeholder={lockoutTime > 0 ? `Wait ${lockoutTime}s` : "Enter key"}
                  value={key}
                  onChange={(e) => setKey(e.target.value.replace(/\D/g, ''))}
                  disabled={loading || lockoutTime > 0}
                  className="h-14 text-center text-2xl bg-background/40 border-white/10 rounded-2xl text-white tooth-input transition-all focus:border-primary/50"
                />
                {/* Адаптивные иконки зубов */}
                {(() => {
                  const iconSizeClass =
                    key.length <= 4 ? 'text-2xl' :
                    key.length <= 6 ? 'text-xl' :
                    'text-lg';
                  const iconTrackingClass =
                    key.length <= 4 ? 'tracking-[0.4em]' :
                    key.length <= 6 ? 'tracking-[0.3em]' :
                    'tracking-[0.2em]';
                  return (
                    <div className={`absolute inset-0 flex items-center justify-center pointer-events-none ${iconTrackingClass} ${iconSizeClass}`}>
                      {key.split('').map((_, i) => (
                        <span key={i} className="animate-in zoom-in duration-200">🦷</span>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Блок определения Telegram ID */}
              {isInitializing && (
                <p className="text-xs text-white/50 text-center">Initializing...</p>
              )}

              {idChecked && !autoTgId && (
                <div className="space-y-2">
                  <p className="text-sm text-red-400 text-center">
                    Не удалось получить ID автоматически.
                  </p>
                  <p className="text-xs text-muted-foreground text-center">
                    Узнай свой ID у бота <strong>@userinfobot</strong> и введи его вручную.
                  </p>
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="Твой Telegram ID"
                    value={manualTgId}
                    onChange={(e) => setManualTgId(e.target.value.replace(/\D/g, ''))}
                    disabled={loading || lockoutTime > 0}
                    className="h-14 text-center text-lg bg-background/40 border-white/10 rounded-2xl text-white transition-all focus:border-primary/50"
                  />
                </div>
              )}

              {idChecked && autoTgId && (
                <p className="text-xs text-emerald-400 text-center">Telegram ID detected</p>
              )}

              {/* Кнопка входа */}
              <Button
                onClick={handleLoginClick}
                disabled={loading || lockoutTime > 0 || key.length < 1 || (!autoTgId && !manualTgId.trim())}
                className="w-full h-14 bg-[#0088cc] hover:bg-[#0077b5] text-white font-bold rounded-2xl transition-all active:scale-95 shadow-lg shadow-[#0088cc]/20"
              >
                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Sign in with Telegram"}
              </Button>
              <Button
  variant="outline"
  className="w-full h-12 rounded-xl border-primary/30 text-primary/80 hover:bg-primary/10"
  onClick={async () => {
    const tg = (window as any).Telegram?.WebApp;
    const currentTgId = tg?.initDataUnsafe?.user?.id;

    if (!currentTgId) {
      toast({ variant: 'destructive', title: 'Ошибка', description: 'Не удалось определить Telegram ID. Откройте приложение через бота.' });
      return;
    }

    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramId: String(currentTgId), mode: 'check_demo' }),
      });
      const data = await response.json();

      if (!data.success) {
        toast({ variant: 'destructive', title: 'Демо недоступно', description: data.message || 'Вы уже использовали пробный период.' });
        return;
      }

      localStorage.setItem('demo_mode', 'true');
      localStorage.setItem('demo_start', String(Date.now()));
      onAuthenticated();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Ошибка', description: 'Сервер недоступен.' });
    }
  }}
>
  Попробовать демо (4 мин)
</Button>
            </div>

            {needsSubscription && (
              <p className="text-[10px] text-center text-destructive animate-pulse">
                Subscribe to @nzsdental and try again
              </p>
            )}
          </div>

          <div className="text-center">
            <a
              href="https://t.me/evoeidos"
              className="inline-flex items-center text-xs text-primary/60 hover:text-primary transition-colors"
            >
              Need a key? DM @evoeidos <ExternalLink className="ml-1 w-3 h-3" />
            </a>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .tooth-input {
          color: transparent !important;
          text-shadow: 0 0 0 transparent !important;
          caret-color: white !important;
        }
      `}</style>
    </div>
  );
};