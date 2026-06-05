"use client";

import React, { useCallback, useState } from 'react';
import { getSubject } from '@/lib/subjects';
import { formatPreviewModulesList } from '@/lib/previewModules';
import { formatPriceRub } from '@/lib/previewPricing';
import { Loader2, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const SBP_PHONE_DISPLAY = '+7 900 316 66 46';
const SBP_PHONE_COPY = '+79003166646';
const RECEIPT_TG_URL = 'https://t.me/evoeidos';

interface PreviewAwaitingScreenProps {
  chosenSubject: string | null;
  chosenModules?: string[];
  quotedPrice?: number | null;
  receiptClaimed?: boolean;
  checking?: boolean;
  statusMessage?: string;
  onCheckStatus?: () => void;
  onClaimReceipt?: () => void;
  onBackToAvailable?: () => void;
}

export const PreviewAwaitingScreen: React.FC<PreviewAwaitingScreenProps> = ({
  chosenSubject,
  chosenModules = [],
  quotedPrice = null,
  receiptClaimed = false,
  checking = false,
  statusMessage,
  onCheckStatus,
  onClaimReceipt,
  onBackToAvailable,
}) => {
  const { toast } = useToast();
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const subjectCfg = chosenSubject ? getSubject(chosenSubject) : null;
  const modulesLabel = formatPreviewModulesList(chosenModules);

  const copyPhone = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(SBP_PHONE_COPY);
      toast({ title: 'Номер скопирован' });
    } catch {
      const ta = document.createElement('textarea');
      ta.value = SBP_PHONE_COPY;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        toast({ title: 'Номер скопирован' });
      } catch {
        toast({ variant: 'destructive', title: 'Не удалось скопировать' });
      }
      document.body.removeChild(ta);
    }
  }, [toast]);

  const handleCheckClick = () => {
    if (receiptClaimed) {
      onCheckStatus?.();
      return;
    }
    setReceiptModalOpen(true);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-6">
      <div className="max-w-sm text-center space-y-5">
        <div className="text-5xl">{receiptClaimed ? '📨' : '⏳'}</div>
        <h1 className="text-xl font-bold leading-snug" style={{ color: 'var(--c-text)' }}>
          {receiptClaimed ? 'Чек отправлен — ждём подтверждения' : 'Ты уже знаешь что внутри.'}
        </h1>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--c-muted)' }}>
          {receiptClaimed
            ? 'Админ проверит перевод и откроет доступ по твоему выбору.'
            : <>Плата не за доступ —<br />за то, чтобы не потерять то, что уже нашёл.</>}
        </p>

        {quotedPrice != null && (
          <div
            className="rounded-2xl px-4 py-3"
            style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}
          >
            <div className="text-[11px] uppercase tracking-wide mb-0.5" style={{ color: 'var(--c-muted)' }}>
              Сумма перевода
            </div>
            <div className="text-2xl font-extrabold" style={{ color: subjectCfg?.color ?? 'var(--c-text)' }}>
              {formatPriceRub(quotedPrice)}
            </div>
          </div>
        )}

        {!receiptClaimed && (
          <div
            className="rounded-2xl p-4 text-sm space-y-1"
            style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}
          >
            <div style={{ color: 'var(--c-muted)' }}>Т-Банк СБП</div>
            <button
              type="button"
              onClick={() => void copyPhone()}
              className="text-lg font-bold tracking-wide w-full"
              style={{ color: 'hsl(var(--primary))' }}
            >
              {SBP_PHONE_DISPLAY}
            </button>
            <p className="text-[11px]" style={{ color: 'var(--c-muted)', opacity: 0.75 }}>
              Нажми на номер — скопируется
            </p>
            <p className="text-[13px] pt-1" style={{ color: 'var(--c-muted)' }}>
              Перевёл — напиши. Открою.
            </p>
          </div>
        )}

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
            onClick={handleCheckClick}
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
            href={RECEIPT_TG_URL}
            target="_blank"
            rel="noreferrer"
            className="underline"
            style={{ color: 'hsl(var(--primary) / 0.85)' }}
          >
            @evoeidos
          </a>
        </p>
      </div>

      {receiptModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: 'rgba(0,0,0,0.55)' }}
          onClick={() => setReceiptModalOpen(false)}
        >
          <div
            className="max-w-sm w-full rounded-2xl p-5 space-y-4 text-center relative"
            style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}
            onClick={e => e.stopPropagation()}
          >
            <button
              type="button"
              className="absolute top-3 right-3 p-1 rounded-lg opacity-60"
              onClick={() => setReceiptModalOpen(false)}
              aria-label="Закрыть"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="text-4xl pt-1">🧾</div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--c-text)' }}>
              Чек на @evoeidos скинул?
            </h2>
            {quotedPrice != null && (
              <p className="text-sm" style={{ color: 'var(--c-muted)' }}>
                Сумма: <strong style={{ color: 'var(--c-text)' }}>{formatPriceRub(quotedPrice)}</strong>
              </p>
            )}
            <a
              href={RECEIPT_TG_URL}
              target="_blank"
              rel="noreferrer"
              className="block w-full h-12 rounded-2xl text-sm font-semibold leading-[3rem]"
              style={{
                background: 'var(--c-card)',
                color: 'hsl(var(--primary))',
                border: '1px solid var(--c-border)',
              }}
            >
              Скинуть чек
            </a>
            <button
              type="button"
              disabled={checking}
              onClick={() => {
                setReceiptModalOpen(false);
                onClaimReceipt?.();
              }}
              className="w-full h-12 rounded-2xl text-sm font-semibold inline-flex items-center justify-center gap-2"
              style={{ background: 'var(--c-primary)', color: 'var(--c-bg)' }}
            >
              {checking ? <><Loader2 className="w-4 h-4 animate-spin" /> Сохраняем...</> : 'Скинул'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
