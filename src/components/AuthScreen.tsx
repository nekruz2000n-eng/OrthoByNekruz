"use client";

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { ToothIcon } from './ToothIcon';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ExternalLink, ShieldAlert, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';

export const AuthScreen = ({ onAuthenticated }: { onAuthenticated: () => void }) => {
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [key, setKey] = useState('');
  const [tgId, setTgId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [lockoutTime, setLockoutTime] = useState(0);
  
  // Состояние для приветственного окна
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    if (lockoutTime > 0) {
      const timer = setInterval(() => setLockoutTime(prev => prev - 1), 1000);
      return () => clearInterval(timer);
    }
  }, [lockoutTime]);

  useEffect(() => {
    const urlKey = searchParams.get('key');
    const urlTgId = searchParams.get('tgid');
    if (urlKey) setKey(urlKey);
    if (urlTgId) setTgId(urlTgId);

    if (urlKey && urlTgId && lockoutTime === 0) {
      handleAuth(urlKey, urlTgId);
    }
  }, [searchParams]);

  const handleAuth = async (inputKey: string, inputTgId: string) => {
    if (loading || lockoutTime > 0 || !inputKey || !inputTgId) return;
    setLoading(true);
    setError(false);

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
        
        // ПРОВЕРКА: Первый ли это вход?
        const hasSeenWelcome = window.localStorage.getItem("welcome_seen");
        if (!hasSeenWelcome) {
          setShowWelcome(true);
        } else {
          onAuthenticated();
        }
      } else {
        setError(true);
        setLockoutTime(30); // Упростил для примера до 30с
        toast({ variant: "destructive", title: "Доступ отклонен", description: data.error });
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Ошибка", description: "Сервер недоступен" });
    } finally {
      setLoading(false);
    }
  };

  const closeWelcome = () => {
    window.localStorage.setItem("welcome_seen", "true");
    setShowWelcome(false);
    onAuthenticated(); // Пускаем в приложение
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-background relative overflow-hidden">
      
      {/* ПРИВЕТСТВЕННОЕ ОКНО (МОДАЛКА) */}
      {showWelcome && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-background/80 backdrop-blur-xl animate-in fade-in zoom-in duration-300">
          <div className="w-full max-w-sm bg-card border border-white/10 p-8 rounded-[32px] shadow-2xl text-center space-y-6">
            <div className="inline-flex p-3 bg-primary/10 rounded-full text-primary">
              <Heart className="w-8 h-8 fill-primary/20" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight">Рад тебе!</h2>
              <div className="text-sm text-muted-foreground leading-relaxed space-y-4">
                <p>Спасибо за доверие. Пользуйся, изучай, развивайся — всё это сделано для того, чтобы ортопедия стала проще.</p>
                <p>Если вдруг наткнешься на баг, или заметишь, что в тестах или задачах чего-то не хватает (ну, ошибки там или неточности), не молчи. Пиши мне сразу, ты знаешь, где меня найти.</p>
              </div>
            </div>
            <Button onClick={closeWelcome} className="w-full h-14 rounded-2xl text-lg font-bold">
              Погнали!
            </Button>
          </div>
        </div>
      )}

      {/* ОСНОВНОЙ ЭКРАН ВХОДА (тот же код, что был ранее) */}
      <div className="w-full max-w-sm flex flex-col items-center">
        <div className="mb-8 flex flex-col items-center space-y-4">
          <ToothIcon className={cn("w-16 h-16 text-primary", loading && "animate-pulse")} />
          <h1 className="text-3xl font-bold tracking-tighter">OrthoByNekruz</h1>
        </div>

        <div className={cn("w-full space-y-4", error && "animate-shake")}>
          <div className="space-y-4 bg-card/30 p-6 rounded-3xl border border-white/5 backdrop-blur-md shadow-2xl">
            <Input
              placeholder="Ключ доступа"
              value={key}
              onChange={(e) => setKey(e.target.value.replace(/\D/g, ''))}
              disabled={loading || lockoutTime > 0}
              className="h-12 text-center text-xl font-mono bg-background/40 border-white/10 rounded-xl"
            />
            <Input
              placeholder="Твой TG ID"
              value={tgId}
              onChange={(e) => setTgId(e.target.value.replace(/\D/g, ''))}
              disabled={loading || lockoutTime > 0}
              className="h-12 text-center text-xl font-mono bg-background/40 border-white/10 rounded-xl"
            />
            <Button 
              onClick={() => handleAuth(key, tgId)}
              disabled={loading || !key || !tgId || lockoutTime > 0}
              className="w-full h-12 rounded-xl font-bold"
            >
              {loading ? <Loader2 className="animate-spin" /> : 
               lockoutTime > 0 ? `БЛОК: ${lockoutTime}с` : "ВОЙТИ"}
            </Button>
          </div>

          <div className="text-center">
            <a href="https://t.me/evoeidos" target="_blank" className="text-xs text-primary/60 hover:text-primary">
              Нужен ключ? Пиши мне @evoeidos
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};