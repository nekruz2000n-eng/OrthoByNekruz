#!/usr/bin/env python3
"""Build micro_tickets.json and patch ortho ticketsData from student Telegram mappings."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src" / "data"


def load_json(name: str):
    return json.loads((DATA / name).read_text(encoding="utf-8"))


def save_json(name: str, data) -> None:
    (DATA / name).write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


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


# Student Telegram → bank IDs (closest match)
MICRO_TICKETS = [
    (2, [11, 67], 2, "Telegram: дифтерия ротоглотки"),
    (4, [34, 52], 3, "Telegram: гонорея, аллергия I типа"),
    (10, [33, 66], 12, "Telegram: сифилис"),
    (12, [10, 79], 14, "Telegram: столбняк, спирохеты"),
    (14, [41, 71], 15, "Telegram: стафилококк, хирургическая стоматология"),
    (15, [25, 58], 33, "Telegram: гепатит наркоман, Мечников"),
    (16, [13, 19], 34, "Telegram: ВИЧ доноры, лекарственная устойчивость"),
    (20, [17, 42], 36, "Telegram: энцефалит, вирус-клетка"),
    (30, [8, 44], 40, "Telegram: полиомиелит, анаэробы"),
    (32, [15, 52], 29, "Telegram: гепатит у стоматолога, L-формы"),
    (36, [39, 74], 7, "Telegram: синегнойная палочка, вакцины"),
    (37, [18, 45], 8, "Telegram: микоплазмы, культивирование вирусов"),
    (40, [36, 46], 11, "Telegram: шигеллез, аллергия III типа"),
]

ORTHO_PATCHES = {
    6: {"q": [39, 13], "t": 6, "note": "Telegram: рабочее место + мостовидные (в базе — техник + этапы моста)"},
    7: {"q": None, "q2_only": 14, "note": "Telegram: проверка каркаса дугового протеза"},
    16: {"t": 14, "note": "Telegram: газовая пористость пластиночного протеза"},
    20: {"q": [47, 30], "note": "Telegram: аппараты литья + вкладки"},
    21: {"q1_only": 44, "note": "Telegram: физиологический прикус (ортогнатия)"},
    22: {"q": [7, 34], "t": 22, "note": "Telegram: первичный приём + восковый базис ВЧ"},
    29: {"q": [11, 15], "t": 29, "note": "Telegram: артикулятор + пластмассовый базис ЧСПП"},
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
    used_q_ids: set[int] = set()
    used_t_ids: set[int] = set()
    telegram_nums: set[int] = set()

    for num, qids, tid, note in MICRO_TICKETS:
        telegram_nums.add(num)
        used_q_ids.update(qids)
        used_t_ids.add(tid)
        questions = [to_micro_question(q_by_id(micro_q, qid)) for qid in qids]
        out.append(
            {
                "id": num,
                "ticketNumber": str(num),
                "note": note,
                "questions": questions,
                "task": to_micro_task(task_by_id(micro_t, tid)),
            }
        )

    all_q = [q for q in micro_q if q.get("visible", True) is not False]
    unused_q = sorted(
        (q for q in all_q if int(q["id"]) not in used_q_ids),
        key=lambda x: int(x["id"]),
    )
    unused_t = sorted(
        (t for t in micro_t if int(t["id"]) not in used_t_ids),
        key=lambda x: int(x["id"]),
    )
    missing = [n for n in range(1, 41) if n not in telegram_nums]

    if len(unused_q) < len(missing) * 2:
        raise RuntimeError(
            f"not enough unused questions: need {len(missing) * 2}, have {len(unused_q)}"
        )
    if len(unused_t) < len(missing):
        raise RuntimeError(f"not enough unused tasks: need {len(missing)}, have {len(unused_t)}")

    for i, num in enumerate(missing):
        q1, q2 = unused_q[i * 2], unused_q[i * 2 + 1]
        out.append(
            {
                "id": num,
                "ticketNumber": str(num),
                "note": "Собран из неиспользованных вопросов/задач",
                "questions": [to_micro_question(q1), to_micro_question(q2)],
                "task": to_micro_task(unused_t[i]),
            }
        )

    out.sort(key=lambda t: int(t["ticketNumber"]))
    return out


def patch_ortho_tickets() -> None:
    ortho_q = load_json("questions.json")
    ortho_t = load_json("tasks.json")
    tickets = load_json("ticketsData.json")
    by_num = {int(t["ticketNumber"]): t for t in tickets}

    for num, spec in ORTHO_PATCHES.items():
        ticket = by_num[num]
        if spec.get("note"):
            ticket["note"] = spec["note"]
        if spec.get("q"):
            q1, q2 = spec["q"]
            ticket["questions"][0] = to_ortho_question(q_by_id(ortho_q, q1), f"t{num}_q1")
            ticket["questions"][1] = to_ortho_question(q_by_id(ortho_q, q2), f"t{num}_q2")
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
    telegram = sum(1 for t in micro if str(t.get("note", "")).startswith("Telegram"))
    filled = len(micro) - telegram
    print(f"micro_tickets.json: {len(micro)} tickets ({telegram} Telegram + {filled} filled)")
    print(f"ortho patched: {sorted(ORTHO_PATCHES.keys())}")


if __name__ == "__main__":
    main()
