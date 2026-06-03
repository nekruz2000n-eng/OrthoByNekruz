"use client";

import React from 'react';
import { getSubject } from '@/lib/subjects';
import { Loader2 } from 'lucide-react';

interface PreviewAwaitingScreenProps {
  chosenSubject: string | null;
  course: string | null;
  faculty: string | null;
  checking?: boolean;
  onCheckStatus?: () => void;
}

export const PreviewAwaitingScreen: React.FC<PreviewAwaitingScreenProps> = ({
  chosenSubject,
  course,
  faculty,
  checking = false,
  onCheckStatus,
}) => {
  const subjectCfg = chosenSubject ? getSubject(chosenSubject) : null;

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-6">
      <div className="max-w-sm text-center space-y-5">
        <div className="text-5xl">⏳</div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--c-text)' }}>
          Пробный период завершён
        </h1>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--c-muted)' }}>
          Администратор уже видит твою заявку. После подтверждения доступ откроется автоматически —
          ключ вводить не нужно.
        </p>

        {(subjectCfg || course || faculty) && (
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
            {course && (
              <div>
                <span style={{ color: 'var(--c-muted)' }}>Курс: </span>
                <strong style={{ color: 'var(--c-text)' }}>{course}</strong>
              </div>
            )}
            {faculty && (
              <div>
                <span style={{ color: 'var(--c-muted)' }}>Факультет: </span>
                <strong style={{ color: 'var(--c-text)' }}>{faculty}</strong>
              </div>
            )}
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

        <p className="text-[11px]" style={{ color: 'var(--c-muted)', opacity: 0.7 }}>
          Вопросы — DM @evoeidos
        </p>
      </div>
    </div>
  );
};
