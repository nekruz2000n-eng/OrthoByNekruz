'use client';

import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { LearnLayout } from '@/components/OrthoLayout';
import { GameWrapper } from '@/components/GameWrapper';
import { loadOrthoData } from '@/lib/data';
import type { Case, OrthoData } from '@/types/data';

export default function CasesPage() {
  const [data, setData] = useState<OrthoData | null>(null);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    loadOrthoData().then(setData);
  }, []);

  if (!data) {
    return (
      <LearnLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="animate-spin" style={{ color: 'var(--c-primary)' }} />
        </div>
      </LearnLayout>
    );
  }

  const cases = data.cases;

  if (playing) {
    const c = cases[idx];
    return (
      <LearnLayout>
        <div className="h-full flex flex-col">
          <GameWrapper
            caseItem={c}
            mode="case"
            sessionIndex={idx}
            sessionTotal={cases.length}
            onNext={() => {
              if (idx + 1 >= cases.length) {
                setPlaying(false);
                setIdx(0);
              } else {
                setIdx(i => i + 1);
              }
            }}
          />
        </div>
      </LearnLayout>
    );
  }

  return (
    <LearnLayout>
      <div className="h-full overflow-y-auto scroll-container px-4 pb-4">
        <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--c-text)' }}>Клинические задачи</h1>
        <p className="text-sm mb-4" style={{ color: 'var(--c-muted)' }}>{cases.length} кейсов</p>

        <button
          type="button"
          onClick={() => setPlaying(true)}
          className="w-full min-h-[48px] rounded-xl font-semibold mb-4"
          style={{ background: 'var(--c-primary)', color: 'var(--c-bg)' }}
        >
          Начать с первого
        </button>

        <div className="space-y-2">
          {cases.map((c, i) => (
            <CaseListItem key={c.id} caseItem={c} onSelect={() => { setIdx(i); setPlaying(true); }} />
          ))}
        </div>
      </div>
    </LearnLayout>
  );
}

function CaseListItem({ caseItem, onSelect }: { caseItem: Case; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full text-left p-4 rounded-xl min-h-[64px]"
      style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}
    >
      <p className="font-semibold text-sm" style={{ color: 'var(--c-text)' }}>
        #{caseItem.id} {caseItem.title}
      </p>
      <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--c-muted)' }}>
        {caseItem.scenario.replace(/\*\*/g, '').slice(0, 120)}…
      </p>
    </button>
  );
}
