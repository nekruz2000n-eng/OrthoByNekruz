# -*- coding: utf-8 -*-
"""Build src/data/bio_tasks.json — финальный банк задач стоматологов (66 из PDF)."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
QUESTIONS_PATH = Path(__file__).resolve().parent / "_bio_tasks_questions.json"
ANSWERS_PATH = Path(__file__).resolve().parent / "_bio_tasks_new_answers.json"
OUT_PATH = ROOT / "src" / "data" / "bio_tasks.json"

IMAGE_TASKS = {33, 34, 35, 36, 37, 38}
EXPECTED_COUNT = 66


def main() -> None:
    questions = json.loads(QUESTIONS_PATH.read_text(encoding="utf-8"))
    answers: dict[str, str] = json.loads(ANSWERS_PATH.read_text(encoding="utf-8"))

    if len(questions) != EXPECTED_COUNT:
        raise SystemExit(f"expected {EXPECTED_COUNT} questions, got {len(questions)}")

    missing = [int(q["num"]) for q in questions if str(q["num"]) not in answers]
    if missing:
        raise SystemExit(f"missing answers for tasks: {missing[:10]}{'...' if len(missing) > 10 else ''}")

    out: list[dict] = []
    for row in questions:
        num = int(row["num"])
        text = row["text"].strip()
        answer = answers[str(num)].strip()
        if not answer or answer == "_Ответ готовится._":
            raise SystemExit(f"empty answer for task {num}")

        entry: dict = {"id": num, "question": text, "answer": answer}
        if num in IMAGE_TASKS:
            entry["image"] = f"/images/bio/tasks/task-{num}.png"
        out.append(entry)

    OUT_PATH.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    with_img = sum(1 for x in out if x.get("image"))
    print(f"bio_tasks: {len(out)} tasks ({with_img} with images) -> {OUT_PATH.name}")


if __name__ == "__main__":
    main()
