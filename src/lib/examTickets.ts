import orthoTicketsData from '@/data/ticketsData.json';

export interface ExamRawItem {
  id: number | string;
  question: string;
  answer: string;
}

export interface ExamTicket {
  id: number | string;
  ticketNumber: string | number;
  questions: ExamRawItem[];
  task: ExamRawItem;
}

type DataItem = {
  id?: number | string;
  question?: string;
  answer?: string;
  visible?: boolean;
};

/** Больше 60 вопросов — в билете 3 вопроса + задача, иначе 2 + задача. */
export const EXAM_QUESTIONS_PER_TICKET_THRESHOLD = 60;

export function getQuestionsPerTicket(questionCount: number): number {
  return questionCount > EXAM_QUESTIONS_PER_TICKET_THRESHOLD ? 3 : 2;
}

export function getExamTicketCompositionLabel(questionCount: number): string {
  const q = getQuestionsPerTicket(questionCount);
  return `${q} вопроса + задача`;
}

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

function seededShuffle<T>(arr: T[], seedStr: string): T[] {
  const out = [...arr];
  const rnd = seededRandom(hashSeed(seedStr));
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function toRawItem(item: DataItem, fallbackId: string): ExamRawItem {
  return {
    id: item.id ?? fallbackId,
    question: String(item.question || '').trim(),
    answer: String(item.answer || '').trim(),
  };
}

function normalizePool(items: unknown[]): ExamRawItem[] {
  if (!Array.isArray(items)) return [];
  return items
    .filter((raw): raw is DataItem => raw != null && typeof raw === 'object')
    .filter(item => item.visible !== false)
    .map(item => toRawItem(item, 'item'))
    .filter(item => item.question.length > 0);
}

/** Случайные билеты из пула вопросов и задач (стабильный набор на предмет). */
export function buildRandomExamTickets(
  subjectId: string,
  questions: unknown[],
  tasks: unknown[],
): ExamTicket[] {
  const qPool = normalizePool(questions);
  const tPool = normalizePool(tasks);
  const qPerTicket = getQuestionsPerTicket(qPool.length);
  const ticketCount = Math.min(Math.floor(qPool.length / qPerTicket), tPool.length);
  if (ticketCount < 1) return [];

  const shuffledQ = seededShuffle(qPool, `${subjectId}:exam:questions:${qPerTicket}`);
  const shuffledT = seededShuffle(tPool, `${subjectId}:exam:tasks`);

  const tickets: ExamTicket[] = [];
  for (let i = 0; i < ticketCount; i++) {
    const ticketQuestions: ExamRawItem[] = [];
    for (let j = 0; j < qPerTicket; j++) {
      const q = shuffledQ[i * qPerTicket + j];
      ticketQuestions.push({ ...q, id: q.id ?? `${i + 1}_q${j + 1}` });
    }
    const task = shuffledT[i];
    tickets.push({
      id: i + 1,
      ticketNumber: String(i + 1),
      questions: ticketQuestions,
      task: { ...task, id: task.id ?? `${i + 1}_task` },
    });
  }
  return tickets;
}

/** Билеты для предмета: официальные (ortho) или случайные из вопросов/задач. */
export function buildExamTicketsForSubject(
  subjectId: string,
  questions: unknown[],
  tasks: unknown[],
): ExamTicket[] {
  if (subjectId === 'ortho') {
    return orthoTicketsData as ExamTicket[];
  }
  return buildRandomExamTickets(subjectId, questions, tasks);
}

export function hasExamTicketData(
  subjectId: string,
  questions: unknown[],
  tasks: unknown[],
): boolean {
  if (subjectId === 'ortho') return (orthoTicketsData as ExamTicket[]).length > 0;
  const qPool = normalizePool(questions);
  const tPool = normalizePool(tasks);
  const qPerTicket = getQuestionsPerTicket(qPool.length);
  return qPool.length >= qPerTicket && tPool.length >= 1;
}
