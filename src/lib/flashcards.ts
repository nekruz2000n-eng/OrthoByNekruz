/** Флэшкарты — типы и утилиты. */

import { type StudyWeightedQuestion, pickWeighted, questionStudyWeight } from '@/lib/studyEngine';

export interface BioQuestionFlash extends StudyWeightedQuestion {
  game_modes?: string[];
  visible?: boolean;
}

export interface FlashcardItem {
  questionId: number;
  factIndex:  number;
  topic:      string;
  subtopic:   string;
  fact:       string;
  /** Приоритет для умной колоды */
  weight?:    number;
  /** Источник карточки — для отображения */
  source?:    'question' | 'glossary';
}

export const GLOSSARY_TOPIC_ID = 'glossary';

export const BIO_TOPIC_LABELS: Record<string, string> = {
  [GLOSSARY_TOPIC_ID]: 'Глоссарий',
  cell_biology:       'Клеточная биология',
  cell_division:      'Деление клетки',
  molecular_genetics: 'Молекулярная генетика',
  mutations:          'Мутации',
  chromosomes:        'Хромосомы',
  reproduction:       'Размножение',
  genetics:           'Генетика',
  ontogenesis:        'Онтогенез',
  evolution:          'Эволюция',
  organ_evolution:    'Эволюция органов',
  ecology:            'Экология',
  parasitology:       'Паразитология',
};

export const ORTHO_TOPIC_LABELS: Record<string, string> = {
  [GLOSSARY_TOPIC_ID]: 'Глоссарий',
  anatomy_occlusion:   'Анатомия и окклюзия',
  clasp_prosthetics:   'Бюгельное протезирование',
  fixed_prosthetics:   'Несъёмное протезирование',
  removable_prosthetics: 'Съёмное протезирование',
  organization:        'Организация кабинета',
  lab_equipment:       'Лабораторное оборудование',
};

const SUBJECT_TOPIC_LABELS: Record<string, Record<string, string>> = {
  bio:   BIO_TOPIC_LABELS,
  ortho: ORTHO_TOPIC_LABELS,
};

export function topicLabel(topicId: string, subjectId?: string): string {
  if (topicId === GLOSSARY_TOPIC_ID) return 'Глоссарий';
  const scoped = subjectId ? SUBJECT_TOPIC_LABELS[subjectId]?.[topicId] : undefined;
  if (scoped) return scoped;
  for (const labels of Object.values(SUBJECT_TOPIC_LABELS)) {
    if (labels[topicId]) return labels[topicId];
  }
  return topicId.replace(/_/g, ' ');
}

export function flashcardMember(questionId: number, factIndex: number): string {
  return `${questionId}:${factIndex}`;
}

export function parseFlashcardMember(member: string): { questionId: number; factIndex: number } | null {
  const m = /^(\d+):(\d+)$/.exec(String(member).trim());
  if (!m) return null;
  return { questionId: Number(m[1]), factIndex: Number(m[2]) };
}

export function isFlashcardQuestion(q: BioQuestionFlash): boolean {
  if (q.visible === false) return false;
  if (Array.isArray(q.game_modes) && !q.game_modes.includes('flashcard')) return false;
  return Array.isArray(q.key_facts) && q.key_facts.length > 0;
}

/** Развернуть вопросы в карточки (один key_fact = одна карточка). */
export function expandQuestionsToCards(questions: BioQuestionFlash[]): FlashcardItem[] {
  const cards: FlashcardItem[] = [];
  for (const q of questions) {
    if (!isFlashcardQuestion(q)) continue;
    const topic = String(q.topic || 'other');
    const subtopic = String(q.subtopic || topicLabel(topic));
    q.key_facts!.forEach((fact, idx) => {
      const text = String(fact || '').trim();
      if (!text) return;
      cards.push({
        questionId: q.id,
        factIndex:  idx,
        topic,
        subtopic,
        fact:       text,
        weight:     questionStudyWeight(q),
        source:     'question',
      });
    });
  }
  return cards;
}

export interface GlossaryFlashEntry {
  term?:       string;
  definition?: string;
}

/** Одна запись глоссария = одна карточка (термин → определение). */
export function expandGlossaryToCards(entries: GlossaryFlashEntry[]): FlashcardItem[] {
  const cards: FlashcardItem[] = [];
  entries.forEach((entry, idx) => {
    const term = String(entry.term || '').trim();
    const definition = String(entry.definition || '').trim();
    if (!term || !definition) return;
    cards.push({
      questionId: -(idx + 1),
      factIndex:  0,
      topic:      GLOSSARY_TOPIC_ID,
      subtopic:   term,
      fact:       definition,
      source:     'glossary',
    });
  });
  return cards;
}

/** Вопросы + глоссарий в единую колоду. */
export function expandAllFlashcards(
  questions: BioQuestionFlash[],
  glossary: GlossaryFlashEntry[],
): FlashcardItem[] {
  return [...expandQuestionsToCards(questions), ...expandGlossaryToCards(glossary)];
}

function weightedDeckOrder(cards: FlashcardItem[]): FlashcardItem[] {
  const remaining = [...cards];
  const ordered: FlashcardItem[] = [];
  while (remaining.length > 0) {
    const pick = pickWeighted(remaining, c => c.weight ?? 1);
    if (!pick) break;
    ordered.push(pick);
    remaining.splice(remaining.indexOf(pick), 1);
  }
  return ordered;
}

/** Слабые карточки первыми (по весу), остальные — умный подбор по exam_weight. */
export function buildSessionDeck(
  allCards: FlashcardItem[],
  weakMembers: Set<string>,
  topicFilter: string | null,
): FlashcardItem[] {
  const pool = topicFilter
    ? allCards.filter(c => c.topic === topicFilter)
    : allCards;

  const weak: FlashcardItem[] = [];
  const rest: FlashcardItem[] = [];
  for (const c of pool) {
    const key = flashcardMember(c.questionId, c.factIndex);
    if (weakMembers.has(key)) weak.push(c);
    else rest.push(c);
  }
  return [...weightedDeckOrder(weak), ...weightedDeckOrder(rest)];
}

export function weakSetFromList(members: string[]): Set<string> {
  return new Set(members.filter(Boolean));
}

export interface TopicStats {
  topicId: string;
  label:   string;
  total:   number;
  weak:    number;
}

/** Статистика по темам для модального выбора. */
export function computeTopicStats(
  cards: FlashcardItem[],
  weakMembers: Set<string>,
  subjectId?: string,
): TopicStats[] {
  const map = new Map<string, { total: number; weak: number }>();
  for (const c of cards) {
    const entry = map.get(c.topic) ?? { total: 0, weak: 0 };
    entry.total += 1;
    if (weakMembers.has(flashcardMember(c.questionId, c.factIndex))) entry.weak += 1;
    map.set(c.topic, entry);
  }
  return [...map.entries()]
    .map(([topicId, { total, weak }]) => ({
      topicId,
      label: topicLabel(topicId, subjectId),
      total,
      weak,
    }))
    .sort((a, b) => {
      if (a.topicId === GLOSSARY_TOPIC_ID) return -1;
      if (b.topicId === GLOSSARY_TOPIC_ID) return 1;
      return a.label.localeCompare(b.label, 'ru');
    });
}
