"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ToothIcon } from './ToothIcon';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ExternalLink, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Floating tooth rain background ──────────────────────────────────────────
const ToothRainBG = () => {
  const teeth = Array.from({ length: 12 }, (_, i) => ({
    x:     10 + (i * 37) % 370,
    size:  10 + ((i * 7) % 16),
    dur:   4  + ((i * 3) % 5),
    delay: (i * 0.7) % 5,
  }));
  return (
    <>
      <style>{`
        @keyframes toothRainFall {
          0%   { transform: translateY(-20px) rotate(0deg);   opacity: 0; }
          10%  { opacity: 0.5; }
          90%  { opacity: 0.2; }
          100% { transform: translateY(110vh) rotate(360deg); opacity: 0; }
        }
      `}</style>
      {teeth.map((t, i) => (
        <svg
          key={i}
          width={t.size} height={t.size} viewBox="0 0 24 24" fill="none"
          style={{
            position: 'absolute', left: t.x, top: -20,
            animation: `toothRainFall ${t.dur}s ${t.delay}s linear infinite`,
            pointerEvents: 'none',
          }}
        >
          <path
            d="M7.5 3C5.5 3 4 4.5 4 6.5C4 8.5 4.5 11 5.5 13.5C6.5 16 8.5 19.5 8.5 21C8.5 21.5 8.9 22 9.5 22C10.1 22 10.5 21.5 10.5 21C10.5 20.5 11 18 12 18C13 18 13.5 20.5 13.5 21C13.5 21.5 13.9 22 14.5 22C15.1 22 15.5 21.5 15.5 21C15.5 19.5 17.5 16 18.5 13.5C19.5 11 20 8.5 20 6.5C20 4.5 18.5 3 16.5 3C14.5 3 13 4 12 5C11 4 9.5 3 7.5 3Z"
            stroke="hsl(var(--primary))" strokeWidth="1.5"
            fill="hsl(var(--primary))" fillOpacity="0.6"
          />
        </svg>
      ))}
    </>
  );
};

