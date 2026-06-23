# -*- coding: utf-8 -*-
"""Sync stomatology biology questions with KrasGMU official list (2026 PDF)."""
from __future__ import annotations

import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OFFICIAL_PATH = Path(__file__).resolve().parent / "_stom_questions.json"
OUT_PATH = ROOT / "src" / "data" / "bio_questions_stomatology.json"
LEGACY_PATH = ROOT / "src" / "data" / "bio_questions.json"

ANSWER_REPLACEMENTS: dict[int, list[tuple[str, str]]] = {
    52: [
        ("Биологический прогресс и регресс", "Биологический прогресс и биологический регресс"),
        ("Правила эволюции групп", "Правила эволюции"),
    ],
    74: [
        ("**Специфичность паразитов:**", "**Специфичность в отношениях между паразитом и хозяином:**"),
    ],
}


def fmt_q(text: str) -> str:
    t = text.strip()
    return t if t.startswith("**") else f"**{t}**"


def main() -> None:
    official = {int(row["num"]): row["text"] for row in json.loads(OFFICIAL_PATH.read_text(encoding="utf-8"))}
    items = json.loads(OUT_PATH.read_text(encoding="utf-8"))
    by_id = {int(x["id"]): x for x in items}

    updated_q = 0
    updated_a = 0
    for num, text in sorted(official.items()):
        item = by_id.get(num)
        if not item:
            raise SystemExit(f"missing question id {num} in {OUT_PATH.name}")

        new_q = fmt_q(text)
        if item.get("question") != new_q:
            item["question"] = new_q
            item["subtopic"] = f"Стоматология · вопрос {num}"
            updated_q += 1

        for old, new in ANSWER_REPLACEMENTS.get(num, []):
            ans = item.get("answer") or ""
            if old in ans and new not in ans:
                item["answer"] = ans.replace(old, new)
                updated_a += 1

    out = [by_id[i] for i in sorted(by_id)]
    OUT_PATH.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    shutil.copy2(OUT_PATH, LEGACY_PATH)
    print(f"official: {len(official)} questions")
    print(f"updated questions: {updated_q}, answers: {updated_a}")
    print(f"-> {OUT_PATH.name}")


if __name__ == "__main__":
    main()
