# -*- coding: utf-8 -*-
"""Import pharma tests from external JSON into src/data/pharma_tests.json."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "src" / "data"
DEFAULT_SOURCE = Path(r"c:\Users\Admin\Downloads\pharma_tests_final.json")


def import_tests(source: Path = DEFAULT_SOURCE) -> None:
    raw = json.loads(source.read_text(encoding="utf-8"))
    if not isinstance(raw, list):
        raise SystemExit("Expected a JSON array of tests")

    out = []
    errors: list[str] = []

    for item in raw:
        tid = item.get("id")
        theme = str(item.get("theme") or item.get("topic") or "Общий раздел").strip()
        question = str(item.get("question") or "").strip()
        options = [str(o).strip() for o in (item.get("options") or []) if str(o).strip()]
        correct = str(item.get("correct") or "").strip()

        if not question or len(options) < 2 or not correct:
            errors.append(f"id {tid}: missing question/options/correct")
            continue

        if correct not in options:
            # case-insensitive fallback
            low = correct.lower()
            if not any(o.lower() == low for o in options):
                errors.append(f"id {tid}: correct not in options ({correct!r})")
                continue

        out.append({
            "id": tid,
            "theme": theme,
            "question": question,
            "options": options,
            "correct": correct,
        })

    if errors:
        print(f"WARN: {len(errors)} issues (first 5):")
        for line in errors[:5]:
            print(" ", line)
        if len(errors) > 5:
            print(f"  ... and {len(errors) - 5} more")

    dest = DATA / "pharma_tests.json"
    dest.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    themes = sorted({t["theme"] for t in out})
    print(f"tests: {len(out)}")
    print(f"themes: {len(themes)}")
    for t in themes:
        n = sum(1 for x in out if x["theme"] == t)
        print(f"  - {t}: {n}")


if __name__ == "__main__":
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SOURCE
    import_tests(src)
