import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const publicDir = path.join(root, 'public');
const orthoDir = path.join(publicDir, 'images', 'ortho');
const questionsPath = path.join(root, 'src', 'data', 'questions.json');

const LEGACY_COMMIT = '17e2b86^';
const IMAGE_EXT = /\.(webp|png|jpe?g)$/i;

function existsPublic(urlPath) {
  if (!urlPath?.startsWith('/')) return false;
  return fs.existsSync(path.join(publicDir, urlPath.slice(1)));
}

function toPublicUrl(absPath) {
  return '/' + path.relative(publicDir, absPath).split(path.sep).join('/');
}

/** Файлы прямо в qN/ (без подпапок g*). */
function topLevelQuestionImages(num) {
  const dir = path.join(orthoDir, `q${num}`);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(e => e.isFile() && IMAGE_EXT.test(e.name))
    .map(e => toPublicUrl(path.join(dir, e.name)))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function pickSingleForQuestion(num) {
  const tops = topLevelQuestionImages(num);
  if (tops.length) return tops[0];

  const prefs = [
    path.join(orthoDir, `${num}.webp`),
    path.join(orthoDir, `q${num}`, `${num}.webp`),
    path.join(orthoDir, `q${num}`, `q${num}.webp`),
    path.join(orthoDir, `q${num}`, '1.webp'),
    path.join(orthoDir, `q${num}`, `g${num}`, '1.webp'),
  ];
  for (const abs of prefs) {
    if (fs.existsSync(abs)) return toPublicUrl(abs);
  }
  return null;
}

function resolveLegacyPath(raw, questionId) {
  const s = String(raw || '').trim();
  if (!s) return null;
  if (existsPublic(s)) return s;

  const orthoWebp = s.match(/^\/images\/ortho\/(.+)\.png$/i);
  if (orthoWebp) {
    const webp = `/images/ortho/${orthoWebp[1]}.webp`;
    if (existsPublic(webp)) return webp;
  }

  const flat = s.match(/^\/images\/(\d+)\.png$/i);
  if (flat) {
    const n = Number(flat[1]);
    const candidates = [
      `/images/ortho/${n}.webp`,
      `/images/ortho/q${n}/1.webp`,
      `/images/ortho/q${n}/2.webp`,
      `/images/ortho/q${n}/${n}.webp`,
      `/images/ortho/q${n}/q${n}.webp`,
      `/images/ortho/q${n}/g${n}/1.webp`,
      `/images/ortho/q${questionId}/1.webp`,
    ];
    for (const c of candidates) {
      if (existsPublic(c)) return c;
    }
    return pickSingleForQuestion(n) ?? pickSingleForQuestion(questionId);
  }

  if (/\.png$/i.test(s)) {
    const webp = s.replace(/\.png$/i, '.webp');
    if (existsPublic(webp)) return webp;
  }

  return pickSingleForQuestion(questionId);
}

function normalizeQuestionImages(raw, questionId) {
  if (!raw) return null;
  const srcList = Array.isArray(raw) ? raw : [raw];

  // Массив в legacy — восстанавливаем каждый путь
  if (srcList.length > 1 || (srcList.length === 1 && Array.isArray(raw))) {
    const list = srcList
      .map(p => resolveLegacyPath(p, questionId))
      .filter(Boolean);
    const unique = [...new Set(list)];
    if (unique.length === 0) {
      const tops = topLevelQuestionImages(questionId);
      if (tops.length) return tops.length === 1 ? { image: tops[0] } : { images: tops };
      return null;
    }
    if (unique.length === 1) return { image: unique[0] };
    return { images: unique };
  }

  const one = resolveLegacyPath(srcList[0], questionId);
  if (one) return { image: one };

  const tops = topLevelQuestionImages(questionId);
  if (tops.length === 1) return { image: tops[0] };
  if (tops.length > 1) return { images: tops };
  return null;
}

const legacyJson = execSync(
  `git show ${LEGACY_COMMIT}:src/data/questions.json`,
  { cwd: root, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 },
).replace(/^\uFEFF/, '');
const legacy = JSON.parse(legacyJson);
const legacyById = new Map(legacy.map(q => [Number(q.id), q]));

const questions = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));
let restored = 0;
let missing = 0;

for (const q of questions) {
  const id = Number(q.id);
  const old = legacyById.get(id);
  delete q.image;
  delete q.images;

  if (!old) continue;
  const raw = old.images ?? old.image;
  const next = normalizeQuestionImages(raw, id);
  if (next) {
    Object.assign(q, next);
    restored++;
  } else if (raw) {
    missing++;
    console.warn(`Q${id}: still missing for`, raw);
  }
}

fs.writeFileSync(questionsPath, JSON.stringify(questions, null, 2) + '\n');
console.log(`Restored: ${restored}, missing: ${missing}`);

for (const q of questions) {
  if (q.image || q.images) {
    const n = q.images?.length ?? 1;
    console.log(`Q${q.id} (${n}):`, q.images || q.image);
  }
}
