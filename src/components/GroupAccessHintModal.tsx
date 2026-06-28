"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { getSubject } from '@/lib/subjects';

interface GroupAccessHintModalProps {
  subjectIds: string[];
  onContinue: () => void;
}

function formatSubjectList(ids: string[]): string {
  const labels = ids
    .map(id => getSubject(id)?.label || id)
    .filter(Boolean);
  if (labels.length === 0) return 'предметы';
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} и ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')} и ${labels[labels.length - 1]}`;
}

export const GroupAccessHintModal: React.FC<GroupAccessHintModalProps> = ({
  subjectIds,
  onContinue,
}) => {
  const labels = formatSubjectList(subjectIds);
  const multiple = subjectIds.length > 1;

  return (
    <div
      className="dark fixed inset-0 z-[110] flex items-center justify-center p-6 backdrop-blur-xl animate-in fade-in zoom-in duration-300"
      style={{ background: 'rgba(10,14,12,0.88)' }}
    >
      <div className="w-full max-w-sm bg-[#121815] border border-white/10 p-8 rounded-[32px] shadow-2xl text-center space-y-5">
        <div className="inline-flex p-3 bg-[#a3e635]/10 rounded-full text-[28px] leading-none">
          🎓
        </div>
        <div className="space-y-3">
          <h2 className="text-2xl font-bold tracking-tight text-white">Доступ по группе открыт</h2>
          <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.72)' }}>
            {multiple
              ? <>Тебе открыты: <span className="font-semibold text-white">{labels}</span>.</>
              : <>Тебе открыт <span className="font-semibold text-white">{labels}</span>.</>}
          </p>
          <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
            {multiple
              ? 'Переключайся между предметами через «Сменить предмет» в разделе «Статистика».'
              : 'Если позже откроют ещё предметы — переключайся через «Сменить предмет» в «Статистике».'}
          </p>
        </div>
        <Button
          onClick={onContinue}
          className="w-full h-14 rounded-2xl text-lg font-bold"
        >
          Понятно
        </Button>
      </div>
    </div>
  );
};
