# -*- coding: utf-8 -*-
"""Crop pedigree diagrams from «Био_задачи_26» PDF for ped/ther bio tasks."""
from __future__ import annotations

from pathlib import Path

import fitz

ROOT = Path(__file__).resolve().parent.parent
PDF_PATH = Path(r"c:\Users\Admin\Downloads\Био_задачи_26 (1).pdf")
OUT_DIR = ROOT / "public" / "images" / "bio" / "tasks-ped"
MATRIX = fitz.Matrix(2.5, 2.5)

# page index (0-based) -> (task_id, clip rect in PDF points)
CLIPS: dict[int, list[tuple[int, fitz.Rect]]] = {
    8: [  # page 9 — tasks 59, 61
        (59, fitz.Rect(88.8, 196.2, 537.36, 384.6)),
        (61, fitz.Rect(88.8, 560.04, 537.36, 748.44)),
    ],
    9: [  # page 10 — tasks 63, 64
        (63, fitz.Rect(88.8, 213.48, 537.36, 401.88)),
        (64, fitz.Rect(88.8, 454.92, 537.36, 643.32)),
    ],
    10: [  # page 11 — tasks 66, 67
        (66, fitz.Rect(88.8, 125.64, 537.36, 314.04)),
        (67, fitz.Rect(88.8, 384.48, 537.36, 572.88)),
    ],
    11: [  # page 12 — tasks 72, 73
        (72, fitz.Rect(72.72, 364.56, 300.0, 510.12)),
        (73, fitz.Rect(72.72, 572.04, 417.72, 743.04)),
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
