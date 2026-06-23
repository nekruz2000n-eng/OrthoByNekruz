# -*- coding: utf-8 -*-
"""Build bio_questions_therapeutic.json from KrasGMU lech PDF + stom/ped answers."""
from __future__ import annotations

import json
import re
from difflib import SequenceMatcher
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LECH_LIST = Path(__file__).resolve().parent / "_lech_questions.json"
STOM_PATH = ROOT / "src" / "data" / "bio_questions_stomatology.json"
PED_PATH = ROOT / "src" / "data" / "bio_questions_pediatrics.json"
OUT_PATH = ROOT / "src" / "data" / "bio_questions_therapeutic.json"

# lech question number -> (bank, source ids)
SOURCE_MAP: dict[int, tuple[str, list[int]]] = {
    1: ("stom", [1]), 2: ("stom", [2]), 3: ("stom", [3]), 4: ("stom", [4, 5]),
    5: ("stom", [6, 7]), 6: ("stom", [7]), 7: ("stom", [8]), 8: ("stom", [9]),
    9: ("custom", []), 10: ("stom", [11]), 11: ("stom", [12]),
    12: ("ped", [5]), 13: ("stom", [14]), 14: ("ped", [6]), 15: ("ped", [7]),
    16: ("stom", [15]), 17: ("stom", [16]), 18: ("stom", [17]), 19: ("stom", [18]),
    20: ("stom", [19]), 21: ("stom", [20]), 22: ("stom", [21]), 23: ("stom", [22]),
    24: ("stom", [23]), 25: ("stom", [24]), 26: ("stom", [25]), 27: ("stom", [26]),
    28: ("stom", [27]), 29: ("stom", [28]), 30: ("stom", [29]), 31: ("stom", [30]),
    32: ("stom", [31]), 33: ("stom", [33]), 34: ("stom", [34]), 35: ("stom", [35]),
    36: ("stom", [36]), 37: ("stom", [37]), 38: ("stom", [38]), 39: ("stom", [39]),
    40: ("stom", [40]), 41: ("stom", [40]), 42: ("stom", [40]),
    43: ("stom", [41]), 44: ("stom", [42]), 45: ("stom", [43]), 46: ("stom", [44]),
    47: ("stom", [45]), 48: ("stom", [46]), 49: ("stom", [47]), 50: ("stom", [48]),
    51: ("stom", [49]), 52: ("stom", [50]), 53: ("stom", [51]), 54: ("stom", [52]),
    55: ("stom", [53]), 56: ("stom", [54]), 57: ("stom", [55]),
    59: ("stom", [56]), 60: ("stom", [57]), 61: ("stom", [58]), 62: ("stom", [59]),
    63: ("stom", [60]), 64: ("stom", [61]),
    65: ("stom", [62]), 66: ("stom", [63]), 67: ("stom", [64]), 68: ("stom", [65]),
    69: ("stom", [66]), 70: ("stom", [67]), 71: ("custom", []), 72: ("stom", [68]),
    73: ("stom", [69]), 74: ("stom", [70]), 75: ("stom", [71]), 76: ("stom", [72]),
    77: ("stom", [77]), 78: ("stom", [78]), 79: ("stom", [79]), 80: ("custom", []),
    81: ("custom", []), 82: ("stom", [81]), 83: ("custom", []), 84: ("stom", [83]),
    85: ("stom", [82]), 86: ("stom", [85]), 87: ("ped", [59]), 88: ("stom", [85]),
    89: ("stom", [86]), 90: ("stom", [87, 88]), 91: ("stom", [73]), 92: ("stom", [74]),
    93: ("custom", []), 94: ("stom", [75]), 95: ("stom", [76]),
}

CISTRON_APPEND = (
    "\n\n**Цистрон** — функциональная единица генетического материала, участок ДНК, "
    "кодирующий одну полипептидную цепь (или одну функциональную РНК). "
    "У прокариот в полицистронных транскриптах (оперонах) цистроны — отдельные гены, "
    "разделённые сайтами начала и окончания трансляции. "
    "У эукариот преимущественно моноцистронная организация: один ген — одна иРНК — один белок."
)

