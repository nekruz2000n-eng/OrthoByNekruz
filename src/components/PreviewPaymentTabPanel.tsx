"use client";

import React, { useCallback, useMemo, useState } from 'react';
import { getSubject } from '@/lib/subjects';
import { PREVIEW_MODULE_LABELS, type PreviewModule } from '@/lib/previewModules';
import { describePreviewPrice, formatPriceRub } from '@/lib/previewPricing';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const SBP_PHONE_DISPLAY = '+7 900 316 66 46';
const SBP_PHONE_COPY = '+79003166646';

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
      await navigator.clipboard.writeText(SBP_PHONE_COPY);
      toast({ title: 'Номер скопирован' });
    } catch {
      toast({ variant: 'destructive', title: 'Не удалось скопировать' });
    }
  }, [toast]);

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
      <div className="max-w-sm w-full text-center space-y-4">
        <div className="text-4xl">{status === 'rejected' ? '↩️' : '⏳'}</div>
        <h2 className="text-lg font-bold" style={{ color: 'var(--c-text)' }}>
          {status === 'rejected' ? 'Нужна оплата' : 'Проба закончилась'}
        </h2>
        <p className="text-sm" style={{ color: 'var(--c-muted)' }}>
          {PREVIEW_MODULE_LABELS[module]}
          {subjectCfg ? ` · ${subjectCfg.label}` : ''}
        </p>

        {priceSummary && (
          <div
            className="rounded-2xl p-4 space-y-2"
            style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}
          >
            <p className="text-2xl font-bold" style={{ color: accent }}>
              {formatPriceRub(priceSummary.totalRub)}
            </p>
            <p className="text-xs" style={{ color: 'var(--c-muted)' }}>{priceSummary.detail}</p>
          </div>
        )}

        <button
          type="button"
          onClick={copyPhone}
          className="w-full h-11 rounded-xl text-sm font-semibold"
          style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)', color: 'var(--c-text)' }}
        >
          СБП: {SBP_PHONE_DISPLAY}
        </button>

        <button
          type="button"
          disabled={checking}
          onClick={() => setReceiptOpen(true)}
          className="w-full h-12 rounded-2xl text-sm font-bold disabled:opacity-50"
          style={{ background: 'var(--c-primary)', color: 'var(--c-bg)' }}
        >
          {checking ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Скинул — войти'}
        </button>

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
            <p className="text-sm" style={{ color: 'var(--c-text)' }}>
              Подтверди, что перевёл оплату за «{PREVIEW_MODULE_LABELS[module]}».
            </p>
            <button
              type="button"
              disabled={checking}
              onClick={() => {
                setReceiptOpen(false);
                onClaimReceipt?.([module]);
              }}
              className="w-full h-11 rounded-xl text-sm font-bold disabled:opacity-50"
              style={{ background: 'var(--c-primary)', color: 'var(--c-bg)' }}
            >
              Да, скинул
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
