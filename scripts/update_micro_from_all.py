# -*- coding: utf-8 -*-
"""Update micro_questions.json from microbiology_ALL.json (qa_pairs by id)."""
from __future__ import annotations

import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = Path(r"c:\Users\Admin\Downloads\microbiology_ALL.json")
OUT = ROOT / "src" / "data" / "micro_questions.json"
BACKUP = ROOT / "scripts" / "_micro_pre_update.json"


def main() -> None:
    src = json.loads(SOURCE.read_text(encoding="utf-8"))
    by_id = {q["id"]: q for q in src["qa_pairs"]}
    old = json.loads(OUT.read_text(encoding="utf-8"))

    shutil.copy2(OUT, BACKUP)

    updated: list[dict] = []
    for item in old:
        qid = item["id"]
        if qid not in by_id:
            raise SystemExit(f"Missing id {qid} in source")
        src_q = by_id[qid]
        updated.append(
            {
                "id": qid,
                "question": src_q["question"],
                "answer": src_q["answer"],
                "image": src_q.get("image"),
                "audio": src_q.get("audio"),
                "relatedTerms": item.get("relatedTerms", []),
            }
        )

    if len(updated) != len(by_id):
        raise SystemExit(f"Count mismatch: {len(updated)} vs {len(by_id)}")

    OUT.write_text(
        json.dumps(updated, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Updated {len(updated)} questions -> {OUT}")


if __name__ == "__main__":
    main()
