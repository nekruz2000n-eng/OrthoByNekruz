"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ToothIcon } from './ToothIcon';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ExternalLink, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';

export const AuthScreen = ({ onAuthenticated }: { onAuthenticated: () => void }) => {
  const { toast } = useToast();

  // ---------- СОСТОЯНИЯ ----------
  const [key, setKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [lockoutTime, setLockoutTime] = useState(0);
  const [needsSubscription, setNeedsSubscription] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [manualTgId, setManualTgId] = useState('');
  const [autoTgId, setAutoTgId] = useState<string | null>(null);
  const [idChecked, setIdChecked] = useState(false);

  // ---------- АВТООПРЕДЕЛЕНИЕ TELEGRAM ID (повторные попытки) ----------
  const maxAttempts = 20;          // всего попыток
  const attemptInterval = 300;     // интервал 500 мс (итого 5 секунд)
  const [idCheckAttempts, setIdCheckAttempts] = useState(0);

  useEffect(() => {
  if (autoTgId !== null || idCheckAttempts >= 20) {
    setIdChecked(true);
    return;
  }

  const timer = setTimeout(() => {
    const tg = (window as any).Telegram?.WebApp;
    
    if (tg) {
      tg.ready();
      
      // Попытка 1: Через стандартный объект
      let id = tg.initDataUnsafe?.user?.id;

      // Попытка 2: Парсим сырую строку (иногда объект пуст, а строка полная)
      if (!id && tg.initData) {
        const searchParams = new URLSearchParams(tg.initData);
        const userStr = searchParams.get('user');
        if (userStr) {
          try {
            const userObj = JSON.parse(userStr);
            id = userObj.id;
          } catch (e) {}
        }
      }

      if (id) {
        setAutoTgId(String(id));
        setIdChecked(true);
      } else {
        setIdCheckAttempts(prev => prev + 1);
      }
    } else {
      setIdCheckAttempts(prev => prev + 1);
    }
  }, 500);

  return () => clearTimeout(timer);
}, [autoTgId, idCheckAttempts]);

  const isInitializing = !idChecked; // идёт ли проверка авто-ID

  // --- СКРЫТЫЙ СБРОС (6 касаний по заголовку) ---
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTitleClick = useCallback(() => {
    tapCountRef.current += 1;
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    if (tapCountRef.current >= 6) {
      localStorage.clear();
      toast({ title: 'Session reset', description: 'Storage cleared.' });
      setTimeout(() => window.location.reload(), 500);
      tapCountRef.current = 0;
    } else {
      tapTimerRef.current = setTimeout(() => { tapCountRef.current = 0; }, 2000);
    }
  }, [toast]);

  // -------- ОСНОВНАЯ ФУНКЦИЯ АВТОРИЗАЦИИ ----------
  const handleAuth = useCallback(
    async (inputKey: string, inputTgId: string) => {
      if (loading || lockoutTime > 0 || !inputTgId) return;

      setLoading(true);
      setError(false);
      setNeedsSubscription(false);

      try {
        const response = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: inputKey.trim(), telegramId: String(inputTgId) }),
        });

        const data = await response.json();

        if (response.ok) {
          localStorage.setItem('is_authed', 'true');
          localStorage.setItem('user_tg_id', String(inputTgId));

          if (!localStorage.getItem('welcome_seen') && inputKey !== '') {
            setShowWelcome(true);
          } else {
            onAuthenticated();
          }
        } else {
          if (response.status === 403) {
            setNeedsSubscription(true);
          } else if (inputKey !== '') {
            setLockoutTime(15);
            setError(true);
            toast({ variant: 'destructive', title: 'Access denied', description: data.error || 'Invalid key' });
          }
        }
      } catch (err) {
        toast({ variant: 'destructive', title: 'Error', description: 'Server unavailable' });
      } finally {
        setLoading(false);
      }
    },
    [loading, lockoutTime, onAuthenticated, toast]
  );

  const handleLoginClick = () => {
    const currentTgId = autoTgId || manualTgId.trim();
    if (!currentTgId) {
      toast({ variant: 'destructive', title: 'ID not found', description: 'Enter ID manually' });
      return;
    }
    handleAuth(key, currentTgId);
  };

  // -------- ДЕМО РЕЖИМ (запрос к серверу) ----------
  const handleDemoClick = async () => {
    const tg = (window as any).Telegram?.WebApp;
    const currentTgId = tg?.initDataUnsafe?.user?.id || autoTgId || manualTgId;

    if (!currentTgId) {
      toast({ variant: 'destructive', title: 'Ошибка', description: 'Не удалось определить ID. Попробуйте запустить через бота.' });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramId: String(currentTgId), mode: 'check_demo' }),
      });
      const data = await response.json();

      if (data.success) {
        // Критически важно: ставим флаги ПЕРЕД вызовом onAuthenticated
        localStorage.setItem('is_authed', 'true');
        localStorage.setItem('demo_mode', 'true');
        localStorage.setItem('demo_start', String(Date.now()));
        localStorage.setItem('user_tg_id', String(currentTgId));
        onAuthenticated();
      } else {
        toast({ variant: 'destructive', title: 'Демо недоступно', description: data.message || 'Вы уже использовали пробный период.' });
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Ошибка', description: 'Проблемы с соединением' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-background relative overflow-hidden">
      {showWelcome && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-background/80 backdrop-blur-xl animate-in fade-in zoom-in duration-300">
          <div className="w-full max-w-sm bg-card border border-white/10 p-8 rounded-[32px] shadow-2xl text-center space-y-6">
            <div className="inline-flex p-3 bg-primary/10 rounded-full text-primary">
              <Heart className="w-8 h-8 fill-primary/20" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight text-white">Рад тебя видеть!</h2>
              <p className="text-sm text-muted-foreground">Учись, исследуй, развивайся — тут всё, чтобы ты сдал ортопедию.</p>
            </div>
            <Button onClick={() => { localStorage.setItem('welcome_seen', 'true'); setShowWelcome(false); onAuthenticated(); }} className="w-full h-14 rounded-2xl text-lg font-bold">Погнали!</Button>
          </div>
        </div>
      )}

      <div className="w-full max-w-sm flex flex-col items-center z-10">
        <div className="mb-8 flex flex-col items-center space-y-4">
          <ToothIcon className={cn("w-16 h-16 text-primary transition-all", loading && "animate-pulse")} />
          <h1 className="text-3xl font-bold tracking-tighter text-white select-none cursor-default" onClick={handleTitleClick}>OrthoByNekruz</h1>
        </div>

        <div className={cn("w-full space-y-4", error && "animate-shake")}>
          <div className="space-y-4 bg-card/30 p-6 rounded-3xl border border-white/5 backdrop-blur-md shadow-2xl">
            <div className="relative">
              <Input
                type="text"
                inputMode="numeric"
                maxLength={8}
                placeholder={lockoutTime > 0 ? `Wait ${lockoutTime}s` : "Enter key"}
                value={key}
                onChange={(e) => setKey(e.target.value.replace(/\D/g, ''))}
                disabled={loading || lockoutTime > 0}
                className="h-14 text-center text-2xl bg-background/40 border-white/10 rounded-2xl text-white tooth-input focus:border-primary/50"
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none tracking-[0.3em] text-xl">
                {key.split('').map((_, i) => <span key={i} className="animate-in zoom-in duration-200">🦷</span>)}
              </div>
            </div>

            {idChecked && !autoTgId && (
              <Input
                type="text"
                inputMode="numeric"
                placeholder="Твой Telegram ID"
                value={manualTgId}
                onChange={(e) => setManualTgId(e.target.value.replace(/\D/g, ''))}
                className="h-14 text-center text-lg bg-background/40 border-white/10 rounded-2xl text-white"
              />
            )}

            <Button
              onClick={handleLoginClick}
              disabled={loading || lockoutTime > 0 || key.length < 1 || (!autoTgId && !manualTgId.trim())}
              className="w-full h-14 bg-[#0088cc] hover:bg-[#0077b5] text-white font-bold rounded-2xl"
            >
              {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Sign in with Telegram"}
            </Button>

            <Button
              variant="outline"
              disabled={loading}
              className="w-full h-12 rounded-xl border-primary/30 text-primary/80 hover:bg-primary/10"
              onClick={handleDemoClick}
            >
              Попробовать демо (1 мин)
            </Button>

            {needsSubscription && <p className="text-[10px] text-center text-destructive animate-pulse">Subscribe to @nzsdental and try again</p>}
          </div>
          <div className="text-center">
            <a href="https://t.me/evoeidos" className="inline-flex items-center text-xs text-primary/60 hover:text-primary transition-colors">
              Нужен ключ ? DM @evoeidos <ExternalLink className="ml-1 w-3 h-3" />
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