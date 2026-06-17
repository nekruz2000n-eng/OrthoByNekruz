# -*- coding: utf-8 -*-
"""Compare pediatrics biology exam questions (PDF text) vs stomatology bio_questions.json."""
from __future__ import annotations

import json
import re
import sys
from difflib import SequenceMatcher
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PED_TEXT_PATH = ROOT / "scripts" / "_ped_pdf_text.txt"
PED_JSON_PATH = ROOT / "scripts" / "_ped_questions.json"
STOM_JSON_PATH = ROOT / "src" / "data" / "bio_questions.json"
MATCH_THRESHOLD = 0.72


def normalize(text: str) -> str:
    text = text.replace("**", "")
    text = text.lower()
    text = re.sub(r"[^\w\s]+", " ", text, flags=re.UNICODE)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def parse_ped_questions(text: str) -> list[dict]:
    start = re.search(r"^1\.\s", text, re.MULTILINE)
    if not start:
        raise ValueError("Could not find question 1 in ped PDF text")
    body = text[start.start() :]
    markers = list(re.finditer(r"^(\d{1,2})\.\s*", body, re.MULTILINE))
    questions: list[dict] = []
    for i, m in enumerate(markers):
        num = int(m.group(1))
        chunk_end = markers[i + 1].start() if i + 1 < len(markers) else len(body)
        chunk = body[m.end() : chunk_end]
        qtext = re.sub(r"\s+", " ", chunk).strip()
        questions.append({"num": num, "text": qtext})
    return questions


def load_stom_questions() -> list[dict]:
    data = json.loads(STOM_JSON_PATH.read_text(encoding="utf-8"))
    out = []
    for item in data:
        q = item.get("question") or item.get("text") or ""
        out.append(
            {
                "id": item.get("id"),
                "text": q,
                "norm": normalize(q),
            }
        )
    return out


def similarity(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, a, b).ratio()


def topic_hint(text: str, max_words: int = 12) -> str:
    t = normalize(text)
    words = t.split()
    return " ".join(words[:max_words])


def main() -> int:
    ped_raw = PED_TEXT_PATH.read_text(encoding="utf-8")
    ped_questions = parse_ped_questions(ped_raw)
    PED_JSON_PATH.write_text(
        json.dumps(ped_questions, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    stom = load_stom_questions()
    ped_norm = [(q, normalize(q["text"])) for q in ped_questions]

    matches: list[dict] = []
    stom_best_for: dict[int, tuple[float, int]] = {}

    for pq, pn in ped_norm:
        best_ratio = 0.0
        best_stom = None
        for sq in stom:
            r = similarity(pn, sq["norm"])
            if r > best_ratio:
                best_ratio = r
                best_stom = sq
        assert best_stom is not None
        sid = best_stom["id"]
        prev = stom_best_for.get(sid)
        if prev is None or best_ratio > prev[0]:
            stom_best_for[sid] = (best_ratio, pq["num"])
        matches.append(
            {
                "ped_num": pq["num"],
                "ped_text": pq["text"],
                "stom_id": best_stom["id"],
                "stom_text": best_stom["text"],
                "ratio": round(best_ratio, 4),
                "matched": best_ratio >= MATCH_THRESHOLD,
            }
        )

    matched = [m for m in matches if m["matched"]]
    missing_in_stom = [m for m in matches if not m["matched"]]
    stom_matched_ids = {m["stom_id"] for m in matched}
    stom_unmatched = [s for s in stom if s["id"] not in stom_matched_ids]

    ped_only_topics = [topic_hint(m["ped_text"]) for m in missing_in_stom]

    print("=== Pediatrics biology vs Stomatology bio_questions ===")
    print(f"Ped questions parsed: {len(ped_questions)} (nums {ped_questions[0]['num']}-{ped_questions[-1]['num']})")
    print(f"Stom questions: {len(stom)}")
    print(f"Match threshold (SequenceMatcher): {MATCH_THRESHOLD}")
    print(f"Matched: {len(matched)} / {len(ped_questions)}")
    print(f"Missing in stom (ped with no match above threshold): {len(missing_in_stom)}")
    print(f"Stom questions not best-match for any matched ped: {len(stom_unmatched)}")
    print(f"Saved ped list: {PED_JSON_PATH}")
    print()

    print("--- Matched pairs ---")
    for m in matched:
        print(
            f"  ped#{m['ped_num']} <-> stom id={m['stom_id']} (r={m['ratio']:.3f})"
        )
        print(f"    ped:  {m['ped_text'][:120]}{'...' if len(m['ped_text']) > 120 else ''}")
        print(f"    stom: {m['stom_text'][:120].replace(chr(10), ' ')}{'...' if len(m['stom_text']) > 120 else ''}")
    print()

    print("--- Missing in stom (ped questions below threshold) ---")
    for m in missing_in_stom:
        print(f"  ped#{m['ped_num']} best stom id={m['stom_id']} r={m['ratio']:.3f}")
        print(f"    {m['ped_text']}")
    print()

    print("--- Ped-only topics (hints from unmatched ped) ---")
    for i, topic in enumerate(ped_only_topics, 1):
        print(f"  {i}. {topic}")
    print()

    print("--- Stom not linked to any matched ped ---")
    for s in stom_unmatched:
        print(f"  id={s['id']}: {s['text'][:100].replace(chr(10), ' ')}...")

    report_path = ROOT / "scripts" / "_ped_stom_compare_report.json"
    report_path.write_text(
        json.dumps(
            {
                "ped_count": len(ped_questions),
                "stom_count": len(stom),
                "threshold": MATCH_THRESHOLD,
                "matched_count": len(matched),
                "missing_in_stom_count": len(missing_in_stom),
                "ped_only_topics": ped_only_topics,
                "matches": matches,
                "stom_unmatched_ids": [s["id"] for s in stom_unmatched],
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"Full JSON report: {report_path}")
    return 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    raise SystemExit(main())
