#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Импорт задач по химии из chem_tasks.json (Downloads) в src/data/chem_tasks.json."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = Path(__file__).resolve().parent / "_chem_tasks_source.json"
OUT = ROOT / "src" / "data" / "chem_tasks.json"

# ped + лечебное дело (один банк задач)
FACULTIES = ("pediatrics", "therapeutic")


def build_question(item: dict) -> str:
    title = (item.get("title") or "").strip()
    condition = (item.get("condition") or "").strip()
    if title and condition:
        return f"**{title}**\n\n{condition}"
    return title or condition


def main() -> None:
    if not SRC.is_file():
        raise SystemExit(f"source not found: {SRC}")

    raw = json.loads(SRC.read_text(encoding="utf-8"))
    out: list[dict] = []

    for item in raw:
        num = int(item["id"])
        entry: dict = {
            "id": num,
            "question": build_question(item),
            "answer": (item.get("answer") or "").strip(),
            "faculties": list(FACULTIES),
        }
        topic = (item.get("topic") or "").strip()
        if topic:
            entry["topic"] = topic
        out.append(entry)

    out.sort(key=lambda x: x["id"])
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"chem_tasks: {len(out)} tasks -> {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
