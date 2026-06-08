/** Общая логика «умного» подбора карточек и утверждений В/Н. */

export interface StudyWeightedQuestion {
  id: number;
  topic?: string;
  subtopic?: string;
  key_facts?: string[];
  difficulty?: string;
  exam_weight?: number;
  repeat_interval?: number;
  clinical_relevance?: string;
  related_questions?: number[];
}

const STOP = new Set([
  'и', 'в', 'на', 'по', 'из', 'для', 'при', 'не', 'что', 'это', 'как', 'или', 'от', 'до', 'со', 'а', 'но',
  'the', 'a', 'an', 'of', 'in', 'on', 'to', 'for', 'with',
]);

export function normalizeFactText(text: string): string {
  return String(text || '')
    .replace(/^[0-9]+\)\s*/u, '')
    .replace(/^[a-zа-я]\.\s*/iu, '')
    .replace(/[«»"“”]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function factTokens(text: string): Set<string> {
  const norm = normalizeFactText(text);
  const raw = norm.split(/[^a-zа-яё0-9]+/iu).filter(t => t.length > 2 && !STOP.has(t));
  return new Set(raw);
}

/** 0…1 — насколько два факта похожи по словам */
export function factSimilarity(a: string, b: string): number {
  const ta = factTokens(a);
  const tb = factTokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  const union = ta.size + tb.size - inter;
  return union > 0 ? inter / union : 0;
}

export function areFactsTooSimilar(a: string, b: string, threshold = 0.55): boolean {
  if (normalizeFactText(a) === normalizeFactText(b)) return true;
  return factSimilarity(a, b) >= threshold;
}

const RELEVANCE_SCORE: Record<string, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

const DIFFICULTY_SCORE: Record<string, number> = {
  easy: 1,
  medium: 2,
  hard: 3,
};

/** Приоритет вопроса для повторения (выше = важнее на экзамене) */
export function questionStudyWeight(q: StudyWeightedQuestion): number {
  const exam = Math.max(1, Number(q.exam_weight) || 2);
  const repeat = Math.max(1, 6 - (Number(q.repeat_interval) || 3));
  const rel = RELEVANCE_SCORE[String(q.clinical_relevance || '').toLowerCase()] ?? 2;
  const diff = DIFFICULTY_SCORE[String(q.difficulty || '').toLowerCase()] ?? 2;
  return exam * 2 + repeat + rel + diff * 0.5;
}

export function pickWeighted<T>(
  items: T[],
  weightFn: (item: T) => number,
): T | null {
  if (items.length === 0) return null;
  let total = 0;
  const weights = items.map(item => {
    const w = Math.max(0.1, weightFn(item));
    total += w;
    return w;
  });
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

export interface FalseDonorPick {
  donor: StudyWeightedQuestion;
  donorFact: string;
  donorFactIndex: number;
}

/**
 * Подбор «чужого» факта: другая подтема, не слишком похож на правильные,
 * желательно из соседней, но не идентичной области.
 */
export function pickFalseDonor(
  target: StudyWeightedQuestion,
  pool: StudyWeightedQuestion[],
): FalseDonorPick | null {
  const targetFacts = (target.key_facts ?? []).map(f => String(f).trim()).filter(Boolean);
  if (targetFacts.length === 0) return null;

  const targetSub = String(target.subtopic || '').trim().toLowerCase();
  const related = new Set((target.related_questions ?? []).map(Number));

  const candidates = pool.filter(q => q.id !== target.id && (q.key_facts?.length ?? 0) > 0);
  if (candidates.length === 0) return null;

  type Scored = FalseDonorPick & { score: number };
  const scored: Scored[] = [];

  for (const donor of candidates) {
    const donorSub = String(donor.subtopic || '').trim().toLowerCase();
    const facts = (donor.key_facts ?? []).map(f => String(f).trim()).filter(Boolean);

    for (let i = 0; i < facts.length; i++) {
      const donorFact = facts[i];
      if (targetFacts.some(tf => areFactsTooSimilar(tf, donorFact))) continue;

      let score = 1;
      if (donorSub && targetSub && donorSub !== targetSub) score += 4;
      if (!related.has(donor.id)) score += 1.5;

      const maxSim = Math.max(...targetFacts.map(tf => factSimilarity(tf, donorFact)));
      if (maxSim >= 0.25 && maxSim < 0.55) score += 2;
      if (maxSim < 0.15) score += 0.5;

      score += questionStudyWeight(donor) * 0.08;
      scored.push({ donor, donorFact, donorFactIndex: i, score });
    }
  }

  if (scored.length === 0) return null;
  return pickWeighted(scored, s => s.score);
}

/** Приоритет темы: слабые и экзаменационно важные — выше */
export function topicSessionBoost(
  topicId: string,
  weakTopics: Set<string>,
  questions: StudyWeightedQuestion[],
): number {
  let boost = 1;
  if (weakTopics.has(topicId)) boost += 2.5;
  const topicQs = questions.filter(q => String(q.topic || 'other') === topicId);
  if (topicQs.length > 0) {
    const avg = topicQs.reduce((s, q) => s + questionStudyWeight(q), 0) / topicQs.length;
    boost += avg * 0.15;
  }
  return boost;
}
