# -*- coding: utf-8 -*-
"""Build bio_questions_stomatology.json and bio_questions_pediatrics.json."""
from __future__ import annotations

import json
import re
import shutil
from difflib import SequenceMatcher
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STOM_SRC = ROOT / "src" / "data" / "bio_questions.json"
STOM_OUT = ROOT / "src" / "data" / "bio_questions_stomatology.json"
PED_OUT = ROOT / "src" / "data" / "bio_questions_pediatrics.json"
PED_LIST = ROOT / "scripts" / "_ped_questions.json"
MATCH_THRESHOLD = 0.72
FALLBACK_THRESHOLD = 0.45


def normalize(text: str) -> str:
    text = text.replace("**", "")
    text = text.lower()
    text = re.sub(r"[^\w\s]+", " ", text, flags=re.UNICODE)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def similarity(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, a, b).ratio()


def format_question(text: str) -> str:
    t = text.strip()
    if not t.startswith("**"):
        t = f"**{t}**"
    return t


def best_stom_match(ped_text: str, stom_items: list[dict]) -> tuple[dict | None, float]:
    pn = normalize(ped_text)
    best_item = None
    best_ratio = 0.0
    for item in stom_items:
        r = similarity(pn, normalize(item["question"]))
        if r > best_ratio:
            best_ratio = r
            best_item = item
    return best_item, best_ratio


def merge_answers(items: list[dict]) -> str:
  parts = []
  seen = set()
  for it in items:
    ans = (it.get("answer") or "").strip()
    if not ans or ans in seen:
      continue
    seen.add(ans)
    parts.append(ans)
  return "\n\n---\n\n".join(parts)


def main() -> None:
    stom_items = json.loads(STOM_SRC.read_text(encoding="utf-8"))
    ped_items = json.loads(PED_LIST.read_text(encoding="utf-8"))

    # Stomatology: full bank
    stom_out = []
    for item in stom_items:
        copy = dict(item)
        copy["faculty"] = ["stomatology"]
        stom_out.append(copy)
    STOM_OUT.write_text(json.dumps(stom_out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    # Pediatrics: 55 questions from official list
    stom_by_id = {int(x["id"]): x for x in stom_items}
    ped_out = []
    stats = {"full_match": 0, "fallback": 0, "merged": 0, "stub": 0}

    for ped in ped_items:
        num = int(ped["num"])
        ped_text = ped["text"]
        best, ratio = best_stom_match(ped_text, stom_items)

        source_ids: list[int] = []
        answer = ""
        if best and ratio >= MATCH_THRESHOLD:
            answer = best["answer"]
            source_ids = [int(best["id"])]
            stats["full_match"] += 1
        elif num == 1:
            # Cell theory + pro/eukaryotic — merge stom 3 + 4
            extras = [stom_by_id.get(3), stom_by_id.get(4)]
            extras = [x for x in extras if x]
            answer = merge_answers(extras) if extras else ""
            source_ids = [int(x["id"]) for x in extras]
            stats["merged"] += 1
        elif best and ratio >= FALLBACK_THRESHOLD:
            answer = best["answer"]
            source_ids = [int(best["id"])]
            stats["fallback"] += 1
        else:
            stats["stub"] += 1

        if not answer.strip():
            answer = (
                "_Ответ готовится. Пока ориентируйся на конспект кафедры биологии "
                "и учебник по теме вопроса._"
            )

        base = dict(best) if best else {}
        entry = {
            "id": num,
            "question": format_question(ped_text),
            "answer": answer,
            "topic": base.get("topic", "biology_ped"),
            "subtopic": base.get("subtopic") or f"Педиатрия · вопрос {num}",
            "difficulty": base.get("difficulty", "medium"),
            "game_modes": base.get("game_modes", ["flashcard", "quiz"]),
            "key_facts": base.get("key_facts", []),
            "repeat_interval": base.get("repeat_interval", 3),
            "exam_weight": base.get("exam_weight", 2),
            "faculty": ["pediatrics"],
            "subject": "biology",
            "visible": True,
            "premium": True,
            "source_stom_ids": source_ids,
            "match_ratio": round(ratio, 4) if best else 0,
        }
        ped_out.append(entry)

    PED_OUT.write_text(json.dumps(ped_out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    # Keep legacy file in sync with stomatology bank
    shutil.copy2(STOM_OUT, STOM_SRC)

    print(f"stomatology: {len(stom_out)} questions -> {STOM_OUT.name}")
    print(f"pediatrics: {len(ped_out)} questions -> {PED_OUT.name}")
    print("stats:", stats)


if __name__ == "__main__":
    main()
