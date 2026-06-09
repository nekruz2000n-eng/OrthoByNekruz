/**
 * Copy answer/content fields from orthopedics.json (git HEAD) into src/data/*.json.
 * Ortho is authoritative for: question, answer, short_answer, key_facts,
 * quiz_options, true_false_statements, fill_in_blank, match_pairs, sequence,
 * test question/options/correct/explanation, task question/answer, glossary definition.
 *
 *   node scripts/sync_answers_from_ortho.mjs
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8').replace(/^\uFEFF/, ''));
}

function writeJson(rel, data) {
  fs.writeFileSync(path.join(root, rel), JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function loadOrtho() {
  const raw = execSync('git show HEAD:public/data/orthopedics.json', {
    cwd: root,
    maxBuffer: 50 * 1024 * 1024,
  });
  return JSON.parse(raw.toString('utf8'));
}

function caseQuestionText(oc) {
  const scenario = String(oc.scenario || '').trim();
  const body = String(oc.question || '').trim();
  if (scenario && body) return `${scenario}\n\n${body}`;
  return scenario || body;
}

const ortho = loadOrtho();
const questions = readJson('src/data/questions.json');
const tests = readJson('src/data/tests.json');
const tasks = readJson('src/data/tasks.json');
const glossary = readJson('src/data/glossary.json');

const orthoQ = new Map(ortho.questions.map(q => [q.id, q]));
const orthoT = new Map(ortho.tests.map(t => [String(t.id).padStart(3, '0'), t]));
const orthoCase = new Map(ortho.cases.map(c => [c.id, c]));
const orthoG = new Map(ortho.glossary.map(g => [g.term.toLowerCase(), g]));

let stats = { q: 0, t: 0, tk: 0, g: 0 };

const outQuestions = questions.map(q => {
  if (q.subject && q.subject !== 'orthopedics') return q;
  const o = orthoQ.get(q.id);
  if (!o) return q;
  stats.q++;
  return {
    ...q,
    question: o.question,
    answer: o.answer,
    short_answer: o.short_answer,
    key_facts: o.key_facts,
    quiz_options: o.quiz_options,
    true_false_statements: o.true_false_statements,
    fill_in_blank: o.fill_in_blank,
    match_pairs: o.match_pairs,
    sequence: o.sequence,
    subtopic: o.subtopic || q.subtopic,
    topic: o.topic || q.topic,
    difficulty: o.difficulty || q.difficulty,
    question_type: o.question_type || q.question_type,
    keywords: o.keywords?.length ? o.keywords : q.keywords,
    game_modes: o.game_modes?.length ? o.game_modes : q.game_modes,
    source: o.source || q.source,
    sources_all: o.sources_all?.length ? o.sources_all : q.sources_all,
    spaced_repetition: o.spaced_repetition || q.spaced_repetition,
    related_questions: o.related_questions?.length ? o.related_questions : q.related_questions,
    related_tests: o.related_tests?.length ? o.related_tests : q.related_tests,
    related_glossary: o.related_glossary?.length ? o.related_glossary : q.related_glossary,
    related_cases: o.related_cases?.length ? o.related_cases : q.related_cases,
  };
});

const outTests = tests.map(t => {
  const id = String(t.id).padStart(3, '0');
  const o = orthoT.get(id);
  if (!o) return t;
  stats.t++;
  const correct = o.options?.find(opt => opt.correct)?.text ?? t.correct;
  const options = (o.options || []).map(opt => String(opt.text));
  return {
    ...t,
    question: o.question,
    options: options.length ? options : t.options,
    correct,
    explanation: o.explanation ?? t.explanation ?? '',
    topic: o.topic || t.topic,
    difficulty: o.difficulty || t.difficulty,
    related_questions: o.related_questions?.length ? o.related_questions : t.related_questions,
    related_glossary: o.related_glossary?.length ? o.related_glossary : t.related_glossary,
  };
});

const outTasks = tasks.map(task => {
  const o = orthoCase.get(task.id);
  if (!o) return task;
  stats.tk++;
  return {
    ...task,
    question: caseQuestionText(o),
    answer: o.answer,
    title: o.title || task.title,
    short_answer: o.short_answer || task.short_answer,
    topic: o.topic || task.topic,
    difficulty: o.difficulty || task.difficulty,
    key_points: o.key_points?.length ? o.key_points : task.key_points,
    related_questions: o.related_questions?.length ? o.related_questions : task.related_questions,
    related_glossary: o.related_glossary?.length ? o.related_glossary : task.related_glossary,
  };
});

const outGlossary = glossary.map(g => {
  const o = orthoG.get(g.term.toLowerCase());
  if (!o) return g;
  stats.g++;
  return {
    ...g,
    definition: o.definition,
    short_definition: o.short_definition || g.short_definition,
    topic: o.topic || g.topic,
    synonyms: o.synonyms?.length ? o.synonyms : g.synonyms,
    related_terms: o.related_terms?.length ? o.related_terms : g.related_terms,
    related_questions: o.related_questions?.length ? o.related_questions : g.related_questions,
    related_tests: o.related_tests?.length ? o.related_tests : g.related_tests,
    related_cases: o.related_cases?.length ? o.related_cases : g.related_cases,
  };
});

writeJson('src/data/questions.json', outQuestions);
writeJson('src/data/tests.json', outTests);
writeJson('src/data/tasks.json', outTasks);
writeJson('src/data/glossary.json', outGlossary);

console.log('Synced content from orthopedics.json (git HEAD):', stats);
