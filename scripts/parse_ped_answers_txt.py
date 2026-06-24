# -*- coding: utf-8 -*-
"""Parse «задачи и ответы педиатрии .txt» → scripts/_bio_tasks_ped_source.json"""
from __future__ import annotations

import ast
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC_TXT = Path(r"c:\Users\Admin\Downloads\задачи и ответы педиатрии .txt")
OUT = Path(__file__).resolve().parent / "_bio_tasks_ped_source.json"

# Родословные, которые реально есть в Ped_zadachi (1).pdf
PDF_IMAGE_TASKS = {83, 98, 102, 103, 107, 108, 109}


def parse_tasks_from_txt(text: str) -> list[dict]:
    start = text.index("tasks = [")
    end = text.rindex("]") + 1
    return ast.literal_eval(text[start + 8 : end])


def italics_to_markdown(s: str) -> str:
    return re.sub(r"\*([^*\n]+)\*", r"_\1_", s)


def clean_text(s: str) -> str:
    s = (s or "").strip()
    s = re.sub(
        r"^\[Требуется изображение[^\]]*\]\s*\n*",
        "",
        s,
        flags=re.IGNORECASE,
    )
    s = re.sub(
        r"^⚠\s*Требуется изображение[^\n]*\n*",
        "",
        s,
        flags=re.IGNORECASE,
    )
    return italics_to_markdown(s.strip())


def main() -> None:
    text = SRC_TXT.read_text(encoding="utf-8")
    raw = parse_tasks_from_txt(text)
    out: list[dict] = []
    for item in raw:
        tid = int(item["id"])
        has_pdf_image = tid in PDF_IMAGE_TASKS
        out.append({
            "id": tid,
            "block": item.get("block") or "",
            "condition": clean_text(item.get("condition") or ""),
            "answer": clean_text(item.get("answer") or ""),
            "requires_image": has_pdf_image,
            "image_note": item.get("image_note") if has_pdf_image else None,
        })
    OUT.write_text(
        json.dumps(out, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"parsed {len(out)} tasks, pdf images {sum(1 for x in out if x['requires_image'])} -> {OUT.name}")


if __name__ == "__main__":
    main()
