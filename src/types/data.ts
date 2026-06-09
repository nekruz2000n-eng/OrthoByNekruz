export interface QuizOptions {
  correct: string;
  distractors: string[];
}

export interface TrueFalseStatement {
  statement: string;
  answer: boolean;
}

export interface FillBlankItem {
  template: string;
  answer: string;
  hint: string;
}

export interface MatchPair {
  term: string;
  definition: string;
}

export interface Sequence {
  title: string;
  steps: string[];
}

export interface ClassifyCategory {
  name: string;
  items: string[];
}

export interface ClassifyData {
  categories: ClassifyCategory[];
  pool: string[];
}

export interface Analytics {
  total_attempts: number;
  correct_count: number;
  incorrect_count: number;
  skip_count: number;
  correct_rate: number | null;
  avg_response_time_sec: number | null;
  distractor_picks: Record<string, number>;
  difficulty_confirmed: 'easy' | 'medium' | 'hard' | null;
  discrimination_index: number | null;
  weakest_game_mode: string | null;
  avg_ease_factor: number;
  avg_interval_days: number;
}

export interface SpacedRepetition {
  base_interval_days: number;
  ease_factor_default: number;
  min_interval_days: number;
  max_interval_days: number;
  penalty_on_fail: number;
}

export interface Source {
  book: string;
  authors: string;
  edition: string;
  section: string;
  section_title: string;
}

export interface Question {
  id: number;
  question: string;
  answer: string;
  short_answer: string;
  topic: string;
  subtopic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  question_type: 'theoretical' | 'practical' | 'clinical';
  exam_weight: number;
  keywords: string[];
  tags: string[];
  mnemonic: string | null;
  book_excerpt: string | null;
  source: Source;
  sources_all: Source[];
  game_modes: string[];
  key_facts: string[];
  quiz_options: QuizOptions;
  true_false_statements: TrueFalseStatement[];
  fill_in_blank: FillBlankItem[] | null;
  match_pairs: MatchPair[] | null;
  sequence: Sequence | null;
  classify: ClassifyData | null;
  error_correction: unknown | null;
  compare: unknown | null;
  related_questions: number[];
  related_cases: number[];
  related_tests: string[];
  related_glossary: string[];
  analytics: Analytics;
  spaced_repetition: SpacedRepetition;
}

export interface GlossaryTerm {
  term: string;
  definition: string;
  short_definition: string;
  variations: string[];
  topic: string;
  tags: string[];
  synonyms: string[];
  related_terms: string[];
  related_questions: number[];
  related_cases: number[];
  related_tests: string[];
}

export interface Case {
  id: number;
  title: string;
  scenario: string;
  question: string;
  answer: string;
  short_answer: string;
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  steps: string[] | null;
  key_points: string[];
  related_questions: number[];
  related_glossary: string[];
}

export interface TestOption {
  id: string;
  text: string;
  correct: boolean;
}

export interface Test {
  id: string;
  question: string;
  options: TestOption[];
  explanation: string;
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  related_questions: number[];
  related_glossary: string[];
  analytics: {
    total_attempts: number;
    correct_count: number;
    correct_rate: number | null;
    option_picks: Record<string, number>;
  };
}

export interface OrthoData {
  questions: Question[];
  glossary: GlossaryTerm[];
  cases: Case[];
  tests: Test[];
}
