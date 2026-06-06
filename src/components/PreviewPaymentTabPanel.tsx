"use client";

import React, { useCallback, useMemo, useState } from 'react';
import { getSubject } from '@/lib/subjects';
import { PREVIEW_MODULE_LABELS, type PreviewModule } from '@/lib/previewModules';
import { describePreviewPrice, formatPriceRub } from '@/lib/previewPricing';
import { openTgChat } from '@/lib/tgLinks';
import { Copy, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const TBANK_PHONE_DISPLAY = '+7 900 316 66 46';
const TBANK_PHONE_COPY = '+79003166646';
const RECEIPT_TG_URL = 'https://t.me/evoeidos';
const RECEIPT_TG_HANDLE = '@evoeidos';

interface PreviewPaymentTabPanelProps {
  subjectId: string;
  module: PreviewModule;
  status: 'awaiting_payment' | 'rejected' | 'receipt_pending';
  checking?: boolean;
  onClaimReceipt?: (modules: PreviewModule[]) => void;
  /** Докупка: отменить заявку и вернуться к купленным разделам. */
  onBackToPurchased?: () => void;
  /** Переключиться на другой открытый предмет (или отменить докупку). */
  onBackToAvailable?: () => void;
  backBusy?: boolean;
}

export const PreviewPaymentTabPanel: React.FC<PreviewPaymentTabPanelProps> = ({
  subjectId,
  module,
  status,
  checking = false,
  onClaimReceipt,
  onBackToPurchased,
  onBackToAvailable,
  backBusy = false,
}) => {
  const { toast } = useToast();
  const [receiptOpen, setReceiptOpen] = useState(false);
  const subjectCfg = getSubject(subjectId);
  const priceSummary = useMemo(
    () => describePreviewPrice(subjectId, [module]),
    [subjectId, module],
  );
  const accent = subjectCfg?.color ?? 'hsl(var(--primary))';

  const copyPhone = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(TBANK_PHONE_COPY);
      toast({
        title: 'Номер скопирован',
        description: 'Вставь в перевод Т-Банка',
      });
    } catch {
      toast({ variant: 'destructive', title: 'Не удалось скопировать' });
    }
  }, [toast]);

  const openReceiptChat = useCallback(() => {
    openTgChat(RECEIPT_TG_URL);
  }, []);

  const canExit = !!(onBackToPurchased || onBackToAvailable);
  const exitLabel = onBackToPurchased ? 'Выйти' : 'Назад';

  const exitButton = canExit ? (
    <button
      type="button"
      disabled={backBusy || checking}
      onClick={onBackToPurchased ?? onBackToAvailable}
      className="w-full h-11 rounded-xl text-sm font-semibold disabled:opacity-45"
      style={{
        background: 'var(--c-card)',
        border: '1px solid var(--c-border)',
        color: 'var(--c-muted)',
      }}
    >
      {backBusy ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : exitLabel}
    </button>
  ) : null;

  if (status === 'receipt_pending') {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center gap-4">
        <div className="text-4xl">⏳</div>
        <h2 className="text-lg font-bold" style={{ color: 'var(--c-text)' }}>
          Проверяем оплату
        </h2>
        <p className="text-sm leading-relaxed max-w-xs" style={{ color: 'var(--c-muted)' }}>
          Раздел «{PREVIEW_MODULE_LABELS[module]}» — ждём подтверждения администратора.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full p-6">
      <div className="max-w-sm w-full text-center space-y-5">
        <div className="text-4xl">{status === 'rejected' ? '↩️' : '⏳'}</div>
        <div className="space-y-2 px-1">
          <h2 className="text-lg font-bold leading-snug" style={{ color: 'var(--c-text)' }}>
            Ты уже знаешь что внутри.
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--c-muted)' }}>
            {status === 'rejected'
              ? 'Оплата не подтверждена — нужен новый перевод.'
              : 'Плата не за доступ — за то, чтобы не потерять то, что уже нашёл.'}
          </p>
        </div>

        {status === 'rejected' && (
          <div
            className="rounded-2xl px-4 py-3.5 text-left"
            style={{
              background: 'var(--c-danger-soft)',
              border: '1px solid hsl(var(--destructive) / 0.35)',
            }}
          >
            <p className="text-[13px] font-bold leading-snug" style={{ color: 'var(--c-danger)' }}>
              Не оплатил — не входи.
            </p>
            <p className="text-[12px] leading-relaxed mt-1.5" style={{ color: 'var(--c-text)' }}>
              Если нажмёшь «войти» без реального перевода, аккаунт заблокируют{' '}
              <span className="font-semibold">навсегда</span>. Это не предупреждение на один раз — бан без разблокировки.
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={copyPhone}
          className="w-full rounded-2xl px-4 py-3.5 text-left transition-opacity active:opacity-80"
          style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--c-muted)' }}>
                Т-Банк
              </p>
              <p className="text-base font-bold mt-0.5 tabular-nums" style={{ color: 'var(--c-text)' }}>
                {TBANK_PHONE_DISPLAY}
              </p>
              <p className="text-[11px] mt-1" style={{ color: 'var(--c-muted)' }}>
                Нажми, чтобы скопировать номер
              </p>
            </div>
            <Copy className="w-5 h-5 shrink-0" style={{ color: 'var(--c-primary)' }} />
          </div>
        </button>

        {priceSummary && (
          <div
            className="rounded-2xl px-4 py-4"
            style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}
          >
            <p className="text-3xl font-bold tabular-nums" style={{ color: accent }}>
              {formatPriceRub(priceSummary.total)}
            </p>
            <p className="text-xs mt-1.5" style={{ color: 'var(--c-muted)' }}>
              {PREVIEW_MODULE_LABELS[module]}
              {subjectCfg ? ` · ${subjectCfg.label}` : ''}
              {priceSummary.lines.length > 0 ? ` · ${priceSummary.lines.join(' · ')}` : ''}
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-2 text-[15px] leading-relaxed px-1">
          <span style={{ color: 'var(--c-muted)' }}>скинь чек</span>
          <button
            type="button"
            onClick={openReceiptChat}
            className="font-bold underline underline-offset-2 decoration-primary/40"
            style={{ color: 'var(--c-primary)' }}
          >
            {RECEIPT_TG_HANDLE}
          </button>
          <span style={{ color: 'var(--c-muted)' }}>и</span>
          <button
            type="button"
            disabled={checking}
            onClick={() => setReceiptOpen(true)}
            className="h-9 px-4 rounded-xl text-sm font-bold disabled:opacity-50"
            style={{ background: 'var(--c-primary)', color: 'var(--c-bg)' }}
          >
            {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : 'войди'}
          </button>
        </div>

        {exitButton}
      </div>

      {receiptOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-6"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setReceiptOpen(false)}
        >
          <div
            className="max-w-sm w-full rounded-2xl p-5 space-y-4 text-center"
            style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}
            onClick={e => e.stopPropagation()}
          >
            {status === 'rejected' && (
              <p
                className="text-xs leading-relaxed rounded-xl px-3 py-2.5"
                style={{ background: 'var(--c-danger-soft)', color: 'var(--c-danger)' }}
              >
                Вход без оплаты = перманентный бан. Продолжай только если перевод уже был.
              </p>
            )}
            <p className="text-sm leading-relaxed" style={{ color: 'var(--c-text)' }}>
              Скинул чек в{' '}
              <button
                type="button"
                onClick={openReceiptChat}
                className="font-semibold underline"
                style={{ color: 'var(--c-primary)' }}
              >
                {RECEIPT_TG_HANDLE}
              </button>
              {' '}и перевёл {formatPriceRub(priceSummary?.total ?? 0)}?
            </p>
            <button
              type="button"
              disabled={checking}
              onClick={() => {
                setReceiptOpen(false);
                onClaimReceipt?.([module]);
              }}
              className="w-full h-11 rounded-xl text-sm font-bold disabled:opacity-50"
              style={{
                background: status === 'rejected' ? 'var(--c-danger)' : 'var(--c-primary)',
                color: 'var(--c-bg)',
              }}
            >
              {checking
                ? <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                : status === 'rejected' ? 'Да, оплатил — войти' : 'Да, войти'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
