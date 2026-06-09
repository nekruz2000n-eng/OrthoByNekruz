'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { LearnLayout } from '@/components/OrthoLayout';

const MODES = [
  { id: 'flashcard', label: 'Флэшкарты', desc: 'Вопрос → ответ, самооценка' },
  { id: 'quiz', label: 'Quiz', desc: 'Выбор правильного ответа' },
  { id: 'true_false', label: 'Верно/Неверно', desc: 'Утверждения из key_facts' },
  { id: 'fill_blank', label: 'Заполни пропуск', desc: 'Ключевые термины' },
  { id: 'match_pairs', label: 'Сопоставь', desc: 'Термин — определение' },
  { id: 'sequence', label: 'Порядок шагов', desc: 'Расставь последовательность' },
];

export default function StudySelectPage() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    import('@/lib/data').then(m => m.loadOrthoData()).then(() => setReady(true));
  }, []);

  return (
    <LearnLayout>
      <div className="h-full overflow-y-auto scroll-container px-4 pb-4">
        <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--c-text)' }}>Режим изучения</h1>
        <p className="text-sm mb-4" style={{ color: 'var(--c-muted)' }}>Выбери формат карточки</p>

        {!ready ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin" style={{ color: 'var(--c-primary)' }} />
          </div>
        ) : (
          <div className="space-y-3">
            <Link
              href="/learn/study/session"
              className="block p-4 rounded-2xl min-h-[64px]"
              style={{ background: 'var(--c-primary)', color: 'var(--c-bg)' }}
            >
              <p className="font-bold">Умная сессия ⚡</p>
              <p className="text-sm opacity-90">10 карточек с адаптацией режима</p>
            </Link>

            {MODES.map(m => (
              <Link
                key={m.id}
                href={`/learn/study/${m.id}`}
                className="block p-4 rounded-2xl min-h-[64px]"
                style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}
              >
                <p className="font-semibold" style={{ color: 'var(--c-text)' }}>{m.label}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--c-muted)' }}>{m.desc}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </LearnLayout>
  );
}