PENETRATION_ANSWER = """**Инвазионная стадия** — стадия жизненного цикла паразита, способная проникнуть в организм хозяина и вызвать инвазию.

**Основные пути проникновения:**

**1. Пероральный (алиментарный)** — с пищей и водой.
- *Примеры:* яйца аскариды, острицы, широкого лентеца; цисты лямблий, токсоплазмы, энтамебы; личинки свиного цепня в мясе.

**2. Контактный (перкутанный, активный)** — через неповреждённую кожу или слизистые.
- *Примеры:* личинки анкилостом и некаторов («пробуравливают» кожу); церкарии шистосом (проникают через кожу в воде); личинки сильфидов (через кожу при контакте с почвой).

**3. Трансмиссивный** — через укус кровососущего переносчика.
- *Примеры:* малярийные плазмодии (через укус комара *Anopheles*); возбудители лейшманиоза (через москитов *Phlebotomus*); клещевой энцефалит (через иксодовых клещей).

**4. Воздушно-капельный / ингаляционный** — через дыхательные пути.
- *Примеры:* личинки аскарид при аспирации; некоторые гельминты и простейшие при вдыхании пыли с яйцами.

**5. Трансплацентарный (внутриутробный)** — от матери к плоду.
- *Примеры:* токсоплазма, малярия, сифилис, ВИЧ.

**6. Парентеральный** — через медицинские манипуляции, травмы, инъекции.
- *Примеры:* занесение яиц гельминтов грязными инструментами; заражение при переливании крови.

**7. Половой** — при половом контакте.
- *Примеры:* трихомона (*Trichomonas vaginalis*).

**Активная инвазия** — паразит сам проникает (перкутанный путь). **Пассивная** — попадает без активных движений (алиментарный, трансмиссивный). Знание пути проникновения определяет профилактику: кипячение воды, мытьё рук, защита от насекомых, термическая обработка мяса, дегельминтизация животных."""

PROTOZOA_PARASITE_ANSWER = """**Паразитизм у простейших** — облигатный или факультативный образ жизни в организме хозяина (внутриклеточно, в полостях, в тканях).

**Приспособления к паразитизму:**

**1. Строение и покровы**
- Упрощение органел движения на взрослой стадии (у *Plasmodium*, *Toxoplasma* — отсутствие жгутиков у тканевых форм).
- Поверхностный антигенный вариабельный гликокаликс — ускользание от иммунитета (*Trypanosoma*).
- Цистозащитная оболочка — выживание во внешней среде (*Entamoeba*, *Giardia*).

**2. Питание**
- Фаготрофия, пинотрофия, осмотрофия; поглощение готовых питательных веществ хозяина.
- Редукция собственных ферментов пищеварения.

**3. Размножение**
- **Бесполое:** бинарное деление (амебы, лейшмании в клетках), множественное деление — шизогония (*Plasmodium* в эритроцитах), спорогония.
- **Половое:** конъюгация, сингамия с образованием зиготы; чередование с бесполым размножением.

**4. Жизненные циклы**
- **Прямые** — один хозяин (*Entamoeba histolytica*, *Giardia lamblia*).
- **Со сменой хозяев** — промежуточный и окончательный (*Plasmodium*: человек + комар; *Toxoplasma*: человек + кошка).
- **С обязательным переносчиком** — трансмиссивные формы (*Leishmania* в моските).

**Медицинское значение:** малярия, амебиаз, лейшманиозы, токсоплазмоз, трихомониаз — типичные паразитические простейшие; знание цикла развития необходимо для диагностики и профилактики."""


def normalize(text: str) -> str:
    text = text.replace("**", "")
    text = text.lower()
    text = re.sub(r"[^\w\s]+", " ", text, flags=re.UNICODE)
    return re.sub(r"\s+", " ", text).strip()


def similarity(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, a, b).ratio()


def format_question(text: str) -> str:
    t = text.strip()
    return t if t.startswith("**") else f"**{t}**"


def merge_answers(items: list[dict]) -> str:
    parts: list[str] = []
    seen: set[str] = set()
    for it in items:
        ans = (it.get("answer") or "").strip()
        if not ans or ans in seen:
            continue
        seen.add(ans)
        parts.append(ans)
    return "\n\n---\n\n".join(parts)


def pick_items(bank: dict[int, dict], ids: list[int]) -> list[dict]:
    return [bank[i] for i in ids if i in bank]


def answer_biogeocenosis(ped_by_id: dict[int, dict], stom_by_id: dict[int, dict]) -> str:
    ped = ped_by_id.get(51)
    if ped:
        ans = ped["answer"]
        cut = ans.find("**Компоненты экосистемы:**")
        if cut > 0:
            return ans[:cut].strip() + "\n\n" + stom_by_id[80]["answer"]
    return stom_by_id[80]["answer"]


