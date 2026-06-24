# -*- coding: utf-8 -*-
"""Crop pedigree diagrams from KrasGMU bio tasks PDF into public/images/bio/tasks/."""
from __future__ import annotations

from pathlib import Path

import fitz

PDF_PATH = Path(r"c:\Users\Admin\Downloads\Задачи био .pdf")
OUT_DIR = Path(__file__).resolve().parent.parent / "public" / "images" / "bio" / "tasks"
MATRIX = fitz.Matrix(2.5, 2.5)

# page index (0-based) -> list of (task_id, clip rect in PDF points)
CLIPS: dict[int, list[tuple[int, fitz.Rect]]] = {
    6: [  # page 7
        (33, fitz.Rect(35, 175, 560, 318)),
        (34, fitz.Rect(35, 358, 560, 518)),
        (35, fitz.Rect(35, 558, 560, 698)),
        (36, fitz.Rect(35, 738, 560, 830)),
    ],
    7: [  # page 8
        (37, fitz.Rect(35, 78, 560, 248)),
        (38, fitz.Rect(35, 288, 560, 518)),
    ],
}


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(str(PDF_PATH))
    for page_idx, items in CLIPS.items():
        page = doc[page_idx]
        for task_id, rect in items:
            pix = page.get_pixmap(matrix=MATRIX, clip=rect, alpha=False)
            out = OUT_DIR / f"task-{task_id}.png"
            pix.save(str(out))
            print(f"task {task_id}: {out.name} ({pix.width}x{pix.height})")
    doc.close()


if __name__ == "__main__":
    main()
