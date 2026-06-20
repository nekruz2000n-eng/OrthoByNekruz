# -*- coding: utf-8 -*-
"""Build pharmacology subject data from pharma_q_*.json source files."""
from __future__ import annotations

import json
import re
from pathlib import Path

MARKER = "## По методичке кафедры (КрасГМУ)"
ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "src" / "data"
SOURCES = [
    Path(r"c:\Users\Admin\Downloads\pharma_q_1_25.json"),
    Path(r"c:\Users\Admin\Downloads\pharma_q_26_50.json"),
    Path(r"c:\Users\Admin\Downloads\pharma_q_51_82.json"),
    Path(r"c:\Users\Admin\Downloads\pharma_q_83_116.json"),
]
TASKS_SOURCE = Path(r"c:\Users\Admin\Downloads\pharma_tasks.json")

SKIP_TERMS = {
    "преимущества", "недостатки", "примеры", "характеристика", "достоинства",
    "механизм", "виды", "этапы", "реакции", "уровни", "условия", "результат",
    "клиническое значение", "клинически", "общие достоинства", "общие недостатки",
    "основные разделы", "основные методы", "основной орган", "основная цель",
    "важно", "примечание", "итог", "вывод",
}

RU_ENDINGS = [
    "ами", "ях", "ах", "ов", "ев", "ём", "ом", "ем", "ей", "ию", "ью",
    "ия", "ие", "ые", "их", "ых", "ам", "ям", "ую", "ой", "ый", "ий",
    "ая", "яя", "ое", "ее", "а", "я", "ы", "и", "у", "ю", "е", "о", "й", "ь",
]


def norm_key(term: str) -> str:
    return re.sub(r"\s+", " ", term.strip().lower().replace("ё", "е"))


def clean_term(raw: str) -> str:
    t = re.sub(r"\s+", " ", raw.strip())
    t = re.sub(r"^\d+[\.\)]\s*", "", t)
    return t.strip(" .:—-")


def is_noise(term: str) -> bool:
    if not term or len(term) < 3:
        return True
    if len(term) > 56:
        return True
    if re.fullmatch(r"[\d\s\W]+", term):
        return True
    if re.search(r"^\d", term):
        return True
    if term.count("(") >= 2 or term.startswith("("):
        return True
    low = norm_key(term)
    if low in SKIP_TERMS:
        return True
    if re.search(r"\bмг\b|×\s*\d|мл\b", term, re.I):
        return True
    if re.match(r"^[IVX]+\.?\s", term):
        return True
    if re.match(r"^[IVX]+\s+поколение", term, re.I):
        return True
    if term.isupper() and len(term) > 12:
        return True
    cyr = len(re.findall(r"[а-яё]", term, re.I))
    if cyr < 3 and not re.search(r"[A-Za-z]{4,}", term):
        return True
    return False


def is_good_definition(term: str, definition: str) -> bool:
    if len(definition) < 20:
        return False
    if len(definition) >= 25:
        return True
    if definition.lower().startswith(term.lower()[: min(8, len(term))]):
        return True
    return False


def ru_stem(word: str) -> str:
    w = word.lower().replace("ё", "е")
    if len(w) <= 3:
        return w
    for end in RU_ENDINGS:
        if len(w) - len(end) >= 3 and w.endswith(end):
            return w[: -len(end)]
    return w


def generate_variations(term: str) -> list[str]:
    if re.search(r"[\d()/«»]", term):
        return []
    if "—" in term or " - " in term:
        return []
    parts = re.split(r"([\s\-/]+)", term)
    words = [p for p in parts if p and not re.fullmatch(r"[\s\-/]+", p)]
    if not words or len(words) > 4:
        return []
    last = words[-1]
    if not re.search(r"[а-я]", last, re.I):
        return [term.lower()] if term.lower() != term else []

    stem = ru_stem(last)
    suffixes = [
        "а", "у", "ом", "е", "ы", "ов", "ам", "ами", "ах",
        "и", "ей", "ям", "ями", "ях", "ю", "ью", "ия", "ии", "ию", "ией",
        "ость", "ости", "остью", "остей", "остям", "остями", "остях",
    ]
    out: list[str] = []
    seen: set[str] = {norm_key(term)}
    prefix = (" ".join(words[:-1]) + " ") if len(words) > 1 else ""
    for suf in suffixes:
        if len(stem) < 2:
            break
        variant = (prefix + stem + suf).strip()
        key = norm_key(variant)
        if key in seen or len(variant) < 3:
            continue
        seen.add(key)
        out.append(variant.lower())
        if len(out) >= 12:
            break
    return out


def extract_definitions(text: str) -> list[tuple[str, str]]:
    out: list[tuple[str, str]] = []
    patterns = [
        r"\*\*([^*]+)\*\*\s*[—\-–:]\s*([^\n]+)",
        r"-\s*\*\*([^*]+)\*\*\s*[—\-–:]\s*([^\n]+)",
    ]
    best: dict[str, str] = {}
    display: dict[str, str] = {}
    for pat in patterns:
        for m in re.finditer(pat, text):
            term = clean_term(m.group(1))
            definition = m.group(2).strip()
            if is_noise(term) or len(definition) < 12:
                continue
            if not is_good_definition(term, definition):
                continue
            definition = re.sub(r"\*\*([^*]+)\*\*", r"\1", definition).rstrip(".")
            key = norm_key(term)
            display[key] = term
            if key not in best or len(definition) > len(best[key]):
                best[key] = definition
    return [(display[k], best[k]) for k in best]