// ─── AuthScreen ───────────────────────────────────────────────────────────────
export const AuthScreen = ({ onAuthenticated }: { onAuthenticated: () => void }) => {
  const { toast } = useToast();

  const [mounted,           setMounted]           = useState(false);
  const [key,               setKey]               = useState('');
  const [loading,           setLoading]           = useState(false);
  const [error,             setError]             = useState(false);
  const [focused,           setFocused]           = useState(false);
  const [lockoutTime,       setLockoutTime]       = useState(() => {
    if (typeof window === 'undefined') return 0;
    const until = Number(localStorage.getItem('lockout_until') || '0');
    const left  = Math.ceil((until - Date.now()) / 1000);
    return left > 0 ? left : 0;
  });
  const [needsSubscription, setNeedsSubscription] = useState(false);
  const [showWelcome,       setShowWelcome]       = useState(false);
  const [manualTgId,        setManualTgId]        = useState('');
  const [autoTgId,          setAutoTgId]          = useState<string | null>(null);
  const [idChecked,         setIdChecked]         = useState(false);
  const [idCheckAttempts,   setIdCheckAttempts]   = useState(0);
  const [debugInfo,         setDebugInfo]         = useState('');
  const [initData,          setInitData]          = useState('');
  const [demoMessage,       setDemoMessage]       = useState('');
  const [errorMessage,      setErrorMessage]      = useState('');

  const maxAttempts     = 20;
  const attemptInterval = 500;

  // ── Hydration guard ────────────────────────────────────────────────────────
  useEffect(() => { setMounted(true); }, []);

  // ── Lockout countdown ─────────────────────────────────────────────────────
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

  // ── Telegram init ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mounted) return;
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      tg.ready(); tg.expand?.();
      try { tg.setBackgroundColor('var(--background)'); } catch {}
      if (tg.initData) setInitData(tg.initData);
    }
  }, [mounted]);

  // ── Auto detect Telegram ID ───────────────────────────────────────────────
  useEffect(() => {
    if (!mounted || autoTgId !== null || idCheckAttempts >= maxAttempts) {
      if (idCheckAttempts >= maxAttempts) setIdChecked(true);
      return;
    }
    const timer = setTimeout(() => {
      const tg = (window as any).Telegram?.WebApp;
      if (tg) {
        let id = tg.initDataUnsafe?.user?.id;
        if (!id && tg.initData) {
          try { id = JSON.parse(new URLSearchParams(tg.initData).get('user') || '{}').id; } catch {}
        }
        if (id) { setAutoTgId(String(id)); setIdChecked(true); }
        else { setDebugInfo(`Attempt ${idCheckAttempts}: No ID`); setIdCheckAttempts(p => p + 1); }
      } else {
        setIdCheckAttempts(p => p + 1);
      }
    }, attemptInterval);
    return () => clearTimeout(timer);
  }, [mounted, autoTgId, idCheckAttempts]);

  // ── Secret reset (6 taps) ─────────────────────────────────────────────────
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

  // ── Auth ──────────────────────────────────────────────────────────────────
  const handleAuth = useCallback(async (inputKey: string, inputTgId: string) => {
    if (loading || lockoutTime > 0 || !inputTgId) return;
    setLoading(true); setError(false); setNeedsSubscription(false);
    try {
      const res  = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: inputKey.trim(), telegramId: String(inputTgId), initData }),
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('is_authed',   'true');
        localStorage.setItem('user_tg_id',  String(inputTgId));
        if (!localStorage.getItem('welcome_seen') && inputKey !== '') {
          setShowWelcome(true);
        } else {
          onAuthenticated();
        }
      } else {
        if (res.status === 403 && data.blocked) {
          // Аккаунт заблокирован администратором
          setError(true);
          setErrorMessage('Твой аккаунт заблокирован. Свяжись с администратором.');
          setTimeout(() => setErrorMessage(''), 6000);
        } else if (res.status === 403) {
          // Не подписан на канал
          setNeedsSubscription(true);
        } else {
          const LOCKOUT_SEC = 60;
          localStorage.setItem('lockout_until', String(Date.now() + LOCKOUT_SEC * 1000));
          setLockoutTime(LOCKOUT_SEC);
          setError(true);
          const msg = data.error || 'Неверный ключ доступа';
          setErrorMessage(msg);
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

  const handleLoginClick = () => {
    const id = autoTgId || manualTgId.trim();
    if (!id) { toast({ variant: 'destructive', title: 'ID не найден', description: 'Введи ID вручную' }); return; }
    if (!/^\d{5,12}$/.test(id) || Number(id) < 10000) {
      toast({ variant: 'destructive', title: 'Неверный ID', description: 'Telegram ID должен быть числовым (5-12 цифр)' }); return;
    }
    handleAuth(key, id);
  };

  const handleDemoClick = async () => {
    const id = autoTgId || manualTgId.trim();
    if (!id) { toast({ variant: 'destructive', title: 'Ошибка', description: 'Не удалось определить ID.' }); return; }
    setLoading(true);
    try {
      const res  = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramId: String(id), mode: 'check_demo', initData }),
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('is_authed',   'true');
        localStorage.setItem('demo_mode',   'true');
        localStorage.setItem('demo_start',  String(Date.now()));
        localStorage.setItem('user_tg_id',  String(id));
        onAuthenticated();
      } else {
        setDemoMessage(data.message || 'Демо недоступно, ты уже использовал его ранее');
        setTimeout(() => setDemoMessage(''), 3500);
      }
    } catch {
      toast({ variant: 'destructive', title: 'Ошибка', description: 'Проблемы с соединением' });
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return (
    <div
      className="dark flex flex-col items-center justify-center min-h-screen p-6 relative overflow-hidden pt-16"
      style={{ background: '#0B0E14' }}
    >
      {/* ── Welcome overlay ── */}
      {showWelcome && (
        <div className="dark fixed inset-0 z-50 flex items-center justify-center p-6 backdrop-blur-xl animate-in fade-in zoom-in duration-300"
          style={{ background: 'rgba(11,14,20,0.85)' }}>
          <div className="w-full max-w-sm bg-card border border-white/10 p-8 rounded-[32px] shadow-2xl text-center space-y-6">
            <div className="inline-flex p-3 bg-primary/10 rounded-full text-primary">
              <Heart className="w-8 h-8 fill-primary/20" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight text-white">Рад тебя видеть!</h2>
              <p className="text-sm text-muted-foreground">Учись, исследуй, развивайся.</p>
            </div>
            <Button onClick={() => {
              localStorage.setItem('welcome_seen', 'true');
              setShowWelcome(false);
              onAuthenticated();
            }} className="w-full h-14 rounded-2xl text-lg font-bold">Погнали!</Button>
          </div>
        </div>
      )}

      {/* ── Tooth rain ── */}
      <ToothRainBG />

      {/* ── Logo ── */}
      <style>{`
        @keyframes authToothPulse {
          0%,100% { transform: scale(1);    filter: drop-shadow(0 0 8px  hsl(var(--primary) / 0.4)); }
          50%      { transform: scale(1.08); filter: drop-shadow(0 0 20px hsl(var(--primary) / 0.8)); }
        }
        @keyframes authToothSlideUp {
          from { transform: translateY(8px) scale(0.8); opacity: 0; }
          to   { transform: translateY(0)   scale(1);   opacity: 1; }
        }
        @keyframes authShake {
          0%,100% { transform: translateX(0); }
          25%     { transform: translateX(-5px); }
          75%     { transform: translateX(5px); }
        }
        .auth-shake { animation: authShake 0.2s ease-in-out 0s 2; }
      `}</style>

      <div className="w-full max-w-sm flex flex-col items-center z-10">
        {/* Logo block */}
        <div className="mb-8 flex flex-col items-center space-y-4 text-center">
          <div
            className="w-20 h-20 rounded-[28px] flex items-center justify-center"
            style={{
              background: 'hsl(var(--primary) / 0.08)',
              border:     '1.5px solid hsl(var(--primary) / 0.2)',
              animation:  'authToothPulse 2.5s ease-in-out infinite',
            }}
          >
            <ToothIcon className="w-12 h-12 text-primary" variant="perfect" />
          </div>
          <h1
            className="text-3xl font-bold tracking-tighter text-white select-none cursor-default"
            onClick={handleTitleClick}
          >
            OrthoByNekruz
          </h1>
          <p className="text-[13px]" style={{ color: 'rgba(255,255,255,0.3)' }}>Подготовка к экзамену</p>
          {debugInfo && (
            <p className="text-[10px] text-white/20 font-mono break-all px-4">{debugInfo}</p>
          )}
        </div>

        {/* Form card */}
        <div className={cn('w-full space-y-4', error && 'auth-shake')}>
          <div className="space-y-4 bg-card/30 p-6 rounded-3xl border border-white/5 backdrop-blur-md shadow-2xl">

            {/* Key input with tooth display */}
            <div
              className="relative h-14 rounded-[18px] flex items-center justify-center overflow-hidden cursor-text"
              style={{
                background:  'rgba(255,255,255,0.06)',
                border:      `1.5px solid ${focused ? 'hsl(var(--primary) / 0.4)' : 'rgba(255,255,255,0.1)'}`,
                transition:  'border-color 0.2s ease',
              }}
            >
              {key.length === 0 && (
                <span className="absolute text-sm" style={{ color: 'rgba(255,255,255,0.25)' }}>
                  {lockoutTime > 0 ? `Подожди ${lockoutTime}с` : 'Введи ключ доступа'}
                </span>
              )}
              <div className="flex gap-1 items-center z-10">
                {key.split('').map((_, i) => (
                  <div key={i} style={{ animation: 'authToothSlideUp 0.2s ease forwards' }}>
                    <ToothIcon className="w-6 h-6 text-primary" />
                  </div>
                ))}
              </div>
              <input
                value={key}
                onChange={e => setKey(e.target.value.replace(/\D/g, '').slice(0, 8))}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                disabled={loading || lockoutTime > 0}
                maxLength={8}
                inputMode="numeric"
                className="absolute inset-0 opacity-0 cursor-text"
                style={{ fontSize: 1 }}
              />
            </div>

            {/* Manual TG ID (shown if auto detection failed) */}
            {idChecked && !autoTgId && (
              <Input
                type="text" inputMode="numeric"
                placeholder="Твой Telegram ID (числовой)"
                value={manualTgId}
                onChange={e => setManualTgId(e.target.value.replace(/\D/g, '').slice(0, 12))}
                className="h-14 text-center text-lg bg-background/40 border-white/10 rounded-2xl text-white animate-in slide-in-from-top-2"
              />
            )}

            {/* Login button */}
            <button
              onClick={handleLoginClick}
              disabled={loading || lockoutTime > 0}
              className="w-full h-[52px] rounded-[18px] text-[15px] font-bold transition-all duration-250 active:scale-[0.98] flex items-center justify-center gap-2"
              style={key.length >= 4 ? {
                background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.75))',
                color:      'hsl(var(--primary-foreground))',
                boxShadow:  '0 8px 24px hsl(var(--primary) / 0.3)',
              } : {
                background: 'hsl(var(--primary) / 0.15)',
                border:     '1px solid hsl(var(--primary) / 0.25)',
                color:      'hsl(var(--primary) / 0.5)',
              }}
            >
              {loading
                ? <Loader2 className="w-5 h-5 animate-spin" />
                : key.length >= 4 ? '🦷 Войти' : 'Войти'}
            </button>

            {/* Demo button */}
            <button
              onClick={handleDemoClick}
              disabled={loading}
              className="w-full h-11 rounded-xl text-[13px] font-medium transition-all"
              style={{
                background: 'transparent',
                border:     '1px solid hsl(var(--primary) / 0.2)',
                color:      'hsl(var(--primary) / 0.6)',
              }}
            >
              Попробовать демо
            </button>

            {/* Demo error message */}
            {demoMessage && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300 rounded-xl p-3 text-center text-xs"
                style={{
                  background: 'rgba(220,38,38,0.12)',
                  border:     '1px solid rgba(220,38,38,0.3)',
                  color:      '#fca5a5',
                  animation:  'fadeInOut 4s ease forwards',
                }}>
                {demoMessage}
              </div>
            )}

            {/* Key error message — same style, shown inline */}
            {errorMessage && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300 rounded-xl p-3 text-center text-xs"
                style={{
                  background: 'rgba(220,38,38,0.12)',
                  border:     '1px solid rgba(220,38,38,0.3)',
                  color:      '#fca5a5',
                  animation:  'fadeInOut 4s ease forwards',
                }}>
                {errorMessage}
              </div>
            )}

            {needsSubscription && (
              <p className="text-[10px] text-center text-destructive animate-pulse">
                Subscribe to @nzsdental and try again
              </p>
            )}
          </div>

          {/* DM link */}
          <div className="text-center">
            <a href="https://t.me/evoeidos"
              className="inline-flex items-center text-xs transition-colors"
              style={{ color: 'hsl(var(--primary) / 0.6)' }}>
              Нужен ключ? DM @evoeidos <ExternalLink className="ml-1 w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
