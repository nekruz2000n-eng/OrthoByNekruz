"use client";

import React, { useState, useEffect, useCallback } from 'react';
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

  const [key, setKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [lockoutTime, setLockoutTime] = useState(0);
  const [needsSubscription, setNeedsSubscription] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  // Основная функция авторизации
  const handleAuth = useCallback(async (inputKey: string, inputTgId: string) => {
    // Если нет ID или мы в процессе загрузки/блокировки — выходим
    if (loading || lockoutTime > 0 || !inputTgId) return;
    
    setLoading(true);
    setError(false);
    setNeedsSubscription(false);

    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: inputKey, telegramId: inputTgId }),
      });

      const data = await response.json();

      if (response.ok) {
        window.localStorage.setItem("is_authed", "true");
        window.localStorage.setItem("user_tg_id", inputTgId);
        
        const hasSeenWelcome = window.localStorage.getItem("welcome_seen");
        if (!hasSeenWelcome) {
          setShowWelcome(true);
        } else {
          onAuthenticated();
        }
      } else {
        // Если ошибка 403 (например, не подписан или ошибка привязки)
        if (response.status === 403) {
          setNeedsSubscription(true);
        } else {
          setLockoutTime(15); // Блокировка на 15 сек при неверном ключе
        }
        setError(true);
        toast({
          variant: "destructive",
          title: "Доступ ограничен",
          description: data.error || "Произошла ошибка"
        });
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Ошибка", description: "Сервер недоступен" });
    } finally {
      setLoading(false);
    }
  }, [loading, lockoutTime, toast, onAuthenticated]);

  // 1. Автоматический вход при открытии (если ID уже в базе)
  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    const tgId = tg?.initDataUnsafe?.user?.id;
    
    if (tgId) {
      // Пробуем войти автоматически по ID (без ключа)
      handleAuth("", String(tgId));
    }
  }, []); // Только при первом запуске

  // 2. Таймер блокировки
  useEffect(() => {
    if (lockoutTime > 0) {
      const timer = setInterval(() => setLockoutTime(prev => prev - 1), 1000);
      return () => clearInterval(timer);
    }
  }, [lockoutTime]);

  // 3. Обработка ключа из ссылки (если прислали ссылку вида ?key=XXX&tgid=YYY)
  useEffect(() => {
    if (!searchParams) return;
    const urlKey = searchParams.get('key');
    const urlTgId = searchParams.get('tgid');
    if (urlKey && urlTgId && lockoutTime === 0) {
      handleAuth(urlKey, urlTgId);
    }
  }, [searchParams, lockoutTime, handleAuth]);

  const closeWelcome = () => {
    window.localStorage.setItem("welcome_seen", "true");
    setShowWelcome(false);
    onAuthenticated();
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-background relative overflow-hidden">
      {/* Экран приветствия */}
      {showWelcome && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-background/80 backdrop-blur-xl animate-in fade-in zoom-in duration-300">
          <div className="w-full max-w-sm bg-card border border-white/10 p-8 rounded-[32px] shadow-2xl text-center space-y-6">
            <div className="inline-flex p-3 bg-primary/10 rounded-full text-primary">
              <Heart className="w-8 h-8 fill-primary/20" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight text-white">Рад тебе!</h2>
              <p className="text-sm text-muted-foreground">
                Спасибо за доверие. Пользуйся, изучай, развивайся — всё это сделано для того, чтобы ортопедия стала проще.
              </p>
            </div>
            <Button onClick={closeWelcome} className="w-full h-14 rounded-2xl text-lg font-bold">
              Погнали!
            </Button>
          </div>
        </div>
      )}

      <div className="w-full max-w-sm flex flex-col items-center z-10">
        <div className="mb-8 flex flex-col items-center space-y-4">
          <ToothIcon className={cn("w-16 h-16 text-primary transition-all", loading && "animate-pulse")} />
          <h1 className="text-3xl font-bold tracking-tighter text-white">OrthoByNekruz</h1>
        </div>

        <div className={cn("w-full space-y-4", error && "animate-shake")}>
          <div className="space-y-4 bg-card/30 p-6 rounded-3xl border border-white/5 backdrop-blur-md shadow-2xl">
            
            <div className="space-y-4">
              <div className="relative">
                <Input
  type="text"
  placeholder={lockoutTime > 0 ? `Подожди ${lockoutTime}с` : "Введите ключ (если впервые)"}
  value={key}
  onChange={(e) => setKey(e.target.value)}
  disabled={loading || lockoutTime > 0}
  style={{
    // @ts-ignore
    WebkitTextSecurity: 'disc', // Маскировка ввода под точки
  }}
  className="h-12 text-center text-lg bg-background/40 border-white/10 rounded-xl text-white placeholder:text-xs"
/>
                <span className="absolute left-4 top-1/2 -translate-y-1/2 opacity-50">🦷</span>
              </div>

              <Button 
                onClick={() => {
                  const tg = (window as any).Telegram?.WebApp;
                  const currentTgId = tg?.initDataUnsafe?.user?.id;
                  handleAuth(key, String(currentTgId || ""));
                }}
                disabled={loading || lockoutTime > 0}
                className="w-full bg-[#0088cc] hover:bg-[#0077b5] text-white font-bold py-6 rounded-2xl transition-all active:scale-95 shadow-lg shadow-[#0088cc]/20"
              >
                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Войти по Telegram"}
              </Button>
            </div>

            {needsSubscription && (
              <p className="text-[10px] text-center text-muted-foreground animate-pulse">
                Сначала активируй доступ у автора
              </p>
            )}
          </div>

          <div className="text-center space-y-2">
            <a 
              href="https://t.me/evoeidos" 
              target="_blank" 
              rel="noreferrer"
              className="flex items-center justify-center text-xs text-primary/60 hover:text-primary transition-colors"
            >
              Нужен ключ? Пиши мне @evoeidos <ExternalLink className="ml-1 w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};