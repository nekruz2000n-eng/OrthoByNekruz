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

/** Есть непустые term и definition — иначе термин не подсвечиваем. */
export function hasValidGlossaryDefinition(
  item: { term?: string; definition?: string } | null | undefined,
): boolean {
  return !!String(item?.term ?? '').trim() && !!String(item?.definition ?? '').trim();
}

export function filterValidGlossary<T extends { term?: string; definition?: string }>(
  items: T[],
): T[] {
  return items.filter(hasValidGlossaryDefinition);
}

/** Найти запись глоссария по term или variations (без учёта регистра). */
export function findGlossaryEntry<T extends { term: string; variations?: string[] }>(
  glossary: T[],
  word: string,
): T | undefined {
  const w = word.toLowerCase().replace(/ё/g, 'е');
  return glossary.find(g => {
    if (g.term.toLowerCase().replace(/ё/g, 'е') === w) return true;
    return (g.variations || []).some(v => v.toLowerCase().replace(/ё/g, 'е') === w);
  });
}

/** Подпись раздела («Противопоказания:») — не термин глоссария. */
export function isSectionHeaderLabel(plain: string, start: number, end: number): boolean {
  if (start >= end || end > plain.length) return false;
  let i = end;
  while (i < plain.length && plain[i] === ' ') i++;
  return i < plain.length && plain[i] === ':';
}

/** @deprecated use isSectionHeaderLabel */
export function isBoldSectionHeader(
  plain: string,
  chars: { bold: boolean }[],
  start: number,
  end: number,
): boolean {
  if (!isSectionHeaderLabel(plain, start, end)) return false;
  for (let i = start; i < end; i++) {
    if (!chars[i]?.bold) return false;
  }
  return true;
}

/** Глоссарий для текста вопроса/ответа: только явные relatedTerms, не весь пул. */
export function glossaryForRelatedTerms<T extends { term?: string; definition?: string }>(
  glossary: T[],
  relatedTerms?: string[],
): T[] {
  const valid = filterValidGlossary(glossary);
  if (!relatedTerms?.length) return [];
  const related = new Set(relatedTerms.map(t => t.trim().toLowerCase()));
  return valid.filter(g => related.has(String(g.term ?? '').trim().toLowerCase()));
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
    return _escapeRe(_ruStem(lw)) + '[а-яе]{0,3}';
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

/** relatedTerms из JSON + related_glossary + Redis-оверрайд (админка). */
export function itemRelatedTerms(item: {
  relatedTerms?: string[];
  related_glossary?: string[];
} | null | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of [...(item?.related_glossary || []), ...(item?.relatedTerms || [])]) {
    const key = String(t).trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(String(t).trim());
  }
  return out;
}
