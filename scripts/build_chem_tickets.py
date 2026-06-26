#!/usr/bin/env python3
"""Build chem_tickets.json from docx-derived mappings + question bank."""
from __future__ import annotations

import json
import re
from difflib import SequenceMatcher
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src" / "data"

CHEM_TICKET_TOTAL = 35
CHEM_QUESTIONS_PER_TICKET = 2

# (ticket_number, [q_id, q_id], task_id, note)
# Сопоставлено с docx студентов и банком chem_questions / chem_tasks
CHEM_TICKETS = [
    (1, [3, 6], 3, "Docx: 1_bilet — ЭД + протолитическая теория"),
    (2, [1, 2], 19, "Docx: 2_bilet — типы связи + гибридизация"),
    (3, [8, 35], 17, "Docx: 3_bilet — термодинамика + алкины"),
    (4, [11, 16], 23, "Docx: 4_bilet — растворы + растворимость"),
    (6, [4, 5], 13, "Docx: 6_bilet — pH воды + кислотность желудка"),
    (7, [17, 34], 9, "Docx: 7_bilet — коллигативные свойства + диены"),
    (8, [24, 25], 5, "Docx: bilet.docx — номенклатура + σ/π-связи"),
    (9, [7, 40], 27, "Docx: bilet_9 — Льюис/ЖМКО + спирты"),
    (10, [9, 61], 1, "Docx: bilet_10 — кинетика + фосфолипиды + дибазол"),
    (11, [12, 11], 35, "Docx: bilet_11 — гидролиз солей + электролиты"),
    (13, [6, 55], 10, "Docx: bilet_13 — Брёнстед + олигосахариды + бромирование фенола"),
    (14, [5, 50], 8, "Docx: bilet_14 — кислотность желудка + аминокислоты + хлорбензол"),
    (15, [14, 31], 16, "Docx: bilet_15 — уравнение Нернста + циклоалканы"),
    (16, [18, 37], 3, "Docx: bilet_16 — изотонические растворы + SN у галогеналканов + pKa"),
    (17, [19, 56], 12, "Docx: bilet_17 — буферы + полисахариды + дикаптол"),
    (18, [16, 37], 6, "Docx: 18.docx — растворимость + SN + протонирование (никотинамид)"),
    (19, [20, 51], 7, "Docx: 19.docx — буферные системы + пептиды + изолимонная кислота"),
    (20, [22, 52], 2, "Docx: 20.docx — дисперсные системы + моносахариды + анабазин"),
    (21, [2, 59], 22, "Docx: 21.docx — гибридизация + неомыляемые жиры + pH аскорбиновой"),
    (22, [21, 32], 4, "Docx: 22.docx — КОС/ацидоз + циклоалканы + цитозин"),
    (23, [23, 44], 14, "Docx: bilet_23 — устойчивость коллоидов + альдегиды/гидразоны"),
    (24, [27, 58], 31, "Docx: 24.docx — индуктивный/мезомерный + НК + ацидоз крови"),
    (25, [26, 57], 18, "Docx: bilet_25 — донорно-акцепторные связи + пиримидины"),
    (27, [1, 48], 19, "Docx: bilet_27 — типы связи + карбоновые кислоты"),
    (28, [6, 7], 20, "Docx: bilet_28 — Брёнстед + Льюис"),
    (29, [28, 29], 21, "Docx: bilet_29 — пространственное строение + стереоизомерия"),
    (30, [30, 47], 15, "Docx: bilet_30 — реакционные центры + окисление альдегидов"),
    (32, [33, 52], 11, "Docx: bilet_32 — алкены + моносахариды"),
    (33, [23, 55], 28, "Docx: bilet_33 — коллоиды + олигосахариды"),
    (34, [27, 50], 32, "Docx: bilet_34 — электронные эффекты + аминокислоты"),
    (35, [18, 17], 24, "Docx: bilet_35 — тоничность + коллигативные свойства"),
]


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


def to_chem_question(q: dict) -> dict:
    text = q["question"]
    if not text.startswith("**"):
        text = f"**{text}**"
    return {"id": q["id"], "question": text, "answer": q.get("answer", "")}


def to_chem_task(t: dict) -> dict:
    return {"id": t["id"], "question": t["question"], "answer": t.get("answer", "")}


def build_chem_tickets() -> list:
    chem_q = load_json("chem_questions.json")
    chem_t = load_json("chem_tasks.json")
    visible_q = [q for q in chem_q if q.get("visible", True) is not False]

    out: list = []
    used_q: set[int] = set()
    used_t: set[int] = set()
    official_nums: set[int] = set()

    for num, qids, tid, note in CHEM_TICKETS:
        official_nums.add(num)
        used_q.update(qids)
        used_t.add(tid)
        out.append(
            {
                "id": num,
                "ticketNumber": str(num),
                "note": note,
                "questions": [to_chem_question(q_by_id(visible_q, qid)) for qid in qids],
                "task": to_chem_task(task_by_id(chem_t, tid)),
            }
        )

    unused_q = sorted((q for q in visible_q if int(q["id"]) not in used_q), key=lambda x: int(x["id"]))
    unused_t = sorted((t for t in chem_t if int(t["id"]) not in used_t), key=lambda x: int(x["id"]))
    missing = [n for n in range(1, CHEM_TICKET_TOTAL + 1) if n not in official_nums]

    for i, num in enumerate(missing):
        if i * 2 + 1 >= len(unused_q) or i >= len(unused_t):
            break
        q1, q2 = unused_q[i * 2], unused_q[i * 2 + 1]
        used_q.update((int(q1["id"]), int(q2["id"])))
        used_t.add(int(unused_t[i]["id"]))
        out.append(
            {
                "id": num,
                "ticketNumber": str(num),
                "note": "Собран из неиспользованных вопросов/задач",
                "questions": [to_chem_question(q1), to_chem_question(q2)],
                "task": to_chem_task(unused_t[i]),
            }
        )

    out.sort(key=lambda t: int(t["ticketNumber"]))
    return out


def main() -> None:
    tickets = build_chem_tickets()
    save_json("chem_tickets.json", tickets)
    docx = sum(1 for t in tickets if str(t.get("note", "")).startswith("Docx"))
    filled = len(tickets) - docx
    print(f"chem_tickets.json: {len(tickets)} tickets ({docx} docx + {filled} filled)")


if __name__ == "__main__":
    main()
