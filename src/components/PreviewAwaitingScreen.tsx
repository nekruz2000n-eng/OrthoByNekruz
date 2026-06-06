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
  /** Уже купленные разделы — не кликабельны на экране докупки. */
  grantedModules?: PreviewModule[];
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
  grantedModules = [],
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
  const grantedSet = useMemo(
    () => new Set(normalizePreviewModules(grantedModules)),
    [grantedModules],
  );
  const pickPayableModules = useCallback(
    (mods: string[] | PreviewModule[]) =>
      normalizePreviewModules(mods).filter(m => !grantedSet.has(m)),
    [grantedSet],
  );
  const [selectedModules, setSelectedModules] = useState<PreviewModule[]>(
    () => pickPayableModules(chosenModules),
  );

  useEffect(() => {
    setSelectedModules(pickPayableModules(chosenModules));
  }, [chosenModules, pickPayableModules]);

  const subjectCfg = chosenSubject ? getSubject(chosenSubject) : null;
  const moduleRow = useMemo(
    () => (chosenSubject ? getPaymentModuleRow(chosenSubject, grantedModules) : []),
    [chosenSubject, grantedModules],
  );
  const hasOwnedModules = grantedSet.size > 0;

  const priceSummary = useMemo(() => {
    if (!chosenSubject || selectedModules.length === 0) return null;
    return describePreviewPrice(chosenSubject, selectedModules);
  }, [chosenSubject, selectedModules]);

  const modulesLabel = formatPreviewModulesList(selectedModules);
  const canEditModules = !receiptClaimed && moduleRow.some(o => o.selectable);

  const toggleModule = (id: PreviewModule, selectable: boolean, alreadyOwned?: boolean) => {
    if (!canEditModules || !selectable || alreadyOwned || grantedSet.has(id)) return;
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

  const handlePurchaseClick = () => {
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

  const handleExitClick = () => {
    if (onBackToPurchased) {
      onBackToPurchased();
      return;
    }
    onBackToAvailable?.();
  };

  const canExit = !!(onBackToPurchased || onBackToAvailable);
  const exitLabel = onBackToPurchased ? 'Выйти' : 'Назад';

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
                {hasOwnedModules
                  ? 'Купленные разделы отмечены — выбери только новые для докупки'
                  : 'Выбери разделы — сумма обновится сразу'}
              </p>
            )}

            <div className="flex flex-row items-stretch gap-1.5 w-full">
              {moduleRow.map(opt => {
                const owned = opt.alreadyOwned === true;
                const active = !owned && selectedModules.includes(opt.id);
                const disabled = owned || !canEditModules || savingModules || !opt.selectable;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={disabled}
                    title={owned ? 'Уже куплен' : undefined}
                    onClick={() => toggleModule(opt.id, opt.selectable, opt.alreadyOwned)}
                    className="flex-1 min-w-0 h-9 rounded-lg transition-all active:scale-[0.97] disabled:cursor-not-allowed inline-flex flex-col items-center justify-center gap-0.5"
                    style={{
                      background: owned
                        ? 'rgba(52, 211, 153, 0.1)'
                        : active
                          ? `color-mix(in srgb, ${accent} 18%, var(--c-card))`
                          : 'var(--c-bg)',
                      border: owned
                        ? '1.5px solid rgba(52, 211, 153, 0.35)'
                        : active
                          ? `1.5px solid ${accent}`
                          : '1px solid var(--c-border)',
                      opacity: owned ? 0.85 : opt.selectable ? (disabled ? 0.55 : 1) : 0.35,
                    }}
                  >
                    <span
                      className="text-[10px] font-bold leading-none whitespace-nowrap"
                      style={{ color: owned ? 'rgb(52, 211, 153)' : active ? accent : 'var(--c-muted)' }}
                    >
                      {opt.shortLabel}
                    </span>
                    {owned && (
                      <span className="text-[8px] font-semibold leading-none" style={{ color: 'rgb(52, 211, 153)' }}>
                        куплен
                      </span>
                    )}
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

        {(onCheckStatus || onClaimReceipt) && (
          <div className={`flex gap-2 w-full ${canExit ? '' : ''}`}>
            {canExit && (
              <button
                type="button"
                onClick={handleExitClick}
                disabled={checking || savingModules || backToPurchasedBusy}
                className="flex-1 h-12 rounded-2xl text-sm font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2"
                style={{
                  background: 'var(--c-card)',
                  color: 'var(--c-text)',
                  border: '1px solid var(--c-border)',
                }}
              >
                {backToPurchasedBusy
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> ...</>
                  : exitLabel}
              </button>
            )}
            <button
              type="button"
              onClick={handlePurchaseClick}
              disabled={checking || savingModules || (!receiptClaimed && selectedModules.length === 0)}
              className={`${canExit ? 'flex-1' : 'w-full'} h-12 rounded-2xl text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50`}
              style={{
                background: 'var(--c-primary)',
                color: 'var(--c-bg)',
              }}
            >
              {checking
                ? <><Loader2 className="w-4 h-4 animate-spin" /> ...</>
                : receiptClaimed ? 'Проверить статус' : 'Приобрести'}
            </button>
          </div>
        )}
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
