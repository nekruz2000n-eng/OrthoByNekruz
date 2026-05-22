// ── Russian stemming + glossary regex helpers ─────────────────────────────────
// Shared between QuestionsTab and RichText to avoid duplication.

const _RU_ENDINGS = [
  'ого','его','ому','ему','ыми','ими','ая','яя','ое','ее','ой','ый','ий',
  'ую','юю','ые','ие','ых','их','ам','ям','ах','ях','ов','ев','ём','ом',
  'ем','ей','а','я','ы','и','у','ю','е','о','й','ь',
];

function _ruStem(word: string): string {
  const w = word.toLowerCase().replace(/ё/g, 'е');
  if (w.length <= 3) return w;
  for (const end of _RU_ENDINGS) {
    if (w.length - end.length >= 3 && w.endsWith(end)) return w.slice(0, -end.length);
  }
  return w;
}

function _escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function _buildRegexSource(term: string): string {
  const words = term.split(/[\s-]+/).filter(Boolean);
  if (!words.length) return '';
  const parts = words.map(w => {
    const lw = w.toLowerCase().replace(/ё/g, 'е');
    if (lw.length <= 2) return _escapeRe(lw);
    return _escapeRe(_ruStem(lw)) + '[а-яе]{0,4}';
  });
  return '(?<![а-яеa-z0-9])(?:' + parts.join('[^а-яеa-z0-9]{1,6}') + ')(?![а-яеa-z0-9])';
}

// Module-level cache: term string → compiled regex source.
// Avoids rebuilding the same stemming/escape computation on every render.
const _srcCache = new Map<string, string>();

/**
 * Returns the regex source string for a glossary term, with results cached
 * by term text. The caller should construct `new RegExp(src, 'g')` each time
 * because the `g` flag makes RegExp stateful (lastIndex).
 */
export function termRegexSource(term: string): string {
  const cached = _srcCache.get(term);
  if (cached !== undefined) return cached;
  const src = _buildRegexSource(term);
  _srcCache.set(term, src);
  return src;
}
