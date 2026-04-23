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
  const searchParams = useSearchParams(); // пока не используется, но оставим
  const { toast } = useToast();

  const [key, setKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [lockoutTime, setLockoutTime] = useState(0);
  const [needsSubscription, setNeedsSubscription] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  // ref для блокировки повторных вызовов, пока идёт запрос
  const loadingRef = useRef(false);

  // Функция авторизации
  const handleAuth = useCallback(
    async (inputKey: string, inputTgId: string) => {
      // Блокируем запрос, если уже идёт загрузка, есть таймер блокировки или нет telegramId
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
          // Сохраняем факт авторизации
          window.localStorage.setItem('is_authed', 'true');
          window.localStorage.setItem('user_tg_id', String(inputTgId));

          // Проверяем, видел ли пользователь приветствие раньше
          const hasSeenWelcome = window.localStorage.getItem('welcome_seen');

          if (!hasSeenWelcome && inputKey !== '') {
            // Новый пользователь, вводивший ключ вручную — показываем приветствие,
            // но НЕ вызываем onAuthenticated до закрытия приветствия
            setShowWelcome(true);
          } else {
            // Пользователь уже видел приветствие или это авто-вход (inputKey пуст, но такой сценарий теперь не используется)
            onAuthenticated();
          }
        } else {
          // Обработка ошибок
          if (response.status === 403) {
            setNeedsSubscription(true);
          } else {
            // При ручном вводе ключа показываем ошибку и запускаем таймер
            if (inputKey !== '') {
              setLockoutTime(15);
              setError(true);
              toast({
                variant: 'destructive',
                title: 'Доступ ограничен',
                description: data.error || 'Неверный ключ',
              });
            }
          }
        }
      } catch (err) {
        // Ошибка сети или сервера — тост только при ручном вводе
        if (inputKey !== '') {
          toast({
            variant: 'destructive',
            title: 'Ошибка',
            description: 'Сервер недоступен. Попробуйте позже.',
          });
        }
      } finally {
        setLoading(false);
        loadingRef.current = false;
      }
    },
    [lockoutTime, onAuthenticated, toast]
  );

  // Закрытие приветственного окна
  const closeWelcome = useCallback(() => {
    window.localStorage.setItem('welcome_seen', 'true');
    setShowWelcome(false);
    // После приветствия пользователь считается полностью авторизованным
    onAuthenticated();
  }, [onAuthenticated]);

  // Таймер блокировки после неверных попыток
  useEffect(() => {
    if (lockoutTime > 0) {
      const timer = setInterval(() => {
        setLockoutTime((prev) => {
          if (prev <= 1) {
            setError(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [lockoutTime]);

  // Обработчик нажатия на кнопку входа
  const handleLoginClick = useCallback(() => {
    // Получаем объект Telegram WebApp
    const tg = (window as any).Telegram?.WebApp;
    const currentTgId = tg?.initDataUnsafe?.user?.id;

    if (!currentTgId) {
      // Явное уведомление, если ID не получен
      toast({
        variant: 'destructive',
        title: 'ID не найден',
        description:
          'Не удалось получить ваш Telegram ID. Убедитесь, что вы открыли приложение через бота.',
      });
      return;
    }

    handleAuth(key, String(currentTgId));
  }, [key, handleAuth, toast]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-background relative overflow-hidden">
      {/* Приветственное модальное окно */}
      {showWelcome && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-background/80 backdrop-blur-xl animate-in fade-in zoom-in duration-300">
          <div className="w-full max-w-sm bg-card border border-white/10 p-8 rounded-[32px] shadow-2xl text-center space-y-6">
            <div className="inline-flex p-3 bg-primary/10 rounded-full text-primary">
              <Heart className="w-8 h-8 fill-primary/20" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight text-white">Рад тебе!</h2>
              <p className="text-sm text-muted-foreground">
                Спасибо за доверие. Пользуйся, изучай, развивайся — ортопедия стала проще.
              </p>
            </div>
            <Button
              onClick={closeWelcome}
              className="w-full h-14 rounded-2xl text-lg font-bold"
            >
              Погнали!
            </Button>
          </div>
        </div>
      )}

      {/* Основной экран ввода ключа */}
      <div className="w-full max-w-sm flex flex-col items-center z-10">
        <div className="mb-8 flex flex-col items-center space-y-4">
          <ToothIcon
            className={cn(
              'w-16 h-16 text-primary transition-all',
              loading && 'animate-pulse'
            )}
          />
          <h1 className="text-3xl font-bold tracking-tighter text-white">
            OrthoByNekruz
          </h1>
        </div>

        <div className={cn('w-full space-y-4', error && 'animate-shake')}>
          <div className="space-y-4 bg-card/30 p-6 rounded-3xl border border-white/5 backdrop-blur-md shadow-2xl">
            <div className="space-y-4">
              <div className="relative">
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder={
                    lockoutTime > 0
                      ? `Подожди ${lockoutTime}с`
                      : 'Введите ключ'
                  }
                  value={key}
                  onChange={(e) => setKey(e.target.value.replace(/\D/g, ''))}
                  disabled={loading || lockoutTime > 0}
                  className="h-14 text-center text-2xl bg-background/40 border-white/10 rounded-2xl text-white tooth-input transition-all focus:border-primary/50"
                />
                {/* Визуальный эффект зубов поверх ввода */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none tracking-[0.4em] text-2xl">
                  {key.split('').map((_, i) => (
                    <span key={i} className="animate-in zoom-in duration-200">
                      🦷
                    </span>
                  ))}
                </div>
              </div>

              <Button
                onClick={handleLoginClick}
                disabled={loading || lockoutTime > 0 || key.length < 1}
                className="w-full h-14 bg-[#0088cc] hover:bg-[#0077b5] text-white font-bold rounded-2xl transition-all active:scale-95 shadow-lg shadow-[#0088cc]/20"
              >
                {loading ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  'Войти по Telegram'
                )}
              </Button>
            </div>

            {needsSubscription && (
              <p className="text-[10px] text-center text-destructive animate-pulse">
                Сначала активируй доступ у автора
              </p>
            )}
          </div>

          <div className="text-center">
            <a
              href="https://t.me/evoeidos"
              className="inline-flex items-center text-xs text-primary/60 hover:text-primary transition-colors"
            >
              Нужен ключ? Пиши мне @evoeidos{' '}
              <ExternalLink className="ml-1 w-3 h-3" />
            </a>
          </div>
        </div>
      </div>

      {/* Стиль для прозрачного текста в поле ввода */}
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