"use client";

import React, { useState, useCallback } from 'react';
import { Loader2, ChevronLeft } from 'lucide-react';
import {
  detectFacultyByInput,
  resolveFacultyPromoCode,
  MAX_INPUT_LENGTH,
  getDefaultDigitIcon,
  isLegacyPaidKey,
} from '@/lib/facultyCodes';

interface ChannelCodeEntryScreenProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export const ChannelCodeEntryScreen: React.FC<ChannelCodeEntryScreenProps> = ({
  onSuccess,
  onCancel,
}) => {
  const [key, setKey]           = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [focused, setFocused]   = useState(false);

  const promoHint   = isLegacyPaidKey(key) ? null : detectFacultyByInput(key);
  const digitIcon   = promoHint?.digitIcon ?? getDefaultDigitIcon();
  const promoReady  = !!resolveFacultyPromoCode(key);

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
      : 'var(--c-border)';

  const submit = useCallback(async () => {
    if (!promoReady || loading) return;
    const tgId    = localStorage.getItem('user_tg_id');
    const initData = (window as { Telegram?: { WebApp?: { initData?: string } } }).Telegram?.WebApp?.initData || '';
    if (!tgId) {
      setError('Не найден Telegram ID');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: key.trim(), telegramId: tgId, initData }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Неверный код');
        return;
      }
      onSuccess();
    } catch {
      setError('Ошибка соединения');
    } finally {
      setLoading(false);
    }
  }, [key, loading, onSuccess, promoReady]);

  return (
    <div
      className="flex flex-col min-h-screen"
      style={{ background: 'var(--c-bg)' }}
    >
      <div className="flex items-center px-4 pt-4 pb-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1 text-sm font-medium py-2"
          style={{ color: 'var(--c-muted)' }}
        >
          <ChevronLeft className="w-4 h-4" /> Назад
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-10">
        <h1 className="text-xl font-bold mb-2 text-center" style={{ color: 'var(--c-text)' }}>
          Введи код
        </h1>
        <p className="text-sm text-center mb-8 max-w-xs" style={{ color: 'var(--c-muted)' }}>
          После кода укажешь группу и увидишь все доступные предметы
        </p>

        <div
          className="relative w-full max-w-xs h-14 rounded-2xl flex items-center justify-center cursor-text mb-4"
          style={{
            background: 'var(--c-card)',
            border: `1px solid ${error ? 'rgba(220,38,38,0.5)' : inputBorder}`,
          }}
        >
          {key.length === 0 && (
            <span className="absolute text-[15px]" style={{ color: 'var(--c-muted)', opacity: 0.5 }}>
              Введи код
            </span>
          )}
          <div className="flex gap-1 items-center z-10">
            {key.split('').map((_, i) => {
              const dynamicSize = Math.max(20, 44 - (key.length * 3));
              return (
                <span
                  key={i}
                  style={{
                    fontSize: `${dynamicSize}px`,
                    lineHeight: 1,
                    filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.3))',
                  }}
                >
                  {digitIcon}
                </span>
              );
            })}
          </div>
          <input
            value={key}
            onChange={e => { setKey(e.target.value.replace(/\D/g, '').slice(0, MAX_INPUT_LENGTH)); setError(''); }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            disabled={loading}
            inputMode="numeric"
            className="absolute inset-0 opacity-0 cursor-text"
            autoFocus
          />
        </div>

        {error && (
          <p className="text-sm mb-4 text-center" style={{ color: '#f87171' }}>{error}</p>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={!promoReady || loading}
          className="w-full max-w-xs h-[52px] rounded-2xl text-[15px] font-bold inline-flex items-center justify-center gap-2 disabled:opacity-45"
          style={{
            background: promoReady ? 'var(--c-primary)' : 'var(--c-card)',
            color: promoReady ? 'var(--c-bg)' : 'var(--c-muted)',
            border: promoReady ? 'none' : '1px solid var(--c-border)',
          }}
        >
          {loading
            ? <Loader2 className="w-5 h-5 animate-spin" />
            : promoReady
              ? `${digitIcon} Продолжить`
              : 'Продолжить'}
        </button>
      </div>
    </div>
  );
};
