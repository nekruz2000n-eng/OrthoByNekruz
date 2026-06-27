#!/usr/bin/env python3
"""Build micro_tickets.json and patch ortho ticketsData from 2026 student sources."""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src" / "data"
SCRIPTS = Path(__file__).resolve().parent


def load_json(name: str):
    return json.loads((DATA / name).read_text(encoding="utf-8"))


def save_json(name: str, data) -> None:
    (DATA / name).write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _load_mappings():
    path = SCRIPTS / "_micro_ortho_2026_mappings.py"
    spec = importlib.util.spec_from_file_location("micro_ortho_2026", path)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    return mod.MICRO_2026, mod.ORTHO_2026, mod.ORTHO_Q2_CUSTOM


MICRO_2026, ORTHO_2026, ORTHO_Q2_CUSTOM = _load_mappings()


def q_by_id(pool: list, qid: int) -> dict:
    for item in pool:
        if int(item["id"]) == int(qid):
            return item
    raise KeyError(f"question id {qid} not found")


def task_by_id(pool: list, tid: int) -> dict:
    for item in pool:
        if int(item["id"]) == int(tid):
            return item
    raise KeyError(f"task id {tid} not found")


def to_ortho_question(q: dict, slot_id: str) -> dict:
    return {
        "id": slot_id,
        "question": q["question"] if q["question"].startswith("**") else f"**{q['question']}**",
        "answer": q.get("answer", ""),
    }


def to_ortho_task(t: dict, slot_id: str) -> dict:
    return {
        "id": slot_id,
        "question": t["question"],
        "answer": t.get("answer", ""),
    }


def to_micro_question(q: dict) -> dict:
    return {
        "id": q["id"],
        "question": q["question"] if q["question"].startswith("**") else f"**{q['question']}**",
        "answer": q.get("answer", ""),
    }


def to_micro_task(t: dict) -> dict:
    return {
        "id": t["id"],
        "question": t["question"],
        "answer": t.get("answer", ""),
    }


def build_micro_tickets() -> list:
    micro_q = load_json("micro_questions.json")
    micro_t = load_json("micro_tasks.json")
    out: list = []

    for num in sorted(MICRO_2026):
        qids, tid, note = MICRO_2026[num]
        questions = [to_micro_question(q_by_id(micro_q, qid)) for qid in qids]
        task = to_micro_task(task_by_id(micro_t, tid)) if tid else None
        entry: dict = {
            "id": num,
            "ticketNumber": str(num),
            "note": note,
            "questions": questions,
        }
        if task:
            entry["task"] = task
        out.append(entry)

    return out


def patch_ortho_tickets() -> None:
    ortho_q = load_json("questions.json")
    ortho_t = load_json("tasks.json")
    tickets = load_json("ticketsData.json")
    by_num = {int(t["ticketNumber"]): t for t in tickets}

    for num, spec in ORTHO_2026.items():
        ticket = by_num[num]
        if spec.get("note"):
            ticket["note"] = spec["note"]
        if spec.get("q"):
            qids = spec["q"]
            ticket["questions"][0] = to_ortho_question(q_by_id(ortho_q, qids[0]), f"t{num}_q1")
            if len(qids) > 1:
                ticket["questions"][1] = to_ortho_question(q_by_id(ortho_q, qids[1]), f"t{num}_q2")
        if spec.get("q2_custom"):
            custom = ORTHO_Q2_CUSTOM[spec["q2_custom"]]
            ticket["questions"][1] = {
                "id": f"t{num}_q2",
                "question": custom["question"],
                "answer": custom["answer"],
            }
        if spec.get("q1_only"):
            ticket["questions"][0] = to_ortho_question(
                q_by_id(ortho_q, spec["q1_only"]), f"t{num}_q1"
            )
        if spec.get("q2_only"):
            ticket["questions"][1] = to_ortho_question(
                q_by_id(ortho_q, spec["q2_only"]), f"t{num}_q2"
            )
        if spec.get("t"):
            t = task_by_id(ortho_t, spec["t"])
            ticket["task"] = to_ortho_task(t, f"t{num}_task")

    save_json("ticketsData.json", tickets)


def main() -> None:
    micro = build_micro_tickets()
    save_json("micro_tickets.json", micro)
    patch_ortho_tickets()

    chem_path = SCRIPTS / "build_chem_tickets.py"
    spec = importlib.util.spec_from_file_location("build_chem_tickets", chem_path)
    chem_mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(chem_mod)
    chem = chem_mod.build_chem_tickets()
    save_json("chem_tickets.json", chem)

    micro_pdf = sum(1 for t in micro if "PDF:" in str(t.get("note", "")))
    chem_docx = sum(1 for t in chem if str(t.get("note", "")).startswith("Docx"))
    print(f"micro_tickets.json: {len(micro)} tickets ({micro_pdf} from PDF)")
    print(f"chem_tickets.json: {len(chem)} tickets ({chem_docx} docx + {len(chem) - chem_docx} filled)")
    print(f"ortho patched: {sorted(ORTHO_2026.keys())} (8, 17 unchanged — not in docx)")


if __name__ == "__main__":
    main()
