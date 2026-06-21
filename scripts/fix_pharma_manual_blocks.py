# -*- coding: utf-8 -*-
"""Remove wrongly attached generic pharmacokinetics manual blocks from pharma questions."""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

from enrich_pharma_from_manual import MARKER, is_generic_manual_block, strip_generic_manual

ROOT = Path(__file__).resolve().parent.parent
QUESTIONS = ROOT / "src" / "data" / "pharma_questions.json"


def main() -> None:
    questions = json.loads(QUESTIONS.read_text(encoding="utf-8"))
    fixed = 0
    for q in questions:
        if MARKER not in q.get("answer", ""):
            continue
        block = q["answer"].split(MARKER, 1)[1]
        if not is_generic_manual_block(block):
            continue
        q["answer"] = strip_generic_manual(q["answer"])
        fixed += 1

    QUESTIONS.write_text(
        json.dumps(questions, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"removed generic manual block from {fixed} questions")

    subprocess.run(
        ["python", str(ROOT / "scripts" / "build_pharma_subject.py"), "--glossary-only"],
        check=True,
    )


if __name__ == "__main__":
    main()
