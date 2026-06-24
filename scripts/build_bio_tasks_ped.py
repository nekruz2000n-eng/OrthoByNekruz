# -*- coding: utf-8 -*-
"""Build src/data/bio_tasks_pediatrics.json — задачи bio для педиатрии и лечебного дела."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = Path(__file__).resolve().parent / "_bio_tasks_ped_source.json"
OUT = ROOT / "src" / "data" / "bio_tasks_pediatrics.json"

FACULTIES = ("pediatrics", "therapeutic")
# Родословные из Ped_zadachi (1).pdf
IMAGE_TASKS = {83, 98, 102, 103, 107, 108, 109}
IMAGE_PREFIX = "/images/bio/tasks-ped"

WARN_RE = re.compile(
    r"^⚠\s*Требуется изображение[^\n]*\n*",
    re.IGNORECASE,
)
BRACKET_WARN_RE = re.compile(
    r"\s*\[Требуется изображение[^\]]*\]\s*",
    re.IGNORECASE,
)
TRAIL_LEGEND_RE = re.compile(
    r"\n\n\[Родословная строится по легенде[^\]]*\]\s*$",
    re.IGNORECASE,
)


def clean_text(s: str) -> str:
    s = (s or "").strip()
    s = WARN_RE.sub("", s)
    s = BRACKET_WARN_RE.sub("", s)
    s = TRAIL_LEGEND_RE.sub("", s)
    return s.strip()


def build_question(block: str, condition: str, image_note: str | None, has_image: bool) -> str:
    block = (block or "").strip()
    condition = clean_text(condition)
    if not condition and has_image:
        condition = (image_note or "").strip() or "Решите по схеме родословной (см. рисунок)."
    if block and condition:
        return f"**{block}**\n\n{condition}"
    if block:
        return f"**{block}**"
    return condition


def main() -> None:
    if not SRC.is_file():
        raise SystemExit(f"source not found: {SRC}")

    raw = json.loads(SRC.read_text(encoding="utf-8"))
    out: list[dict] = []

    for item in raw:
        num = int(item["id"])
        answer = clean_text(item.get("answer") or "")
        if not answer:
            raise SystemExit(f"empty answer for task {num}")

        has_image = num in IMAGE_TASKS or bool(item.get("requires_image"))
        entry: dict = {
            "id": num,
            "question": build_question(
                item.get("block") or "",
                item.get("condition") or "",
                item.get("image_note"),
                has_image,
            ),
            "answer": answer,
            "faculties": list(FACULTIES),
        }
        block = (item.get("block") or "").strip()
        if block:
            entry["topic"] = block
        if has_image:
            entry["image"] = f"{IMAGE_PREFIX}/task-{num}.png"
        out.append(entry)

    out.sort(key=lambda x: x["id"])
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    with_img = sum(1 for x in out if x.get("image"))
    print(f"bio_tasks_pediatrics: {len(out)} tasks ({with_img} with images) -> {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
