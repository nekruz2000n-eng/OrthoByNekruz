"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getSubject } from '@/lib/subjects';
import { formatPreviewModulesList, normalizePreviewModules, type PreviewModule } from '@/lib/previewModules';
import {
  describePreviewPrice,
  formatPriceRub,
  getPaymentModuleRow,
} from '@/lib/previewPricing';
import { Loader2, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const SBP_PHONE_DISPLAY = '+7 900 316 66 46';
const SBP_PHONE_COPY = '+79003166646';
const RECEIPT_TG_URL = 'https://t.me/evoeidos';

interface PreviewAwaitingScreenProps {
  chosenSubject: string | null;
  chosenModules?: string[];
  receiptClaimed?: boolean;
  checking?: boolean;
  savingModules?: boolean;
  statusMessage?: string;
  onCheckStatus?: () => void;
  onClaimReceipt?: (modules: PreviewModule[]) => void;
  onModulesChange?: (modules: PreviewModule[]) => void;
  onBackToAvailable?: () => void;
  /** Докупка: вернуться к уже оплаченным разделам без подтверждения чека. */
  onBackToPurchased?: () => void;
  backToPurchasedBusy?: boolean;
}

export const PreviewAwaitingScreen: React.FC<PreviewAwaitingScreenProps> = ({
  chosenSubject,
  chosenModules = [],
  receiptClaimed = false,
  checking = false,
  savingModules = false,
  statusMessage,
  onCheckStatus,
  onClaimReceipt,
  onModulesChange,
  onBackToAvailable,
  onBackToPurchased,
  backToPurchasedBusy = false,
}) => {
  const { toast } = useToast();
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [selectedModules, setSelectedModules] = useState<PreviewModule[]>(
    () => normalizePreviewModules(chosenModules),
  );

  useEffect(() => {
    setSelectedModules(normalizePreviewModules(chosenModules));
  }, [chosenModules]);

  const subjectCfg = chosenSubject ? getSubject(chosenSubject) : null;
  const moduleRow = useMemo(
    () => (chosenSubject ? getPaymentModuleRow(chosenSubject) : []),
    [chosenSubject],
  );

  const priceSummary = useMemo(() => {
    if (!chosenSubject || selectedModules.length === 0) return null;
    return describePreviewPrice(chosenSubject, selectedModules);
  }, [chosenSubject, selectedModules]);

  const modulesLabel = formatPreviewModulesList(selectedModules);
  const canEditModules = !receiptClaimed && moduleRow.some(o => o.selectable);

  const toggleModule = (id: PreviewModule, selectable: boolean) => {
    if (!canEditModules || !selectable) return;
    setSelectedModules(prev => {
      const next = prev.includes(id)
        ? prev.filter(m => m !== id)
        : [...prev, id];
      if (next.length === 0) return prev;
      onModulesChange?.(next);
      return next;
    });
  };

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
    if (selectedModules.length === 0) {
      toast({ variant: 'destructive', title: 'Выбери хотя бы один раздел' });
      return;
    }
    setReceiptModalOpen(true);
  };

  const accent = subjectCfg?.color ?? 'hsl(var(--primary))';

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-6">
      <div className="max-w-sm text-center space-y-5 w-full">
        <div className="text-5xl">⏳</div>
        <h1 className="text-xl font-bold leading-snug" style={{ color: 'var(--c-text)' }}>
          Ты уже знаешь что внутри.
        </h1>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--c-muted)' }}>
          Плата не за доступ —<br />
          за то, чтобы не потерять то, что уже нашёл.
        </p>

        {chosenSubject && (
          <div
            className="rounded-2xl p-4 space-y-3"
            style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}
          >
            {subjectCfg && (
              <div className="text-sm text-center">
                <span style={{ color: 'var(--c-muted)' }}>Предмет: </span>
                <strong style={{ color: subjectCfg.color }}>{subjectCfg.label}</strong>
              </div>
            )}

            {canEditModules && (
              <p className="text-[11px] text-center" style={{ color: 'var(--c-muted)' }}>
                Выбери разделы — сумма обновится сразу
              </p>
            )}

            <div className="flex flex-row items-stretch gap-1.5 w-full">
              {moduleRow.map(opt => {
                const active = selectedModules.includes(opt.id);
                const disabled = !canEditModules || savingModules || !opt.selectable;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => toggleModule(opt.id, opt.selectable)}
                    className="flex-1 min-w-0 h-9 rounded-lg transition-all active:scale-[0.97] disabled:cursor-not-allowed inline-flex items-center justify-center"
                    style={{
                      background: active
                        ? `color-mix(in srgb, ${accent} 18%, var(--c-card))`
                        : 'var(--c-bg)',
                      border: active
                        ? `1.5px solid ${accent}`
                        : '1px solid var(--c-border)',
                      opacity: opt.selectable ? (disabled ? 0.55 : 1) : 0.35,
                    }}
                  >
                    <span
                      className="text-[10px] font-bold leading-none whitespace-nowrap"
                      style={{ color: active ? accent : 'var(--c-muted)' }}
                    >
                      {opt.shortLabel}
                    </span>
                  </button>
                );
              })}
            </div>

            {priceSummary && (
              <div className="pt-2 text-center space-y-1.5" style={{ borderTop: '1px solid var(--c-border)' }}>
                <div className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--c-muted)' }}>
                  К переводу
                </div>
                <div className="text-2xl font-extrabold inline-flex items-center justify-center gap-2" style={{ color: accent }}>
                  {formatPriceRub(priceSummary.total)}
                  {savingModules && <Loader2 className="w-4 h-4 animate-spin opacity-70" />}
                </div>
                {priceSummary.lines.length > 0 && (
                  <p className="text-[11px] leading-snug" style={{ color: 'var(--c-muted)' }}>
                    {priceSummary.lines.join(' · ')}
                  </p>
                )}
                <p className="text-[11px] leading-snug" style={{ color: 'var(--c-muted)', opacity: 0.85 }}>
                  {priceSummary.hint}
                </p>
              </div>
            )}
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

        {modulesLabel && (
          <div
            className="rounded-2xl p-4 text-left text-sm"
            style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}
          >
            {subjectCfg && (
              <div className="mb-1">
                <span style={{ color: 'var(--c-muted)' }}>Предмет: </span>
                <strong style={{ color: subjectCfg.color }}>{subjectCfg.label}</strong>
              </div>
            )}
            <div>
              <span style={{ color: 'var(--c-muted)' }}>Разделы: </span>
              <strong style={{ color: 'var(--c-text)' }}>{modulesLabel}</strong>
            </div>
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
            disabled={checking || savingModules || selectedModules.length === 0}
            className="w-full h-12 rounded-2xl text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50"
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

        {onBackToPurchased && (
          <p className="text-[11px] leading-relaxed px-1" style={{ color: 'var(--c-muted)' }}>
            Без «Скинул — войти» докупка не откроется. Можно вернуться к уже купленным разделам.
          </p>
        )}

        {onBackToPurchased && (
          <button
            type="button"
            onClick={onBackToPurchased}
            disabled={checking || savingModules || backToPurchasedBusy}
            className="w-full h-12 rounded-2xl text-sm font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2"
            style={{
              background: 'var(--c-card)',
              color: 'var(--c-text)',
              border: '1px solid var(--c-border)',
            }}
          >
            {backToPurchasedBusy
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Возвращаем...</>
              : 'Вернуться к купленному'}
          </button>
        )}

        {onBackToAvailable && (
          <button
            type="button"
            onClick={onBackToAvailable}
            disabled={checking || savingModules || backToPurchasedBusy}
            className="w-full h-12 rounded-2xl text-sm font-semibold disabled:opacity-50"
            style={{
              background: 'var(--c-card)',
              color: 'var(--c-muted)',
              border: '1px solid var(--c-border)',
            }}
          >
            Другой предмет
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
            {priceSummary && (
              <p className="text-sm" style={{ color: 'var(--c-muted)' }}>
                Сумма: <strong style={{ color: 'var(--c-text)' }}>{formatPriceRub(priceSummary.total)}</strong>
                {modulesLabel && (
                  <><br /><span className="text-[12px]">{modulesLabel}</span></>
                )}
              </p>
            )}
            <p className="text-[12px] leading-relaxed" style={{ color: 'var(--c-muted)' }}>
              После «Скинул» сразу откроем полный доступ — без пробника.
            </p>
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
                onClaimReceipt?.(selectedModules);
              }}
              className="w-full h-12 rounded-2xl text-sm font-semibold inline-flex items-center justify-center gap-2"
              style={{ background: 'var(--c-primary)', color: 'var(--c-bg)' }}
            >
              {checking ? <><Loader2 className="w-4 h-4 animate-spin" /> Открываем...</> : 'Скинул — войти'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
