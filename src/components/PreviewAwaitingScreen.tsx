"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getSubject } from '@/lib/subjects';
import { normalizePreviewModules, type PreviewModule } from '@/lib/previewModules';
import {
  describePreviewPrice,
  formatPriceRub,
  getPaymentModuleOptions,
} from '@/lib/previewPricing';
import { Check, Loader2, X } from 'lucide-react';
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
  onClaimReceipt?: () => void;
  onModulesChange?: (modules: PreviewModule[]) => void;
  onBackToAvailable?: () => void;
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
  const moduleOptions = useMemo(
    () => (chosenSubject ? getPaymentModuleOptions(chosenSubject) : []),
    [chosenSubject],
  );

  const priceSummary = useMemo(() => {
    if (!chosenSubject || selectedModules.length === 0) return null;
    return describePreviewPrice(chosenSubject, selectedModules);
  }, [chosenSubject, selectedModules]);

  const canEditModules = !receiptClaimed && moduleOptions.length > 0;

  const toggleModule = (id: PreviewModule) => {
    if (!canEditModules) return;
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
        <div className="text-5xl">{receiptClaimed ? '📨' : '⏳'}</div>
        <h1 className="text-xl font-bold leading-snug" style={{ color: 'var(--c-text)' }}>
          {receiptClaimed ? 'Чек отправлен — ждём подтверждения' : 'Ты уже знаешь что внутри.'}
        </h1>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--c-muted)' }}>
          {receiptClaimed
            ? 'Админ проверит перевод и откроет доступ по твоему выбору.'
            : <>Плата не за доступ —<br />за то, чтобы не потерять то, что уже нашёл.</>}
        </p>

        {chosenSubject && (
          <div
            className="rounded-2xl p-4 text-left space-y-3"
            style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}
          >
            {subjectCfg && (
              <div className="text-sm text-center">
                <span style={{ color: 'var(--c-muted)' }}>Предмет: </span>
                <strong style={{ color: subjectCfg.color }}>{subjectCfg.label}</strong>
              </div>
            )}

            <div>
              <div className="text-[11px] uppercase tracking-wide mb-2 text-center" style={{ color: 'var(--c-muted)' }}>
                {canEditModules ? 'Что оплачиваешь — нажми, чтобы изменить' : 'Разделы в заявке'}
              </div>
              <div className="flex flex-col gap-2">
                {moduleOptions.map(opt => {
                  const picked = selectedModules.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={!canEditModules || savingModules}
                      onClick={() => toggleModule(opt.id)}
                      className="rounded-2xl p-3 text-left transition-all active:scale-[0.99] disabled:opacity-60"
                      style={{
                        background: picked ? `color-mix(in srgb, ${accent} 12%, var(--c-card))` : 'var(--c-bg)',
                        border: `1.5px solid ${picked ? accent : 'var(--c-border)'}`,
                        cursor: canEditModules ? 'pointer' : 'default',
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                            style={{
                              background: picked ? accent : 'transparent',
                              border: `2px solid ${picked ? accent : 'var(--c-border)'}`,
                              color: picked ? 'var(--c-bg)' : 'transparent',
                            }}
                          >
                            {picked && <Check className="w-3 h-3" strokeWidth={3} />}
                          </span>
                          <span className="text-[14px] font-semibold" style={{ color: 'var(--c-text)' }}>
                            {opt.label}
                          </span>
                        </div>
                        {opt.unitPriceRub != null && (
                          <span className="text-[13px] font-bold shrink-0" style={{ color: picked ? accent : 'var(--c-muted)' }}>
                            {formatPriceRub(opt.unitPriceRub)}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {priceSummary && (
              <div className="pt-1 border-t text-center" style={{ borderColor: 'var(--c-border)' }}>
                <div className="text-[11px] uppercase tracking-wide mb-0.5" style={{ color: 'var(--c-muted)' }}>
                  К переводу
                </div>
                <div className="text-2xl font-extrabold" style={{ color: accent }}>
                  {formatPriceRub(priceSummary.total)}
                  {savingModules && (
                    <Loader2 className="inline w-4 h-4 ml-2 animate-spin opacity-70" />
                  )}
                </div>
                {priceSummary.lines.length > 0 && (
                  <div className="text-[12px] space-y-0.5 pt-1" style={{ color: 'var(--c-muted)' }}>
                    {priceSummary.lines.map(line => (
                      <div key={line}>· {line}</div>
                    ))}
                  </div>
                )}
                <p className="text-[11px] leading-snug pt-1" style={{ color: 'var(--c-muted)', opacity: 0.85 }}>
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

        {onBackToAvailable && (
          <button
            type="button"
            onClick={onBackToAvailable}
            disabled={checking || savingModules}
            className="w-full h-12 rounded-2xl text-sm font-semibold disabled:opacity-50"
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
            {priceSummary && (
              <p className="text-sm" style={{ color: 'var(--c-muted)' }}>
                Сумма: <strong style={{ color: 'var(--c-text)' }}>{formatPriceRub(priceSummary.total)}</strong>
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
