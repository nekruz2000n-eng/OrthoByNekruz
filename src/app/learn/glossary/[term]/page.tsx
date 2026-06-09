'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Loader2, ArrowLeft } from 'lucide-react';
import { LearnLayout } from '@/components/OrthoLayout';
import { loadOrthoData, getGlossaryByTerm } from '@/lib/data';
import type { GlossaryTerm, OrthoData } from '@/types/data';

export default function GlossaryTermPage() {
  const params = useParams();
  const termSlug = decodeURIComponent(String(params?.term ?? ''));
  const [data, setData] = useState<OrthoData | null>(null);

  useEffect(() => {
    loadOrthoData().then(setData);
  }, []);

  const term: GlossaryTerm | undefined = data ? getGlossaryByTerm(data, termSlug) : undefined;

  if (!data) {
    return (
      <LearnLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="animate-spin" style={{ color: 'var(--c-primary)' }} />
        </div>
      </LearnLayout>
    );
  }

  if (!term) {
    return (
      <LearnLayout>
        <div className="px-4 py-8 text-center">
          <p style={{ color: 'var(--c-muted)' }}>Термин не найден</p>
          <Link href="/learn/glossary" className="text-sm mt-4 inline-block" style={{ color: 'var(--c-primary)' }}>
            ← К глоссарию
          </Link>
        </div>
      </LearnLayout>
    );
  }

  return (
    <LearnLayout>
      <div className="h-full overflow-y-auto scroll-container px-4 pb-4">
        <Link href="/learn/glossary" className="inline-flex items-center gap-1 text-sm mb-4 min-h-[44px]" style={{ color: 'var(--c-primary)' }}>
          <ArrowLeft size={16} /> Глоссарий
        </Link>

        <h1 className="text-2xl font-bold mb-4 capitalize" style={{ color: 'var(--c-text)' }}>{term.term}</h1>

        <div className="p-4 rounded-2xl mb-4 text-sm leading-relaxed" style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)', color: 'var(--c-text)' }}>
          {term.definition}
        </div>

        {term.synonyms.length > 0 && (
          <section className="mb-4">
            <h2 className="text-xs font-bold mb-2" style={{ color: 'var(--c-muted)' }}>Синонимы</h2>
            <div className="flex flex-wrap gap-2">
              {term.synonyms.map(s => (
                <span key={s} className="px-3 py-1 rounded-full text-xs" style={{ background: 'var(--c-chip)' }}>{s}</span>
              ))}
            </div>
          </section>
        )}

        {term.related_terms.length > 0 && (
          <section className="mb-4">
            <h2 className="text-xs font-bold mb-2" style={{ color: 'var(--c-muted)' }}>Связанные термины</h2>
            <div className="flex flex-wrap gap-2">
              {term.related_terms.map(t => (
                <Link
                  key={t}
                  href={`/learn/glossary/${encodeURIComponent(t)}`}
                  className="px-3 py-2 rounded-xl text-xs min-h-[36px] inline-flex items-center"
                  style={{ background: 'var(--c-primary-dim)', color: 'var(--c-primary-strong)' }}
                >
                  {t}
                </Link>
              ))}
            </div>
          </section>
        )}

        {term.related_questions.length > 0 && (
          <section>
            <h2 className="text-xs font-bold mb-2" style={{ color: 'var(--c-muted)' }}>Смотри вопросы</h2>
            <div className="flex flex-wrap gap-2">
              {term.related_questions.map(qid => (
                <Link
                  key={qid}
                  href={`/learn/study/flashcard?q=${qid}`}
                  className="px-3 py-2 rounded-xl text-xs min-h-[36px] inline-flex items-center"
                  style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}
                >
                  Q{qid}
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </LearnLayout>
  );
}