def sentence_definition(term: str, text: str) -> str | None:
    low = term.lower()
    for line in text.splitlines():
        if low not in line.lower():
            continue
        plain = re.sub(r"\*\*([^*]+)\*\*", r"\1", line).strip()
        plain = re.sub(r"^[-•\d\.\)\s]+", "", plain)
        if len(plain) >= 20:
            return plain[:280]
    return None


def load_questions() -> list[dict]:
    items: list[dict] = []
    for path in SOURCES:
        chunk = json.loads(path.read_text(encoding="utf-8"))
        items.extend(chunk)
    items.sort(key=lambda x: x["id"])
    ids = [q["id"] for q in items]
    if ids != list(range(1, len(items) + 1)):
        raise SystemExit(f"Bad id sequence: {ids[:5]}...{ids[-5:]} total={len(ids)}")
    return items


def question_title_term(question: str) -> str | None:
    m = re.match(r"\*\*([^*]+)\*\*", question.strip())
    if not m:
        return None
    term = clean_term(m.group(1).split(".")[0].split(":")[0])
    return None if is_noise(term) else term


def answer_core(answer: str) -> str:
    if MARKER in answer:
        return answer.split(MARKER)[0]
    return answer


def lead_definition(answer: str) -> str | None:
    for line in answer_core(answer).splitlines():
        plain = line.strip()
        if not plain or plain.startswith("#"):
            continue
        plain = re.sub(r"\*\*([^*]+)\*\*", r"\1", plain)
        if len(plain) >= 30:
            return plain[:300]
    return None


def build_glossary(questions: list[dict]) -> list[dict]:
    definitions: dict[str, str] = {}
    display: dict[str, str] = {}

    for q in questions:
        blob = q["question"] + "\n" + answer_core(q["answer"])
        for term, definition in extract_definitions(blob):
            key = norm_key(term)
            definitions[key] = definition
            display[key] = term

        title = question_title_term(q["question"])
        if title:
            key = norm_key(title)
            display.setdefault(key, title)
            if key not in definitions:
                lead = lead_definition(q["answer"])
                if lead:
                    definitions[key] = lead

    glossary: list[dict] = []
    for key in sorted(display, key=lambda k: display[k].lower()):
        term = display[key]
        definition = definitions.get(key)
        if not definition:
            continue
        entry: dict = {"term": term, "definition": definition}
        if re.search(r"[а-я]", term, re.I) and not re.search(r"^\d", term):
            variations = generate_variations(term)
            if variations:
                entry["variations"] = variations
        glossary.append(entry)
    return glossary


def link_related_terms(questions: list[dict], glossary: list[dict]) -> list[dict]:
    term_keys = [(g["term"], norm_key(g["term"])) for g in glossary]
    out: list[dict] = []
    for q in questions:
        blob = (q["question"] + "\n" + q["answer"]).lower().replace("ё", "е")
        related: list[str] = []
        seen: set[str] = set()
        for term, key in term_keys:
            if key in seen:
                continue
            if key in blob or term.lower().replace("ё", "е") in blob:
                seen.add(key)
                related.append(term)
            if len(related) >= 8:
                break
        out.append(
            {
                "id": q["id"],
                "question": q["question"],
                "answer": q["answer"],
                "image": [""],
                "audio": "",
                "relatedTerms": related,
            }
        )
    return out


def main() -> None:
    raw = load_questions()
    glossary = build_glossary(raw)
    questions = link_related_terms(raw, glossary)

    (DATA / "pharma_questions.json").write_text(
        json.dumps(questions, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    (DATA / "pharma_glossary.json").write_text(
        json.dumps(glossary, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    for name in ("pharma_tests.json", "pharma_tasks.json"):
        path = DATA / name
        if not path.exists():
            path.write_text("[]\n", encoding="utf-8")

    print(f"questions: {len(questions)}")
    print(f"glossary:  {len(glossary)} ({sum(1 for g in glossary if g.get('variations'))} with variations)")


def import_tasks(source: Path = TASKS_SOURCE) -> None:
    raw = json.loads(source.read_text(encoding="utf-8"))
    glossary = json.loads((DATA / "pharma_glossary.json").read_text(encoding="utf-8"))
    tasks = link_related_terms(raw, glossary)
    (DATA / "pharma_tasks.json").write_text(
        json.dumps(tasks, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"tasks: {len(tasks)}")


def glossary_only() -> None:
    questions = json.loads((DATA / "pharma_questions.json").read_text(encoding="utf-8"))
    glossary = build_glossary(questions)
    questions = link_related_terms(questions, glossary)
    (DATA / "pharma_glossary.json").write_text(
        json.dumps(glossary, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    (DATA / "pharma_questions.json").write_text(
        json.dumps(questions, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"glossary: {len(glossary)} ({sum(1 for g in glossary if g.get('variations'))} with variations)")


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "--glossary-only":
        glossary_only()
    elif len(sys.argv) > 1 and sys.argv[1] == "--tasks":
        import_tasks()
    else:
        main()