def answer_food_chains(stom_by_id: dict[int, dict]) -> str:
    full = stom_by_id[80]["answer"]
    marker = "**Пищевые цепи"
    idx = full.find(marker)
    if idx >= 0:
        return full[idx:].strip()
    return full


def answer_water_carbon(stom_by_id: dict[int, dict]) -> str:
    return stom_by_id[82]["answer"]


def resolve_answer(
    num: int,
    lech_text: str,
    stom_by_id: dict[int, dict],
    ped_by_id: dict[int, dict],
) -> tuple[str, list[int], str]:
    bank, ids = SOURCE_MAP.get(num, ("stom", []))

    if num == 9:
        base = stom_by_id[10]["answer"] + CISTRON_APPEND
        return base, [10], "stom"

    if num == 71:
        return PENETRATION_ANSWER, [67], "custom"

    if num == 80:
        return answer_biogeocenosis(ped_by_id, stom_by_id), [51, 80], "ped+stom"

    if num == 81:
        return answer_food_chains(stom_by_id), [80], "stom"

    if num == 83:
        return answer_water_carbon(stom_by_id), [82, 83], "stom"

    if num == 93:
        return PROTOZOA_PARASITE_ANSWER, [], "custom"

    if bank == "custom" and not ids:
        bank, ids = "stom", []

    if ids:
        src_bank = stom_by_id if bank == "stom" else ped_by_id
        items = pick_items(src_bank, ids)
        if items:
            ans = merge_answers(items) if len(items) > 1 else items[0]["answer"]
            return ans, ids, bank

    # fuzzy fallback
    ln = normalize(lech_text)
    best, best_ratio, best_bank = None, 0.0, "stom"
    for item in stom_by_id.values():
        r = similarity(ln, normalize(item["question"]))
        if r > best_ratio:
            best_ratio, best, best_bank = r, item, "stom"
    for item in ped_by_id.values():
        r = similarity(ln, normalize(item["question"]))
        if r > best_ratio:
            best_ratio, best, best_bank = r, item, "ped"
    if best and best_ratio >= 0.55:
        return best["answer"], [int(best["id"])], f"{best_bank}:fuzzy"

    return (
        "_Ответ готовится. Ориентируйся на конспект кафедры биологии по теме вопроса._",
        [],
        "stub",
    )


def main() -> None:
    lech_items = json.loads(LECH_LIST.read_text(encoding="utf-8"))
    stom = json.loads(STOM_PATH.read_text(encoding="utf-8"))
    ped = json.loads(PED_PATH.read_text(encoding="utf-8"))
    stom_by_id = {int(x["id"]): x for x in stom}
    ped_by_id = {int(x["id"]): x for x in ped}

    out: list[dict] = []
    stats: dict[str, int] = {}

    for lech in lech_items:
        num = int(lech["num"])
        text = lech["text"]
        answer, source_ids, src_kind = resolve_answer(num, text, stom_by_id, ped_by_id)
        stats[src_kind] = stats.get(src_kind, 0) + 1

        base = None
        if source_ids:
            bank = stom_by_id if src_kind.startswith("stom") else ped_by_id
            if src_kind == "ped":
                bank = ped_by_id
            first_id = source_ids[0]
            base = bank.get(first_id) or stom_by_id.get(first_id)

        entry = {
            "id": num,
            "question": format_question(text),
            "answer": answer,
            "topic": (base or {}).get("topic", "biology_therapeutic"),
            "subtopic": (base or {}).get("subtopic") or f"Лечебное дело · вопрос {num}",
            "difficulty": (base or {}).get("difficulty", "medium"),
            "game_modes": (base or {}).get("game_modes", ["flashcard", "quiz"]),
            "key_facts": (base or {}).get("key_facts", []),
            "repeat_interval": (base or {}).get("repeat_interval", 3),
            "exam_weight": (base or {}).get("exam_weight", 2),
            "faculty": ["therapeutic"],
            "subject": "biology",
            "visible": True,
            "premium": True,
            "source_stom_ids": source_ids if src_kind.startswith("stom") or "stom" in src_kind else [],
            "source_kind": src_kind,
        }
        out.append(entry)

    OUT_PATH.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"therapeutic: {len(out)} questions -> {OUT_PATH.name}")
    print("sources:", stats)
    stubs = [x for x in out if x["source_kind"] == "stub"]
    if stubs:
        print("STUBS:", [x["id"] for x in stubs])


if __name__ == "__main__":
    main()
