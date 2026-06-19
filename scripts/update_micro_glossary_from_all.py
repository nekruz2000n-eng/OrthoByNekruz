# -*- coding: utf-8 -*-
"""Sync micro_glossary.json from microbiology_ALL.json, keep variations, fix relatedTerms."""
from __future__ import annotations

import json
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = Path(r"c:\Users\Admin\Downloads\microbiology_ALL.json")
GLOSS_OUT = ROOT / "src" / "data" / "micro_glossary.json"
QUESTIONS_OUT = ROOT / "src" / "data" / "micro_questions.json"
GLOSS_BACKUP = ROOT / "scripts" / "_micro_gloss_pre_update.json"

# old glossary term (normalized) -> new canonical term
TERM_ALIASES: dict[str, str] = {
    "actinomycosis (актиномикоз) чло": "Актиномикоз ЧЛО",
    "галитоз (халитоз)": "Галитоз",
    "лактобациллы (оральные)": "Лактобациллы оральные",
    "aggregatibacter actinomycetemcomitans": "Aggregatibacter actinomycetemcomitans (Aa)",
    "микробный комплекс (по socransky)": "«Красный комплекс»",
}

# relatedTerms in questions -> glossary term (None = drop)
RELATED_FIXES: dict[str, str | None] = {
    "галитоз (халитоз)": "Галитоз",
    "кариесогенность": "Ацидогенность",
    "микробы": None,
}


def norm(term: str) -> str:
    return re.sub(r"\s+", " ", term.strip().lower())


def build_variation_index(old_glossary: list[dict]) -> dict[str, list[str]]:
    index: dict[str, list[str]] = {}
    for item in old_glossary:
        variations = item.get("variations")
        if not variations:
            continue
        key = norm(item["term"])
        index[key] = variations
        alias = TERM_ALIASES.get(key)
        if alias:
            index[norm(alias)] = variations
    return index


def sync_glossary(src_glossary: list[dict], old_glossary: list[dict]) -> list[dict]:
    var_index = build_variation_index(old_glossary)
    out: list[dict] = []
    for item in src_glossary:
        term = item["term"]
        entry: dict = {"term": term, "definition": item["definition"]}
        variations = var_index.get(norm(term))
        if variations:
            entry["variations"] = variations
        out.append(entry)
    return out


def fix_related_terms(questions: list[dict], glossary_terms: set[str]) -> tuple[list[dict], int]:
    fixed = 0
    updated: list[dict] = []
    for q in questions:
        terms = q.get("relatedTerms") or []
        seen: set[str] = set()
        new_terms: list[str] = []
        for raw in terms:
            key = norm(raw)
            replacement = RELATED_FIXES.get(key, raw)
            if replacement is None:
                fixed += 1
                continue
            if norm(replacement) != key:
                fixed += 1
            rkey = norm(replacement)
            if rkey not in glossary_terms or rkey in seen:
                if rkey not in glossary_terms:
                    raise SystemExit(f"Q{q['id']}: relatedTerm {replacement!r} not in glossary")
                continue
            seen.add(rkey)
            new_terms.append(replacement)
        updated.append({**q, "relatedTerms": new_terms})
    return updated, fixed


def main() -> None:
    src = json.loads(SOURCE.read_text(encoding="utf-8"))
    old_gloss = json.loads(GLOSS_OUT.read_text(encoding="utf-8"))
    questions = json.loads(QUESTIONS_OUT.read_text(encoding="utf-8"))

    shutil.copy2(GLOSS_OUT, GLOSS_BACKUP)

    glossary = sync_glossary(src["glossary"], old_gloss)
    glossary_terms = {norm(x["term"]) for x in glossary}

    questions, rt_fixed = fix_related_terms(questions, glossary_terms)

    GLOSS_OUT.write_text(
        json.dumps(glossary, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    QUESTIONS_OUT.write_text(
        json.dumps(questions, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    with_var = sum(1 for x in glossary if x.get("variations"))
    print(f"Glossary: {len(glossary)} terms ({with_var} with variations) -> {GLOSS_OUT}")
    print(f"RelatedTerms fixes: {rt_fixed}")


if __name__ == "__main__":
    main()
