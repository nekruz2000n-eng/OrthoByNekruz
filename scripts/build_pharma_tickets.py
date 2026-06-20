#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Build official pharma exam tickets from student-reported mappings."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "src" / "data"

# ticket_number -> (q1_id, q2_id, task_id, note)
# Question/task IDs match pharma_questions.json / pharma_tasks.json (not line numbers).
TICKET_MAP: dict[int, tuple[int, int, int, str]] = {
    2:  (1,   84,  1,  "Фото билета 2 — энтеральные, гипертонический криз, анальгетик"),
    3:  (4,   70,  2,  "Экзаменационный билет №3 — парентеральные, противогрибковые, диазепам"),
    4:  (11,  78,  4,  "Билет 4 — распределение, противовирусные, аллергический хейлит"),
    5:  (20,  66,  5,  "Билет 5 — элиминация, метронидазол, травматический шок"),
    6:  (14,  69,  10, "Фарма 6 — биотрансформация, фторхинолоны, вяжущее (таннин)"),
    11: (30,  63,  14, "Билет 11 — синергизм, пенициллины, адреналин при анафилаксии"),
    12: (28,  65,  19, "Фото билета 12 — дозы, макролиды, нитроглицерин"),
    14: (44,  59,  15, "Фото билета 14 — тератогенность, НПВС, моксифлоксацин"),
    15: (91,  81,  18, "Билет 15 — отравления/антидоты, витамины, кандидоз"),
    16: (8,   81,  22, "Билет 16 — фармакокинетика/всасывание, витамины, азитромицин"),
    17: (1,   62,  20, "Билет 17 — энтеральные, ГКС, каптоприл при гиперт. кризе"),
    22: (22,  86,  5,  "Билет 22 — мишени/агонисты, стенокардия, травматический шок"),
    24: (26,  45,  24, "Билет 24 — обратимое/необратимое, виды терапии (ЖКТ*), фурацилин"),
    26: (29,  79,  3,  "Билет 26 — взаимодействие ЛС, транквилизаторы, клиндамицин"),
    29: (44,  54,  24, "Билет 29 — тератогенность, адреналин, йод* (замена: фурацилин)"),
    31: (1,   58,  17, "Билет 31 — энтеральные, наркот. анальгетики, сальбутамол"),
    32: (4,   86,  8,  "Билет 32 — парентеральные, нитраты* (Q86), витамин B6"),
    33: (25,  62,  12, "Фото билета 33 — виды действия, ГКС, транексамовая кислота"),
    34: (33,  59,  17, "Билет 34 — привыкание, НПВС, сальбутамол"),
    37: (28,  63,  21, "Фото билета 37 — дозы, пенициллины, нашатырный спирт"),
    38: (45,  64,  20, "Билет 38 — виды терапии, цефалоспорины, каптоприл"),
    39: (44,  68,  14, "Билет 39 — тератогенность, аминогликозиды, адреналин* (пролонг. МА)"),
}

# Tickets mentioned without enough detail to map
UNKNOWN_TICKETS = [1, 7, 8, 9, 10, 13, 18, 19, 20, 21, 23, 25, 27, 28, 30, 35, 36, 40]

# Known content gaps (best-effort mapping)
GAPS = [
    "Билет 24: нет отдельной задачи про активированный уголь / диклофенак при артралгии ВНЧС",
    "Билет 29: йодосодержащие — только в вопросе про антисептики (Q1335), не отдельный билетный блок",
    "Билет 32: нитраты — частично в Q1619 (нитроглицерин), отдельного вопроса нет",
    "Билет 39: задача «пролонгирование МА» — заменена на адреналин (ближайший аналог)",
    "Билет 5: фурацилин — в задаче 24, не в теор. вопросе",
    "Билеты без данных от студентов: " + ", ".join(str(n) for n in UNKNOWN_TICKETS),
]


def load_items(path: Path) -> dict[int, dict]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    out: dict[int, dict] = {}
    for item in raw:
        iid = int(item["id"])
        out[iid] = item
    return out


def to_exam_item(item: dict, fallback_id: str) -> dict:
    return {
        "id": item.get("id", fallback_id),
        "question": str(item.get("question", "")).strip(),
        "answer": str(item.get("answer", "")).strip(),
    }


def main() -> int:
    questions = load_items(DATA / "pharma_questions.json")
    tasks = load_items(DATA / "pharma_tasks.json")

    tickets = []
    errors = []

    for num in sorted(TICKET_MAP):
        q1_id, q2_id, t_id, note = TICKET_MAP[num]
        missing = []
        for label, pool, iid in [("Q1", questions, q1_id), ("Q2", questions, q2_id), ("Task", tasks, t_id)]:
            if iid not in pool:
                missing.append(f"{label}#{iid}")

        if missing:
            errors.append(f"Билет {num}: нет в базе — {', '.join(missing)}")
            continue

        tickets.append({
            "id": num,
            "ticketNumber": str(num),
            "note": note,
            "questions": [
                to_exam_item(questions[q1_id], f"t{num}_q1"),
                to_exam_item(questions[q2_id], f"t{num}_q2"),
            ],
            "task": to_exam_item(tasks[t_id], f"t{num}_task"),
        })

    out_path = DATA / "pharma_tickets.json"
    out_path.write_text(
        json.dumps(tickets, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    report = {
        "mapped_tickets": len(tickets),
        "ticket_numbers": [t["ticketNumber"] for t in tickets],
        "unknown_ticket_numbers": UNKNOWN_TICKETS,
        "gaps": GAPS,
        "errors": errors,
    }
    report_path = DATA / "pharma_tickets_report.json"
    report_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print(f"tickets: {len(tickets)} -> {out_path.name}")
    print(f"mapped:  {', '.join(report['ticket_numbers'])}")
    print(f"unknown: {', '.join(str(n) for n in UNKNOWN_TICKETS)}")
    if errors:
        print("ERRORS:")
        for e in errors:
            print(f"  - {e}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
