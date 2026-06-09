/**
 * Builds public/data/orthopedics.json from src/data legacy files.
 * Run: node scripts/build_orthopedics_json.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const DEFAULT_SR = {
  base_interval_days: 3,
  ease_factor_default: 2.5,
  min_interval_days: 1,
  max_interval_days: 30,
  penalty_on_fail: 0.2,
};

const DEFAULT_SOURCE = {
  book: 'Аболмасов',
  authors: 'Аболмасов Н.К. и др.',
  edition: '',
  section: '',
  section_title: '',
};

const EMPTY_ANALYTICS = {
  total_attempts: 0,
  correct_count: 0,
  incorrect_count: 0,
  skip_count: 0,
  correct_rate: null,
  avg_response_time_sec: null,
  distractor_picks: {},
  difficulty_confirmed: null,
  discrimination_index: null,
  weakest_game_mode: null,
  avg_ease_factor: 0,
  avg_interval_days: 0,
};

function stripMd(text) {
  return String(text || '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n+/g, ' ')
    .trim();
}

function firstSentence(text) {
  const s = stripMd(text);
  const m = s.match(/^[^.!?]+[.!?]?/);
  return (m ? m[0] : s).slice(0, 200);
}

function pickDistractors(facts, correct, count = 3) {
  const pool = facts.filter(f => f !== correct && f.length > 10);
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  while (shuffled.length < count) {
    shuffled.push(`Неверное утверждение ${shuffled.length + 1}`);
  }
  return shuffled.slice(0, count);
}

function transformQuestion(raw, allQuestions) {
  const facts = (raw.key_facts || []).map(String).filter(Boolean);
  const correct = facts[0] || firstSentence(raw.answer);
  const distractors = pickDistractors(
    allQuestions.flatMap(q => q.key_facts || []),
    correct,
  );

  const tfStatements = facts.slice(0, 3).map((fact, i) => ({
    statement: fact,
    answer: true,
  }));
  if (distractors[0]) {
    tfStatements.push({ statement: distractors[0], answer: false });
  }

  const matchPairs =
    facts.length >= 3
      ? facts.slice(0, 4).map((f, i) => ({
          term: `Пункт ${i + 1}`,
          definition: f,
        }))
      : null;

  const difficulty = ['easy', 'medium', 'hard'].includes(raw.difficulty)
    ? raw.difficulty
    : 'medium';

  const gameModes = Array.isArray(raw.game_modes)
    ? [...raw.game_modes]
    : ['flashcard', 'quiz', 'true_false'];

  if (facts.length >= 3 && !gameModes.includes('match_pairs')) gameModes.push('match_pairs');
  if (facts.length >= 3 && !gameModes.includes('sequence')) gameModes.push('sequence');

  return {
    id: raw.id,
    question: raw.question,
    answer: raw.answer,
    short_answer: firstSentence(raw.answer),
    topic: raw.topic || 'anatomy_occlusion',
    subtopic: raw.subtopic || '',
    difficulty,
    question_type: raw.question_type || 'theoretical',
    exam_weight: Math.min(3, Math.max(1, Math.round((raw.exam_weight || 3) / 2))),
    keywords: raw.keywords || [],
    tags: raw.tags || [],
    mnemonic: raw.mnemonic ?? null,
    book_excerpt: raw.book_excerpt ?? null,
    source: raw.source || { ...DEFAULT_SOURCE, section: raw.subtopic || '' },
    sources_all: raw.sources_all || [raw.source || DEFAULT_SOURCE],
    game_modes: gameModes,
    key_facts: facts,
    quiz_options: { correct, distractors },
    true_false_statements: tfStatements,
    fill_in_blank:
      facts.length > 0
        ? [
            {
              template: `Ключевой факт: ___`,
              answer: facts[0].split(/[,—:]/)[0].trim().slice(0, 40),
              hint: facts[0].slice(0, 60),
            },
          ]
        : null,
    match_pairs: matchPairs,
    sequence:
      facts.length >= 3
        ? { title: stripMd(raw.question).slice(0, 60), steps: facts.slice(0, 5) }
        : null,
    classify: null,
    error_correction: null,
    compare: null,
    related_questions: raw.related_questions || [],
    related_cases: raw.related_cases || [],
    related_tests: raw.related_tests || [],
    related_glossary: raw.related_glossary || [],
    analytics: { ...EMPTY_ANALYTICS },
    spaced_repetition: { ...DEFAULT_SR },
  };
}

function transformGlossary(raw, idx) {
  const def = String(raw.definition || '').trim();
  return {
    term: raw.term,
    definition: def,
    short_definition: def.length > 120 ? def.slice(0, 117) + '…' : def,
    variations: raw.variations || [],
    topic: raw.topic || 'anatomy_occlusion',
    tags: raw.tags || [],
    synonyms: raw.synonyms || [],
    related_terms: raw.related_terms || raw.relatedTerms || [],
    related_questions: raw.related_questions || [],
    related_cases: raw.related_cases || [],
    related_tests: raw.related_tests || [],
  };
}

function transformCase(raw) {
  const parts = String(raw.question || '').split('\n\n');
  const scenario = parts[0] || raw.question;
  const questionText = parts.slice(1).join('\n\n') || raw.question;
  return {
    id: raw.id,
    title: stripMd(scenario).slice(0, 80),
    scenario,
    question: questionText,
    answer: raw.answer,
    short_answer: firstSentence(raw.answer),
    topic: raw.topic || 'lab_equipment',
    difficulty: raw.difficulty || 'medium',
    steps: raw.steps || null,
    key_points: raw.key_points || raw.relatedTerms || [],
    related_questions: raw.related_questions || [],
    related_glossary: raw.related_glossary || raw.relatedTerms || [],
  };
}

function transformTest(raw) {
  const opts = (raw.options || []).map((text, i) => ({
    id: String.fromCharCode(97 + i),
    text: String(text),
    correct: String(text) === String(raw.correct),
  }));
  if (opts.length === 0 && raw.correct) {
    opts.push({ id: 'a', text: raw.correct, correct: true });
  }
  return {
    id: String(raw.id),
    question: raw.question,
    options: opts,
    explanation: raw.explanation || '',
    topic: raw.topic || 'anatomy_occlusion',
    difficulty: raw.difficulty || 'medium',
    related_questions: raw.related_questions || [],
    related_glossary: raw.related_glossary || [],
    analytics: {
      total_attempts: 0,
      correct_count: 0,
      correct_rate: null,
      option_picks: {},
    },
  };
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

const rawQuestions = readJson(path.join(root, 'src/data/questions.json')).filter(
  q => q.subject === 'orthopedics' || !q.subject,
);

const rawGlossary = readJson(path.join(root, 'src/data/glossary.json'));
const rawTasks = readJson(path.join(root, 'src/data/tasks.json'));
const rawTests = readJson(path.join(root, 'src/data/tests.json'));

const questions = rawQuestions.map(q => transformQuestion(q, rawQuestions));
const glossary = rawGlossary.map(transformGlossary);
const cases = rawTasks.map(transformCase);
const tests = rawTests.map(transformTest);

const outDir = path.join(root, 'public/data');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'orthopedics.json');
fs.writeFileSync(
  outPath,
  JSON.stringify({ questions, glossary, cases, tests }, null, 0),
);

console.log(`Wrote ${outPath}`);
console.log(`  questions: ${questions.length}`);
console.log(`  glossary:  ${glossary.length}`);
console.log(`  cases:     ${cases.length}`);
console.log(`  tests:     ${tests.length}`);
