/** Верно/Неверно — типы и генерация утверждений (биология). */

import {
  type BioQuestionFlash,
  topicLabel,
  BIO_TOPIC_LABELS,
} from '@/lib/flashcards';

export interface BioQuestionTF extends BioQuestionFlash {
  difficulty?: string;
}

export interface TrueFalseStatement {
  questionId: number;
  factIndex:  number;
  topic:      string;
  subtopic:   string;
  statement:  string;
  isTrue:     boolean;
  /** Верный факт из этого вопроса — показываем при ошибке */
  correctFact: string;
}

export type DifficultyFilter = 'all' | 'easy' | 'medium' | 'hard';

export const SESSION_SIZE = 20;

export const DIFFICULTY_LABELS: Record<DifficultyFilter, string> = {
  all:    'Все',
  easy:   'Лёгкий',
  medium: 'Средний',
  hard:   'Сложный',
};

export function statementKey(s: TrueFalseStatement): string {
  return `${s.questionId}:${s.factIndex}`;
}

export function isTrueFalseQuestion(q: BioQuestionTF): boolean {
  if (q.visible === false) return false;
  return Array.isArray(q.key_facts) && q.key_facts.length > 0;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickRandom<T>(arr: T[]): T | null {
  if (arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function filterQuestions(
  questions: BioQuestionTF[],
  topicFilter: string | null,
  difficulty: DifficultyFilter,
): BioQuestionTF[] {
  return questions.filter(q => {
    if (!isTrueFalseQuestion(q)) return false;
    if (topicFilter && String(q.topic || 'other') !== topicFilter) return false;
    if (difficulty !== 'all' && q.difficulty !== difficulty) return false;
    return true;
  });
}

/** Список topic id для чипов фильтра. */
export function listTopics(questions: BioQuestionTF[]): { id: string; label: string; count: number }[] {
  const map = new Map<string, number>();
  for (const q of questions) {
    if (!isTrueFalseQuestion(q)) continue;
    const topic = String(q.topic || 'other');
    map.set(topic, (map.get(topic) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([id, count]) => ({ id, label: topicLabel(id), count }))
    .sort((a, b) => a.label.localeCompare(b.label, 'ru'));
}

function makeTrueStatement(q: BioQuestionTF): TrueFalseStatement | null {
  const facts = (q.key_facts ?? []).map(f => String(f).trim()).filter(Boolean);
  if (facts.length === 0) return null;
  const factIndex = Math.floor(Math.random() * facts.length);
  const topic = String(q.topic || 'other');
  return {
    questionId: q.id,
    factIndex,
    topic,
    subtopic: String(q.subtopic || topicLabel(topic)),
    statement: facts[factIndex],
    isTrue: true,
    correctFact: facts[factIndex],
  };
}

function makeFalseStatement(q: BioQuestionTF, sameTopicPool: BioQuestionTF[]): TrueFalseStatement | null {
  const facts = (q.key_facts ?? []).map(f => String(f).trim()).filter(Boolean);
  if (facts.length === 0) return null;

  const others = sameTopicPool.filter(o => o.id !== q.id);
  const donor = pickRandom(others);
  if (!donor) return null;

  const donorFacts = (donor.key_facts ?? []).map(f => String(f).trim()).filter(Boolean);
  const donorFact = pickRandom(donorFacts);
  if (!donorFact) return null;

  const factIndex = Math.floor(Math.random() * facts.length);
  const topic = String(q.topic || 'other');

  return {
    questionId: q.id,
    factIndex,
    topic,
    subtopic: String(q.subtopic || topicLabel(topic)),
    statement: donorFact,
    isTrue: false,
    correctFact: facts[factIndex],
  };
}

/** Сгенерировать сессию из count утверждений. */
export function buildTrueFalseSession(
  questions: BioQuestionTF[],
  options: {
    topicFilter?: string | null;
    difficulty?: DifficultyFilter;
    count?: number;
    onlyKeys?: Set<string>;
  } = {},
): TrueFalseStatement[] {
  const {
    topicFilter = null,
    difficulty = 'all',
    count = SESSION_SIZE,
    onlyKeys,
  } = options;

  const pool = filterQuestions(questions, topicFilter, difficulty);
  if (pool.length === 0) return [];

  const byTopic = new Map<string, BioQuestionTF[]>();
  for (const q of pool) {
    const topic = String(q.topic || 'other');
    const list = byTopic.get(topic) ?? [];
    list.push(q);
    byTopic.set(topic, list);
  }

  const statements: TrueFalseStatement[] = [];
  const maxAttempts = count * 8;
  let attempts = 0;

  while (statements.length < count && attempts < maxAttempts) {
    attempts += 1;
    const q = pickRandom(pool);
    if (!q) break;

    const topic = String(q.topic || 'other');
    const topicPool = byTopic.get(topic) ?? [q];
    const isTrue = Math.random() < 0.5;

    const stmt = isTrue
      ? makeTrueStatement(q)
      : makeFalseStatement(q, topicPool);

    if (!stmt) continue;
    if (onlyKeys && !onlyKeys.has(statementKey(stmt))) continue;

    statements.push(stmt);
  }

  return shuffle(statements).slice(0, count);
}

export interface TopicSessionResult {
  topicId: string;
  correct: number;
  total:   number;
  percent: number;
}

export function computeTopicResults(
  answers: { statement: TrueFalseStatement; correct: boolean }[],
): TopicSessionResult[] {
  const map = new Map<string, { correct: number; total: number }>();
  for (const { statement, correct } of answers) {
    const entry = map.get(statement.topic) ?? { correct: 0, total: 0 };
    entry.total += 1;
    if (correct) entry.correct += 1;
    map.set(statement.topic, entry);
  }
  return [...map.entries()]
    .map(([topicId, { correct, total }]) => ({
      topicId,
      correct,
      total,
      percent: total > 0 ? Math.round((correct / total) * 100) : 0,
    }))
    .sort((a, b) => a.topicId.localeCompare(b.topicId));
}

export { BIO_TOPIC_LABELS, topicLabel };
