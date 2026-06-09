"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getSubject } from '@/lib/subjects';
import { PREVIEW_MODULE_LABELS, type PreviewModule } from '@/lib/previewModules';
import type { PreviewModuleStatusMap } from '@/lib/previewModuleStatus';
import {
  describePreviewPrice,
  formatPriceRub,
  getPaymentModuleRow,
  PAYMENT_MODULE_ROW_ORDER,
} from '@/lib/previewPricing';
import { openTgChat } from '@/lib/tgLinks';
import { Copy, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const TBANK_PHONE_DISPLAY = '+7 900 316 66 46';
const TBANK_PHONE_COPY = '+79003166646';
const RECEIPT_TG_URL = 'https://t.me/evoeidos';
const RECEIPT_TG_HANDLE = '@evoeidos';

const MODULE_ROW_LABELS: Record<PreviewModule, string> = {
  questions: 'Вопросы',
  tests:     'Тест',
  tasks:     'Задачи',
};

interface PreviewPaymentTabPanelProps {
  subjectId: string;
  module: PreviewModule;
  chosenModules: PreviewModule[];
  grantedModules?: PreviewModule[];
  moduleStatuses?: PreviewModuleStatusMap;
  status: 'awaiting_payment' | 'rejected' | 'receipt_pending';
  checking?: boolean;
  modulesUpdating?: boolean;
  onUpdateModules?: (modules: PreviewModule[]) => void;
  onClaimReceipt?: (modules: PreviewModule[]) => void;
  onBackToPurchased?: () => void;
  onBackToAvailable?: () => void;
  backBusy?: boolean;
}

export const PreviewPaymentTabPanel: React.FC<PreviewPaymentTabPanelProps> = ({
  subjectId,
  module,
  chosenModules,
  grantedModules = [],
  moduleStatuses = {},
  status,
  checking = false,
  modulesUpdating = false,
  onUpdateModules,
  onClaimReceipt,
  onBackToPurchased,
  onBackToAvailable,
  backBusy = false,
}) => {
  const { toast } = useToast();
  const [receiptOpen, setReceiptOpen] = useState(false);
  const subjectCfg = getSubject(subjectId);
  const accent = subjectCfg?.color ?? 'hsl(var(--primary))';

  const rowOptions = useMemo(
    () => getPaymentModuleRow(subjectId, grantedModules),
    [subjectId, grantedModules],
  );

  const grantedSet = useMemo(() => new Set(grantedModules), [grantedModules]);

  const pickableModules = useMemo(() => (
    PAYMENT_MODULE_ROW_ORDER.filter(
      m => chosenModules.includes(m) && !grantedSet.has(m),
    )
  ), [chosenModules, grantedSet]);

  const dueModules = useMemo(() => (
    pickableModules.filter(m => {
      const st = moduleStatuses[m];
      return st === 'awaiting_payment' || st === 'rejected';
    })
  ), [pickableModules, moduleStatuses]);

  const defaultPaymentSelection = useMemo(() => {
    if (dueModules.length > 0) return dueModules;
    if (pickableModules.includes(module)) return [module];
    return pickableModules.length > 0 ? [pickableModules[0]] : [];
  }, [dueModules, pickableModules, module]);

  const selectionKey = `${defaultPaymentSelection.join('|')}|${pickableModules.join('|')}`;

  const [selected, setSelected] = useState<PreviewModule[]>(defaultPaymentSelection);

  useEffect(() => {
    setSelected(defaultPaymentSelection);
    if (defaultPaymentSelection.length > 0) {
      onUpdateModules?.(defaultPaymentSelection);
    }
  }, [selectionKey, defaultPaymentSelection, onUpdateModules]);

  const modulePhase = useCallback((id: PreviewModule): 'owned' | 'due' | 'trial' => {
    if (grantedSet.has(id)) return 'owned';
    const st = moduleStatuses[id];
    if (st === 'awaiting_payment' || st === 'rejected') return 'due';
    return 'trial';
  }, [grantedSet, moduleStatuses]);

  const priceSummary = useMemo(
    () => describePreviewPrice(subjectId, selected),
    [subjectId, selected],
  );

  const persistSelection = useCallback((next: PreviewModule[]) => {
    setSelected(next);
    onUpdateModules?.(next);
  }, [onUpdateModules]);

  const toggleModule = useCallback((id: PreviewModule) => {
    const opt = rowOptions.find(o => o.id === id);
    if (!opt?.selectable || opt.alreadyOwned || modulesUpdating || checking) return;
    if (!pickableModules.includes(id)) return;

    const next = selected.includes(id)
      ? selected.filter(m => m !== id)
      : [...selected, id];
    const ordered = PAYMENT_MODULE_ROW_ORDER.filter(m => next.includes(m));
    if (ordered.length === 0) return;
    if (modulePhase(id) === 'due' && dueModules.includes(id) && !next.includes(id)) {
      return;
    }

    persistSelection(ordered);
  }, [
    rowOptions, selected, modulesUpdating, checking, persistSelection,
    pickableModules, modulePhase, dueModules,
  ]);

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

        <div className="flex gap-2 w-full">
          {rowOptions.map(opt => {
            const phase = modulePhase(opt.id);
            const pickable = pickableModules.includes(opt.id);
            const on = selected.includes(opt.id);
            const mustPay = phase === 'due' && dueModules.includes(opt.id);
            const disabled = !opt.selectable || opt.alreadyOwned || !pickable
              || modulesUpdating || checking || (mustPay && on);
            return (
              <button
                key={opt.id}
                type="button"
                disabled={disabled}
                onClick={() => toggleModule(opt.id)}
                className="flex-1 min-w-0 min-h-[44px] rounded-xl text-[11px] font-bold leading-tight px-1 py-1 transition-all active:scale-[0.98] disabled:opacity-40 flex flex-col items-center justify-center gap-0.5"
                style={{
                  background: on
                    ? `color-mix(in srgb, ${accent} 18%, var(--c-card))`
                    : 'var(--c-card)',
                  border: `1.5px solid ${on ? accent : phase === 'due' ? accent : 'var(--c-border)'}`,
                  color: on ? accent : 'var(--c-muted)',
                }}
              >
                {phase === 'owned' ? (
                  '✓'
                ) : (
                  <>
                    <span>{MODULE_ROW_LABELS[opt.id]}</span>
                    {phase === 'trial' && pickable && (
                      <span className="text-[8px] font-semibold uppercase tracking-wide opacity-70">
                        проба
                      </span>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </div>

        {priceSummary && (
          <div
            className="rounded-2xl px-4 py-4"
            style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}
          >
            <div className="flex items-center justify-center gap-2">
              <p className="text-3xl font-bold tabular-nums" style={{ color: accent }}>
                {formatPriceRub(priceSummary.total)}
              </p>
              {modulesUpdating && (
                <Loader2 className="w-4 h-4 animate-spin shrink-0" style={{ color: 'var(--c-muted)' }} />
              )}
            </div>
            <p className="text-xs mt-1.5" style={{ color: 'var(--c-muted)' }}>
              {subjectCfg ? subjectCfg.label : ''}
              {priceSummary.lines.length > 0
                ? `${subjectCfg ? ' · ' : ''}${priceSummary.lines.join(' · ')}`
                : ''}
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
            disabled={checking || modulesUpdating || selected.length === 0}
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
              disabled={checking || selected.length === 0}
              onClick={() => {
                setReceiptOpen(false);
                onClaimReceipt?.(selected);
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
