'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2, Search } from 'lucide-react';
import { LearnLayout } from '@/components/OrthoLayout';
import { TopicFilter } from '@/components/TopicFilter';
import { loadOrthoData, topicLabel, TOPIC_LABELS } from '@/lib/data';
import type { GlossaryTerm, OrthoData } from '@/types/data';

const PAGE_SIZE = 20;

export default function GlossaryPage() {
  const [data, setData] = useState<OrthoData | null>(null);
  const [search, setSearch] = useState('');
  const [topic, setTopic] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  useEffect(() => {
    loadOrthoData().then(setData);
  }, []);

  const topics = useMemo(
    () => Object.entries(TOPIC_LABELS).map(([id, label]) => ({ id, label })),
    [],
  );

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.glossary.filter(g => {
      if (topic && g.topic !== topic) return false;
      if (!q) return true;
      return (
        g.term.toLowerCase().includes(q) ||
        g.definition.toLowerCase().includes(q) ||
        g.short_definition.toLowerCase().includes(q)
      );
    });
  }, [data, search, topic]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const slice = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  useEffect(() => setPage(0), [search, topic]);

  if (!data) {
    return (
      <LearnLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="animate-spin" style={{ color: 'var(--c-primary)' }} />
        </div>
      </LearnLayout>
    );
  }

  return (
    <LearnLayout>
      <div className="h-full overflow-y-auto scroll-container px-4 pb-4">
        <h1 className="text-xl font-bold mb-3" style={{ color: 'var(--c-text)' }}>Глоссарий</h1>

        <div className="relative mb-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--c-muted)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск термина..."
            className="w-full min-h-[48px] pl-10 pr-4 rounded-xl text-sm"
            style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)', color: 'var(--c-text)' }}
          />
        </div>

        <TopicFilter topics={topics} value={topic} onChange={setTopic} />

        <p className="text-xs my-3" style={{ color: 'var(--c-muted)' }}>
          {filtered.length} терминов
        </p>

        <div className="space-y-2">
          {slice.map(g => (
            <GlossaryCard key={g.term} term={g} />
          ))}
        </div>

        {totalPages > 1 && (
          <div className="flex justify-between items-center mt-4 gap-2">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage(p => p - 1)}
              className="flex-1 min-h-[44px] rounded-xl text-sm font-semibold disabled:opacity-40"
              style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}
            >
              ← Назад
            </button>
            <span className="text-xs" style={{ color: 'var(--c-muted)' }}>{page + 1}/{totalPages}</span>
            <button
              type="button"
              disabled={page >= totalPages - 1}
              onClick={() => setPage(p => p + 1)}
              className="flex-1 min-h-[44px] rounded-xl text-sm font-semibold disabled:opacity-40"
              style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}
            >
              Далее →
            </button>
          </div>
        )}
      </div>
    </LearnLayout>
  );
}

function GlossaryCard({ term }: { term: GlossaryTerm }) {
  const slug = encodeURIComponent(term.term);
  return (
    <Link
      href={`/learn/glossary/${slug}`}
      className="block p-4 rounded-xl min-h-[64px]"
      style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}
    >
      <p className="font-semibold text-sm" style={{ color: 'var(--c-text)' }}>{term.term}</p>
      <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--c-muted)' }}>{term.short_definition}</p>
    </Link>
  );
}
