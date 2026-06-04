"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { ToothIcon } from '@/components/ToothIcon';
import { motion, AnimatePresence } from 'framer-motion';
import type { SubjectCatalogEntry } from '@/lib/subjectCatalog';
import type { PreviewModule } from '@/lib/previewModules';
import { PREVIEW_MODULE_LABELS } from '@/lib/previewModules';
import { Loader2, ChevronLeft, Check } from 'lucide-react';

interface PreviewOnboardingScreenProps {
  facultyLabel: string | null;
  subjectCatalog: SubjectCatalogEntry[];
  loading?: boolean;
  onConfirm: (subjectId: string, modules: PreviewModule[]) => void;
}

type Step = 'subject' | 'modules';

export const PreviewOnboardingScreen: React.FC<PreviewOnboardingScreenProps> = ({
  facultyLabel,
  subjectCatalog,
  loading = false,
  onConfirm,
}) => {
  const [step, setStep] = useState<Step>('subject');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedModules, setSelectedModules] = useState<PreviewModule[]>([]);
  const [confirmStep, setConfirmStep] = useState<0 | 1 | 2>(0);

  const selectedEntry = useMemo(
    () => subjectCatalog.find(s => s.id === selectedId) ?? null,
    [subjectCatalog, selectedId],
  );

  const availableModules = useMemo(
    () => selectedEntry?.modules.filter(m => m.available) ?? [],
    [selectedEntry],
  );

  useEffect(() => {
    if (step === 'modules' && availableModules.length === 1) {
      setSelectedModules([availableModules[0].id]);
    }
  }, [step, availableModules]);

  const openSubject = (id: string) => {
    setSelectedId(id);
    setSelectedModules([]);
    setStep('modules');
    setConfirmStep(0);
  };

  const goBack = () => {
    setStep('subject');
    setConfirmStep(0);
    setSelectedModules([]);
  };

  const toggleModule = (id: PreviewModule) => {
    setSelectedModules(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id],
    );
  };

  const modulesLabel = selectedModules
    .map(m => PREVIEW_MODULE_LABELS[m])
    .join(', ');

  return (
    <div
      className="flex flex-col w-full relative overflow-hidden"
      style={{ background: 'var(--c-bg)', height: '100dvh' }}
    >
      <div
        className="flex flex-col items-center text-center px-6 flex-shrink-0 relative z-10"
        style={{ paddingTop: step === 'modules' ? '8vh' : '10vh', paddingBottom: '1vh' }}
      >
        {step === 'modules' && (
          <button
            type="button"
            onClick={goBack}
            className="absolute left-5 top-[8vh] flex items-center gap-1 text-sm font-medium"
            style={{ color: 'var(--c-muted)' }}
          >
            <ChevronLeft className="w-4 h-4" /> Назад к предметам
          </button>
        )}
        <div
          className="w-[72px] h-[72px] rounded-[24px] flex items-center justify-center mb-4"
          style={{
            background: 'var(--c-primary-dim)',
            border: '1.5px solid var(--c-primary-br)',
          }}
        >
          <ToothIcon className="w-10 h-10 text-primary" variant="perfect" />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight mb-2" style={{ color: 'var(--c-text)' }}>
          {step === 'subject' ? 'Выбор предмета' : selectedEntry?.label}
        </h1>
        <p className="text-sm leading-relaxed max-w-xs" style={{ color: 'var(--c-muted)' }}>
          {step === 'subject'
            ? 'Посмотри все предметы и разделы — для пробы отметь только то, что нужно'
            : 'Отметь только то, что нужно — админ увидит заявку'}
        </p>
        {facultyLabel && (
          <p className="text-[11px] mt-2 px-3 py-1 rounded-full" style={{ background: 'var(--c-card)', color: 'var(--c-muted)' }}>
            {facultyLabel}
          </p>
        )}
      </div>

      <div
        className="mx-5 mb-3 rounded-2xl p-4 text-[13px] leading-relaxed relative z-10"
        style={{
          background: 'rgba(220, 38, 38, 0.1)',
          border: '1px solid rgba(220, 38, 38, 0.22)',
          color: 'var(--c-text)',
        }}
      >
        <strong>Без права на ошибку:</strong> после подтверждения предмет и разделы изменить нельзя.
        Нужен только тест — не отмечай вопросы и задачи.
      </div>

      <div
        className="flex-1 overflow-y-auto overscroll-contain relative z-10"
        style={{ WebkitOverflowScrolling: 'touch' as any }}
      >
        <AnimatePresence mode="wait">
          {step === 'subject' ? (
            <motion.div
              key="subjects"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              className="flex flex-col gap-3 w-full max-w-xs mx-auto px-5 pb-4"
            >
              {subjectCatalog.map((item, i) => {
                const readyCount = item.modules.filter(m => m.available).length;
                const inDev = readyCount === 0;
                return (
                  <motion.button
                    key={item.id}
                    type="button"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: Math.min(0.04 * i, 0.35) }}
                    onClick={() => openSubject(item.id)}
                    className="flex items-center gap-3 rounded-[20px] p-4 transition-all duration-200 text-left"
                    style={{
                      opacity: inDev ? 0.55 : 1,
                      background: 'var(--c-card)',
                      border: `1.5px solid ${inDev ? 'var(--c-border)' : item.borderColor}`,
                      cursor: 'pointer',
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: item.color }}>
                        {item.badge}
                      </div>
                      <div className="text-[15px] font-bold leading-snug mb-0.5" style={{ color: 'var(--c-text)' }}>
                        {item.label}
                      </div>
                      <div className="text-[11px]" style={{ color: 'var(--c-muted)' }}>
                        {inDev
                          ? 'В разработке · можно посмотреть разделы'
                          : `${readyCount} из ${item.modules.length} разделов готовы`}
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </motion.div>
          ) : (
            <motion.div
              key="modules"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              className="flex flex-col gap-3 w-full max-w-xs mx-auto px-5 pb-4"
            >
              {availableModules.length === 0 && (
                <div
                  className="rounded-[16px] p-3 text-[12px] leading-relaxed mb-1"
                  style={{
                    background: 'var(--c-card)',
                    border: '1px solid var(--c-border)',
                    color: 'var(--c-muted)',
                  }}
                >
                  Разделы пока в разработке — вернись к списку и выбери предмет с готовыми материалами.
                </div>
              )}
              {selectedEntry?.modules.map(mod => {
                const picked = selectedModules.includes(mod.id);
                const canPick = mod.available;
                return (
                  <button
                    key={mod.id}
                    type="button"
                    disabled={!canPick}
                    onClick={() => canPick && toggleModule(mod.id)}
                    className="rounded-[20px] p-4 text-left transition-all active:scale-[0.99]"
                    style={{
                      background: picked ? selectedEntry.dimColor : 'var(--c-card)',
                      border: `1.5px solid ${
                        picked ? selectedEntry.borderColor
                          : canPick ? 'var(--c-border)' : 'var(--c-border)'
                      }`,
                      opacity: canPick ? 1 : 0.5,
                      cursor: canPick ? 'pointer' : 'not-allowed',
                    }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="text-[14px] font-bold" style={{ color: 'var(--c-text)' }}>
                        {mod.label}
                      </div>
                      {canPick ? (
                        <span
                          className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                          style={{
                            background: picked ? selectedEntry.color : 'transparent',
                            border: `2px solid ${picked ? selectedEntry.color : 'var(--c-border)'}`,
                            color: picked ? 'var(--c-bg)' : 'transparent',
                          }}
                        >
                          {picked && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                          style={{ background: 'var(--c-border)', color: 'var(--c-muted)' }}>
                          в разработке
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] leading-relaxed" style={{ color: 'var(--c-muted)' }}>
                      {mod.description}
                    </p>
                  </button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {step === 'modules' && selectedEntry && (
        <div
          className="flex-shrink-0 w-full px-5 pt-3 pb-5 relative z-10"
          style={{ background: 'linear-gradient(to top, var(--c-bg) 70%, transparent)' }}
        >
          <p className="text-center text-[12px] mb-2" style={{ color: 'var(--c-muted)' }}>
            {selectedModules.length === 0
              ? 'Выбери хотя бы один раздел'
              : `Выбрано: ${modulesLabel}`}
          </p>
          <button
            type="button"
            onClick={() => selectedModules.length > 0 && setConfirmStep(1)}
            disabled={loading || selectedModules.length === 0}
            className="w-full max-w-xs mx-auto block h-[52px] rounded-[18px] text-[15px] font-bold transition-all active:scale-[0.98] disabled:opacity-50"
            style={{
              background: selectedEntry.color,
              color: 'var(--c-bg)',
              boxShadow: `0 8px 24px color-mix(in srgb, ${selectedEntry.color} 35%, transparent)`,
            }}
          >
            {loading
              ? <span className="inline-flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Сохраняем...</span>
              : 'Подтвердить выбор'}
          </button>
        </div>
      )}

      {confirmStep === 1 && selectedEntry && (
        <ConfirmModal
          title="Первое подтверждение"
          body={
            <>
              Предмет: <strong>{selectedEntry.label}</strong><br />
              Разделы: <strong>{modulesLabel}</strong><br />
              {facultyLabel && <>Факультет: <strong>{facultyLabel}</strong></>}
            </>
          }
          warn="Проверь выбор. После второго подтверждения изменить нельзя."
          primaryLabel="Да, всё верно"
          onBack={() => setConfirmStep(0)}
          onPrimary={() => setConfirmStep(2)}
        />
      )}

      {confirmStep === 2 && selectedEntry && (
        <ConfirmModal
          title="Последнее подтверждение"
          body={
            <>
              <strong style={{ color: selectedEntry.color }}>{selectedEntry.label}</strong>
              {' — '}{modulesLabel}
              <br />После подтверждения доступ откроется по выбранным разделам.
            </>
          }
          warn="Это финальный шаг. Поменять выбор после этого нельзя."
          primaryLabel="Открыть доступ"
          loading={loading}
          onBack={() => setConfirmStep(1)}
          onPrimary={() => {
            setConfirmStep(0);
            onConfirm(selectedEntry.id, selectedModules);
          }}
        />
      )}
    </div>
  );
};

function ConfirmModal({
  title, body, warn, primaryLabel, loading, onBack, onPrimary,
}: {
  title: string;
  body: React.ReactNode;
  warn: string;
  primaryLabel: string;
  loading?: boolean;
  onBack: () => void;
  onPrimary: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
    >
      <div
        className="w-full max-w-sm rounded-[24px] p-6 space-y-4"
        style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}
      >
        <h2 className="text-lg font-bold" style={{ color: 'var(--c-text)' }}>{title}</h2>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--c-muted)' }}>{body}</p>
        <p className="text-[13px] font-medium" style={{ color: '#d97706' }}>{warn}</p>
        <div className="flex gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={onBack}
            className="flex-1 h-11 rounded-xl text-sm font-semibold"
            style={{ background: 'var(--c-bg)', border: '1px solid var(--c-border)', color: 'var(--c-text)' }}
          >
            Назад
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onPrimary}
            className="flex-1 h-11 rounded-xl text-sm font-bold"
            style={{ background: 'var(--c-primary)', color: 'var(--c-bg)' }}
          >
            {loading ? '...' : primaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
