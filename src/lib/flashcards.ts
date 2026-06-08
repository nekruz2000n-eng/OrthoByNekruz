/** Флэшкарты — типы и утилиты (биология). */

export interface BioQuestionFlash {
  id: number;
  topic?: string;
  subtopic?: string;
  key_facts?: string[];
  game_modes?: string[];
  visible?: boolean;
}

export interface FlashcardItem {
  questionId: number;
  factIndex:  number;
  topic:      string;
  subtopic:   string;
  fact:       string;
}

export const BIO_TOPIC_LABELS: Record<string, string> = {
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

export function topicLabel(topicId: string): string {
  return BIO_TOPIC_LABELS[topicId] ?? topicId.replace(/_/g, ' ');
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
      });
    });
  }
  return cards;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Слабые карточки первыми, остальные перемешаны. */
export function buildSessionDeck(
  allCards: FlashcardItem[],
  weakMembers: Set<string>,
  topicFilter: string | null,
): FlashcardItem[] {
  let pool = topicFilter
    ? allCards.filter(c => c.topic === topicFilter)
    : allCards;

  const weak: FlashcardItem[] = [];
  const rest: FlashcardItem[] = [];
  for (const c of pool) {
    const key = flashcardMember(c.questionId, c.factIndex);
    if (weakMembers.has(key)) weak.push(c);
    else rest.push(c);
  }
  return [...shuffle(weak), ...shuffle(rest)];
}

export function weakSetFromList(members: string[]): Set<string> {
  return new Set(members.filter(Boolean));
}
