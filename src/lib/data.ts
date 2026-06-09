import type { OrthoData, Question } from '@/types/data';
import type { CardProgress } from '@/lib/progress';

const CACHE_KEY = 'ortho_data_v3';

let _cache: OrthoData | null = null;

export async function loadOrthoData(): Promise<OrthoData> {
  if (_cache) return _cache;

  if (typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        _cache = JSON.parse(cached) as OrthoData;
        return _cache;
      }
    } catch { /* fetch fresh */ }
  }

  const res = await fetch('/data/orthopedics.json');
  if (!res.ok) throw new Error('Failed to load orthopedics.json');
  const data = (await res.json()) as OrthoData;
  _cache = data;

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch { /* quota */ }
  }

  return data;
}

export function getQuestionById(data: OrthoData, id: number): Question | undefined {
  return data.questions.find(q => q.id === id);
}

export function getGlossaryByTerm(data: OrthoData, term: string): import('@/types/data').GlossaryTerm | undefined {
  const norm = term.trim().toLowerCase();
  return data.glossary.find(g => g.term.toLowerCase() === norm);
}

const DIFF_ORDER: Record<string, number> = { easy: 0, medium: 1, hard: 2 };

/** New cards queue: exam_weight desc, then difficulty easy→hard */
export function sortNewQuestions(questions: Question[]): Question[] {
  return [...questions].sort((a, b) => {
    const ew = (b.exam_weight ?? 1) - (a.exam_weight ?? 1);
    if (ew !== 0) return ew;
    return (DIFF_ORDER[a.difficulty] ?? 1) - (DIFF_ORDER[b.difficulty] ?? 1);
  });
}

export function pickGameMode(question: Question, card: CardProgress): string {
  const available = question.game_modes;
  if (available.length === 0) return 'flashcard';

  if (card.weakest_mode && available.includes(card.weakest_mode)) {
    if (Math.random() < 0.6) return card.weakest_mode;
  }

  if (card.total_attempts < 3 && available.includes('flashcard')) {
    return 'flashcard';
  }

  const others = available.filter(m => m !== card.last_game_mode);
  if (others.length === 0) return available[0];
  return others[Math.floor(Math.random() * others.length)];
}

export function buildStudySession(
  data: OrthoData,
  progress: import('@/lib/progress').UserProgress,
  limit = 10,
): { question: Question; mode: string }[] {
  const dueIds = new Set(
    Object.values(progress.cards)
      .filter(c => c.type === 'question' && new Date(c.next_review) <= new Date())
      .map(c => Number(c.id)),
  );

  const due = data.questions.filter(q => dueIds.has(q.id));
  const studied = new Set(Object.keys(progress.cards).map(k => k.split(':')[1]));
  const fresh = sortNewQuestions(data.questions.filter(q => !studied.has(String(q.id))));

  const pool = [...due, ...fresh].slice(0, limit);
  return pool.map(q => {
    const key = `question:${q.id}`;
    const card = progress.cards[key] ?? {
      id: q.id,
      type: 'question' as const,
      ease_factor: 2.5,
      interval_days: 3,
      next_review: new Date().toISOString(),
      correct_streak: 0,
      total_attempts: 0,
      correct_count: 0,
      last_game_mode: '',
      weakest_mode: null,
      mode_stats: {},
    };
    return { question: q, mode: pickGameMode(q, card) };
  });
}

export const TOPIC_LABELS: Record<string, string> = {
  anatomy_occlusion: 'Анатомия и окклюзия',
  clasp_prosthetics: 'Бюгельное протезирование',
  fixed_prosthetics: 'Несъёмное протезирование',
  removable_prosthetics: 'Съёмное протезирование',
  organization: 'Организация кабинета',
  lab_equipment: 'Лабораторное оборудование',
};

export function topicLabel(topic: string): string {
  return TOPIC_LABELS[topic] ?? topic.replace(/_/g, ' ');
}
