# -*- coding: utf-8 -*-
"""Crop pedigree diagrams from «Ped_zadachi (1).pdf» for ped/ther bio tasks."""
from __future__ import annotations

from pathlib import Path

import fitz

ROOT = Path(__file__).resolve().parent.parent
PDF_PATH = Path(r"c:\Users\Admin\Downloads\Ped_zadachi (1).pdf")
OUT_DIR = ROOT / "public" / "images" / "bio" / "tasks-ped"
MATRIX = fitz.Matrix(2.5, 2.5)

# page index (0-based) -> (task_id, clip rect in PDF points)
CLIPS: dict[int, list[tuple[int, fitz.Rect]]] = {
    9: [  # page 10 — задача 83 (родословная сверху)
        (83, fitz.Rect(70, 55, 530, 200)),
    ],
    11: [  # page 12 — 98, 102, 103
        (98, fitz.Rect(83.3, 194.16, 242.45, 237.25)),
        (102, fitz.Rect(84.8, 446.41, 244.2, 525.51)),
        (103, fitz.Rect(83.3, 594.5, 251.59, 637.15)),
    ],
    12: [  # page 13 — 107, 108, 109
        (107, fitz.Rect(83.3, 123.2, 234.14, 211.4)),
        (108, fitz.Rect(83.3, 239.29, 266.2, 331.44)),
        (109, fitz.Rect(83.3, 400.44, 271.0, 493.59)),
    ],
}


def main() -> None:
    if not PDF_PATH.is_file():
        raise SystemExit(f"PDF not found: {PDF_PATH}")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(str(PDF_PATH))
    for page_idx, items in CLIPS.items():
        page = doc[page_idx]
        for task_id, rect in items:
            pix = page.get_pixmap(matrix=MATRIX, clip=rect, alpha=False)
            out = OUT_DIR / f"task-{task_id}.png"
            pix.save(str(out))
            print(f"task {task_id}: {out.relative_to(ROOT)} ({pix.width}x{pix.height})")
    doc.close()


if __name__ == "__main__":
    main()
