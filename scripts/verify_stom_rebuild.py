import json
from pathlib import Path

d = json.loads(Path("../src/data/bio_questions_stomatology.json").read_text(encoding="utf-8"))
official = json.loads(Path("_stom_questions.json").read_text(encoding="utf-8"))

assert len(d) == 88, len(d)
assert [x["id"] for x in d] == list(range(1, 89))

by_id = {x["id"]: x for x in d}
for row in official:
    num = row["num"]
    q = by_id[num]["question"].strip("*")
    assert row["text"] in q or q in row["text"] or row["text"][:40] in q, (num, row["text"][:50], q[:50])

checks = {
    4: "прокариот",
    5: "эукариот",
    10: "Генетический код",
    13: "Белки",
    22: "Бесполое",
    25: "шизогония",
    30: "аллельное исключение",
    50: "генетического груза",
    52: "Нормы филогенеза",
    64: "Классификация сред",
    69: "восприимчивости",
    83: "фосфора",
    84: "геохимическая",
    87: "Вернадского",
    88: "Ноосфера",
}
for num, needle in checks.items():
    text = (by_id[num]["question"] + by_id[num]["answer"]).lower()
    assert needle.lower() in text, f"Q{num} missing {needle}"

forbidden = ["цистрон", "прокариот.**", "глобальные экологические проблемы"]
for num in (10, 11, 12):
    assert "цистрон" not in by_id[num]["question"].lower()
assert not any("Особенности экспрессии" in x["question"] for x in d)
assert not any("глобальные экологические" in x["question"].lower() for x in d)

print("OK: 88 questions aligned with official PDF")
