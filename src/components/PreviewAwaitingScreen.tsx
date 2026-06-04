"use client";

import React from 'react';
import { getSubject } from '@/lib/subjects';
import { formatPreviewModulesList } from '@/lib/previewModules';
import { Loader2 } from 'lucide-react';

interface PreviewAwaitingScreenProps {
  chosenSubject: string | null;
  chosenModules?: string[];
  checking?: boolean;
  statusMessage?: string;
  onCheckStatus?: () => void;
  onBackToAvailable?: () => void;
}

export const PreviewAwaitingScreen: React.FC<PreviewAwaitingScreenProps> = ({
  chosenSubject,
  chosenModules = [],
  checking = false,
  statusMessage,
  onCheckStatus,
  onBackToAvailable,
}) => {
  const subjectCfg = chosenSubject ? getSubject(chosenSubject) : null;
  const modulesLabel = formatPreviewModulesList(chosenModules);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-6">
      <div className="max-w-sm text-center space-y-5">
        <div className="text-5xl">⏳</div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--c-text)' }}>
          Ожидайте подтверждения
        </h1>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--c-muted)' }}>
          Просмотр закончился. Напиши админу в Telegram — после оплаты подтвердит доступ к выбранному предмету.
        </p>

        {(subjectCfg || modulesLabel) && (
          <div
            className="rounded-2xl p-4 text-left text-sm space-y-2"
            style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}
          >
            {subjectCfg && (
              <div>
                <span style={{ color: 'var(--c-muted)' }}>Предмет: </span>
                <strong style={{ color: subjectCfg.color }}>{subjectCfg.label}</strong>
              </div>
            )}
            {modulesLabel && (
              <div>
                <span style={{ color: 'var(--c-muted)' }}>Разделы: </span>
                <strong style={{ color: 'var(--c-text)' }}>{modulesLabel}</strong>
              </div>
            )}
          </div>
        )}

        {statusMessage && (
          <div
            className="rounded-2xl px-4 py-3 text-sm leading-relaxed text-left"
            style={{
              border: '1.5px solid rgba(220, 38, 38, 0.45)',
              background: 'rgba(220, 38, 38, 0.08)',
              color: '#fca5a5',
            }}
          >
            {statusMessage}
          </div>
        )}

        {onCheckStatus && (
          <button
            type="button"
            onClick={onCheckStatus}
            disabled={checking}
            className="w-full h-12 rounded-2xl text-sm font-semibold inline-flex items-center justify-center gap-2"
            style={{
              background: 'var(--c-primary)',
              color: 'var(--c-bg)',
            }}
          >
            {checking
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Проверяем...</>
              : 'Проверить статус'}
          </button>
        )}

        {onBackToAvailable && (
          <button
            type="button"
            onClick={onBackToAvailable}
            disabled={checking}
            className="w-full h-12 rounded-2xl text-sm font-semibold"
            style={{
              background: 'var(--c-card)',
              color: 'var(--c-text)',
              border: '1px solid var(--c-border)',
            }}
          >
            Назад к доступным предметам
          </button>
        )}

        <p className="text-[11px]" style={{ color: 'var(--c-muted)', opacity: 0.7 }}>
          Вопросы —{' '}
          <a
            href="https://t.me/evoeidos"
            target="_blank"
            rel="noreferrer"
            className="underline"
            style={{ color: 'hsl(var(--primary) / 0.85)' }}
          >
            @evoeidos
          </a>
        </p>
      </div>
    </div>
  );
};
