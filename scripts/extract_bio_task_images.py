# -*- coding: utf-8 -*-
"""Crop pedigree diagrams from KrasGMU stomatology bio tasks PDF."""
from __future__ import annotations

from pathlib import Path

import fitz

ROOT = Path(__file__).resolve().parent.parent
PDF_PATH = Path(r"c:\Users\Admin\Downloads\Задачи био  (2).pdf")
OUT_DIR = ROOT / "public" / "images" / "bio" / "tasks"
MATRIX = fitz.Matrix(2.5, 2.5)

# page number (1-based) -> list of (task_id, clip rect in PDF points)
# Question text is stored in bio_tasks.json; clips contain pedigree diagrams only.
CLIPS: dict[int, list[tuple[int, tuple[float, float, float, float]]]] = {
    7: [
        (33, (40, 175, 555, 242)),
        (34, (40, 320, 555, 405)),
        (35, (40, 490, 555, 575)),
        (36, (40, 655, 555, 755)),
    ],
    8: [
        (37, (40, 120, 555, 185)),
        (38, (40, 255, 555, 340)),
    ],
}


def main() -> None:
    if not PDF_PATH.is_file():
        raise SystemExit(f"PDF not found: {PDF_PATH}")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(str(PDF_PATH))
    for page_num, items in CLIPS.items():
        page = doc[page_num - 1]
        for task_id, coords in items:
            rect = fitz.Rect(*coords)
            pix = page.get_pixmap(matrix=MATRIX, clip=rect, alpha=False)
            out = OUT_DIR / f"task-{task_id}.png"
            pix.save(str(out))
            print(f"task {task_id}: {out.relative_to(ROOT)} ({pix.width}x{pix.height})")
    doc.close()


if __name__ == "__main__":
    main()
