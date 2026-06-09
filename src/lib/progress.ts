import type { SpacedRepetition } from '@/types/data';

export type CardType = 'question' | 'test' | 'case';
export type Quality = 0 | 1 | 2 | 3;

export interface CardProgress {
  id: number | string;
  type: CardType;
  ease_factor: number;
  interval_days: number;
  next_review: string;
  correct_streak: number;
  total_attempts: number;
  correct_count: number;
  last_game_mode: string;
  weakest_mode: string | null;
  mode_stats: Record<string, { attempts: number; correct: number }>;
  spaced_repetition?: SpacedRepetition;
}

export interface UserProgress {
  cards: Record<string, CardProgress>;
  daily_streak: number;
  last_study_date: string;
  total_xp: number;
  session_streak?: number;
}

const PROGRESS_KEY = 'user_progress';

const DEFAULT_SR: SpacedRepetition = {
  base_interval_days: 3,
  ease_factor_default: 2.5,
  min_interval_days: 1,
  max_interval_days: 30,
  penalty_on_fail: 0.2,
};

export function cardKey(id: number | string, type: CardType = 'question'): string {
  return `${type}:${id}`;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function loadProgress(): UserProgress {
  if (typeof window === 'undefined') return emptyProgress();
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return emptyProgress();
    return { ...emptyProgress(), ...JSON.parse(raw) };
  } catch {
    return emptyProgress();
  }
}

export function saveProgress(progress: UserProgress): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
}

function emptyProgress(): UserProgress {
  return {
    cards: {},
    daily_streak: 0,
    last_study_date: '',
    total_xp: 0,
    session_streak: 0,
  };
}

export function initCard(
  id: number | string,
  type: CardType = 'question',
  sr: SpacedRepetition = DEFAULT_SR,
): CardProgress {
  return {
    id,
    type,
    ease_factor: sr.ease_factor_default,
    interval_days: sr.base_interval_days,
    next_review: new Date().toISOString(),
    correct_streak: 0,
    total_attempts: 0,
    correct_count: 0,
    last_game_mode: '',
    weakest_mode: null,
    mode_stats: {},
    spaced_repetition: sr,
  };
}

export function updateProgress(
  card: CardProgress,
  correct: boolean,
  quality: Quality,
): CardProgress {
  const sr = card.spaced_repetition ?? DEFAULT_SR;
  const penalty = card.ease_factor * sr.penalty_on_fail;

  if (!correct) {
    return {
      ...card,
      ease_factor: Math.max(1.3, card.ease_factor - penalty),
      interval_days: sr.min_interval_days,
      correct_streak: 0,
      next_review: addDays(new Date(), sr.min_interval_days).toISOString(),
      total_attempts: card.total_attempts + 1,
    };
  }

  const newEf = Math.min(
    3.0,
    card.ease_factor + (0.1 - (3 - quality) * (0.08 + (3 - quality) * 0.02)),
  );

  const newInterval =
    card.correct_streak === 0
      ? sr.base_interval_days
      : Math.min(card.interval_days * newEf, sr.max_interval_days);

  return {
    ...card,
    ease_factor: newEf,
    interval_days: newInterval,
    correct_streak: card.correct_streak + 1,
    next_review: addDays(new Date(), newInterval).toISOString(),
    total_attempts: card.total_attempts + 1,
    correct_count: card.correct_count + 1,
  };
}

export function getDueCards(progress: UserProgress): CardProgress[] {
  const now = new Date();
  return Object.values(progress.cards)
    .filter(c => new Date(c.next_review) <= now)
    .sort((a, b) => new Date(a.next_review).getTime() - new Date(b.next_review).getTime());
}

export function correctRate(card: CardProgress): number {
  if (card.total_attempts === 0) return 1;
  return card.correct_count / card.total_attempts;
}

export function isWeakCard(card: CardProgress): boolean {
  return correctRate(card) < 0.5 || card.ease_factor < 2.0;
}

export function updateDailyStreak(progress: UserProgress): UserProgress {
  const today = todayIso();
  if (progress.last_study_date === today) return progress;

  const yesterday = addDays(new Date(), -1).toISOString().slice(0, 10);
  const streak =
    progress.last_study_date === yesterday ? progress.daily_streak + 1 : 1;

  return { ...progress, daily_streak: streak, last_study_date: today };
}

export function calcXp(
  correct: boolean,
  quality: Quality,
  isFirstCorrect: boolean,
  sessionStreak: number,
): number {
  if (!correct) return 0;
  let xp = 10;
  if (quality === 3) xp += 5;
  if (isFirstCorrect) xp += 20;
  if (sessionStreak >= 5) xp += 25;
  return xp;
}

export function recordAnswer(
  qid: number | string,
  gameMode: string,
  correct: boolean,
  quality: Quality,
  type: CardType = 'question',
  sr?: SpacedRepetition,
): { progress: UserProgress; xp: number } {
  let progress = loadProgress();
  const key = cardKey(qid, type);
  const card = progress.cards[key] ?? initCard(qid, type, sr);

  const stats = card.mode_stats[gameMode] ?? { attempts: 0, correct: 0 };
  card.mode_stats[gameMode] = {
    attempts: stats.attempts + 1,
    correct: stats.correct + (correct ? 1 : 0),
  };

  card.weakest_mode =
    Object.entries(card.mode_stats)
      .filter(([, s]) => s.attempts >= 3)
      .sort(([, a], [, b]) => a.correct / a.attempts - b.correct / b.attempts)[0]?.[0] ?? null;

  const isFirstCorrect = correct && card.correct_count === 0;
  const sessionStreak = correct ? (progress.session_streak ?? 0) + 1 : 0;
  const xp = calcXp(correct, quality, isFirstCorrect, sessionStreak);

  const updated = updateProgress(card, correct, quality);
  progress.cards[key] = { ...updated, last_game_mode: gameMode };
  progress.total_xp += xp;
  progress.session_streak = sessionStreak;
  progress = updateDailyStreak(progress);
  saveProgress(progress);

  return { progress, xp };
}
