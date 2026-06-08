/** Верно/Неверно — умная генерация утверждений. */

import {
  type BioQuestionFlash,
  topicLabel,
  BIO_TOPIC_LABELS,
} from '@/lib/flashcards';
import {
  type StudyWeightedQuestion,
  areFactsTooSimilar,
  pickFalseDonor,
  pickWeighted,
  questionStudyWeight,
  topicSessionBoost,
} from '@/lib/studyEngine';

export interface BioQuestionTF extends BioQuestionFlash, StudyWeightedQuestion {}

export interface TrueFalseStatement {
  questionId: number;
  factIndex:  number;
  topic:      string;
  subtopic:   string;
  statement:  string;
  isTrue:     boolean;
  correctFact: string;
  donorSubtopic?: string;
}

export type DifficultyFilter = 'all' | 'easy' | 'medium' | 'hard';

export const SESSION_SIZE = 20;
export const TRUE_STATEMENT_RATIO = 0.7;

export const DIFFICULTY_LABELS: Record<DifficultyFilter, string> = {
  all:    'Все',
  easy:   'Лёгкий',
  medium: 'Средний',
  hard:   'Сложный',
};

export function statementKey(s: TrueFalseStatement): string {
  return `${s.questionId}:${s.factIndex}:${normalizeStmt(s.statement)}`;
}

function normalizeStmt(s: string): string {
  return s.trim().toLowerCase().slice(0, 48);
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

export function listTopics(
  questions: BioQuestionTF[],
  subjectId?: string,
): { id: string; label: string; count: number }[] {
  const map = new Map<string, number>();
  for (const q of questions) {
    if (!isTrueFalseQuestion(q)) continue;
    const topic = String(q.topic || 'other');
    map.set(topic, (map.get(topic) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([id, count]) => ({ id, label: topicLabel(id, subjectId), count }))
    .sort((a, b) => a.label.localeCompare(b.label, 'ru'));
}

/** Выбрать факт, который реже попадался в сессии */
function pickFactIndex(
  q: BioQuestionTF,
  usedFactKeys: Set<string>,
): number | null {
  const facts = (q.key_facts ?? []).map(f => String(f).trim()).filter(Boolean);
  if (facts.length === 0) return null;

  const candidates = facts
    .map((fact, idx) => ({ idx, fact, used: usedFactKeys.has(`${q.id}:${idx}`) }))
    .sort((a, b) => (a.used === b.used ? 0 : a.used ? 1 : -1));

  const fresh = candidates.filter(c => !c.used);
  const pool = fresh.length > 0 ? fresh : candidates;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  return pick.idx;
}

function makeTrueStatement(
  q: BioQuestionTF,
  usedFactKeys: Set<string>,
): TrueFalseStatement | null {
  const facts = (q.key_facts ?? []).map(f => String(f).trim()).filter(Boolean);
  const factIndex = pickFactIndex(q, usedFactKeys);
  if (factIndex === null) return null;

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

function makeFalseStatement(
  q: BioQuestionTF,
  topicPool: BioQuestionTF[],
  usedFactKeys: Set<string>,
): TrueFalseStatement | null {
  const facts = (q.key_facts ?? []).map(f => String(f).trim()).filter(Boolean);
  if (facts.length === 0) return null;

  const pick = pickFalseDonor(q, topicPool);
  if (!pick) return null;

  const factIndex = pickFactIndex(q, usedFactKeys) ?? 0;
  const topic = String(q.topic || 'other');

  if (areFactsTooSimilar(facts[factIndex], pick.donorFact)) return null;

  return {
    questionId: q.id,
    factIndex,
    topic,
    subtopic: String(q.subtopic || topicLabel(topic)),
    statement: pick.donorFact,
    isTrue: false,
    correctFact: facts[factIndex],
    donorSubtopic: String(pick.donor.subtopic || topicLabel(topic)),
  };
}

function pickQuestionForSession(
  pool: BioQuestionTF[],
  weakTopics: Set<string>,
): BioQuestionTF | null {
  return pickWeighted(pool, q => {
    const topic = String(q.topic || 'other');
    return questionStudyWeight(q) * topicSessionBoost(topic, weakTopics, pool);
  });
}

export function buildTrueFalseSession(
  questions: BioQuestionTF[],
  options: {
    topicFilter?: string | null;
    difficulty?: DifficultyFilter;
    count?: number;
    onlyKeys?: Set<string>;
    weakTopics?: Set<string>;
  } = {},
): TrueFalseStatement[] {
  const {
    topicFilter = null,
    difficulty = 'all',
    count = SESSION_SIZE,
    onlyKeys,
    weakTopics = new Set(),
  } = options;

  const pool = filterQuestions(questions, topicFilter, difficulty);
  if (pool.length === 0) return [];

  const targetTrue = Math.max(1, Math.round(count * TRUE_STATEMENT_RATIO));
  const targetFalse = Math.max(0, count - targetTrue);

  const tryAdd = (
    list: TrueFalseStatement[],
    stmt: TrueFalseStatement | null,
    seen: Set<string>,
    usedFacts: Set<string>,
  ): boolean => {
    if (!stmt) return false;
    const key = statementKey(stmt);
    if (onlyKeys && !onlyKeys.has(key)) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    usedFacts.add(`${stmt.questionId}:${stmt.factIndex}`);
    list.push(stmt);
    return true;
  };

  const seen = new Set<string>();
  const usedFacts = new Set<string>();
  const trueStmts: TrueFalseStatement[] = [];
  const falseStmts: TrueFalseStatement[] = [];
  const maxAttempts = count * 12;
  let attempts = 0;

  while (
    (trueStmts.length < targetTrue || falseStmts.length < targetFalse)
    && attempts < maxAttempts
  ) {
    attempts += 1;
    const q = pickQuestionForSession(pool, weakTopics);
    if (!q) break;

    if (trueStmts.length < targetTrue) {
      tryAdd(trueStmts, makeTrueStatement(q, usedFacts), seen, usedFacts);
    }
    if (falseStmts.length < targetFalse) {
      tryAdd(falseStmts, makeFalseStatement(q, pool, usedFacts), seen, usedFacts);
    }
  }

  return shuffle([...trueStmts, ...falseStmts]).slice(0, count);
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
