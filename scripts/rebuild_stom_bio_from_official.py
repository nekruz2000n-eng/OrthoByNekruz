# -*- coding: utf-8 -*-
"""Rebuild bio_questions_stomatology.json to match official KrasGMU stom PDF (88 questions)."""
from __future__ import annotations

import json
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OLD_PATH = ROOT / "scripts" / "_stom_bio_pre_rebuild.json"
OUT_PATH = ROOT / "src" / "data" / "bio_questions_stomatology.json"
LEGACY_PATH = ROOT / "src" / "data" / "bio_questions.json"
OFFICIAL_PATH = ROOT / "scripts" / "_stom_questions.json"

# new_num -> list of old ids to merge (first item donates metadata)
SOURCE_MAP: dict[int, list[int]] = {
    1: [1], 2: [2], 3: [3], 4: [4], 5: [4], 6: [5], 7: [6], 8: [7], 9: [8],
    10: [9], 11: [10], 12: [11], 14: [13], 15: [16], 16: [17], 17: [18], 18: [19],
    19: [20], 20: [23], 21: [24], 22: [25], 23: [21], 24: [22], 25: [25, 21],
    26: [26], 27: [27], 28: [28], 29: [29], 30: [30], 31: [31], 32: [32], 33: [33],
    34: [34], 35: [35], 36: [36], 37: [37], 38: [38], 39: [39], 40: [40, 41],
    41: [43], 42: [44], 43: [44], 44: [45], 45: [46], 46: [47], 47: [48],
    48: [49], 49: [50], 50: [51], 51: [52], 52: [53], 53: [54], 54: [55],
    55: [56], 56: [57], 57: [58], 58: [59, 60], 59: [61], 60: [62], 61: [63],
    62: [64], 63: [65], 65: [66], 66: [67], 67: [68], 68: [70], 69: [71],
    70: [71], 71: [72], 72: [73], 73: [86], 74: [87], 75: [88], 76: [89],
    77: [74], 78: [75], 79: [76], 80: [77], 81: [78], 82: [79], 83: [80, 81],
    84: [84, 65], 85: [83], 86: [84], 87: [85], 88: [85],
}


def fmt_q(text: str) -> str:
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


def split_prokaryote(answer: str) -> str:
    m = re.search(r"\*\*Прокариоты.*?(?=\n\n\*\*Эукариоты|\Z)", answer, re.S)
    intro = "Все клетки делятся на два принципиальных типа — прокариотические и эукариотические.\n\n"
    return intro + (m.group(0).strip() if m else answer)


def split_eukaryote(answer: str) -> str:
    m = re.search(r"\*\*Эукариоты.*?(?=\n\n\*\*Общее|\Z)", answer, re.S)
    tail = re.search(r"\*\*Общее у обоих типов:.*", answer, re.S)
    body = m.group(0).strip() if m else answer
    if tail:
        body += "\n\n" + tail.group(0).strip()
    return body


def trim_cistron(answer: str) -> str:
    return re.sub(r"\n\n\*\*Цистрон\*\*.*", "", answer, flags=re.S).strip()


def trim_regulation(answer: str) -> str:
    answer = re.sub(r"\n\n\*\*Регуляция транскрипции.*", "", answer, flags=re.S)
    answer = re.sub(r"\n\n\*\*Регуляция трансляции.*", "", answer, flags=re.S)
    return answer.strip()


def split_gastrulation(answer: str) -> str:
    cut = answer.find("**Производные зародышевых листков:**")
    if cut == -1:
        cut = answer.find("**Гистогенез**")
    return answer[:cut].strip() if cut > 0 else answer


def split_embryo_derivatives(answer: str) -> str:
    start = answer.find("**Способы образования мезодермы")
    if start == -1:
        start = answer.find("**Производные зародышевых листков:**")
    return answer[start:].strip() if start >= 0 else answer


def split_susceptibility(answer: str) -> str:
    m = re.search(
        r"\*\*Факторы, влияющие на восприимчивость.*?(?=\n\n\*\*Виды иммунитета|\Z)",
        answer,
        re.S,
    )
    return m.group(0).strip() if m else answer


def split_immunity(answer: str) -> str:
    m = re.search(r"\*\*Виды иммунитета против паразитов:\*\*.*", answer, re.S)
    return m.group(0).strip() if m else answer


def split_vernadsky(answer: str) -> str:
    m = re.search(r"\*\*Антропогенные факторы\*\*.*?(?=\n\n\*\*Ноосфера|\Z)", answer, re.S)
    return m.group(0).strip() if m else answer


def split_noosphere(answer: str) -> str:
    m = re.search(r"\*\*Ноосфера\*\*.*", answer, re.S)
    return m.group(0).strip() if m else answer


ANSWER_OVERRIDES: dict[int, str] = {
    13: (
        "**Белки** — высокомолекулярные полимеры, построенные из α-аминокислот, соединённых пептидными связями. "
        "Являются главными структурными и функциональными молекулами клетки.\n\n"
        "**Уровни организации белков:**\n"
        "1. *Первичная структура* — линейная последовательность аминокислот.\n"
        "2. *Вторичная* — локальные конформации (α-спираль, β-складчатые структуры) за счёт водородных связей.\n"
        "3. *Третичная* — пространственное сворачивание всей полипептидной цепи.\n"
        "4. *Четвертичная* — ассоциация нескольких субъединиц (например, гемоглобин).\n\n"
        "**Виды белков:** простые (только аминокислоты) и сложные (с простетической группой: глико-, липо-, нуклео-, металлобелки).\n\n"
        "**Свойства:** амфотерность, способность к денатурации и ренатурации, каталитическая активность у ферментов, "
        "высокая специфичность.\n\n"
        "**Функции:** структурная (коллаген, актин), ферментативная, транспортная (гемоглобин), защитная (иммуноглобулины), "
        "регуляторная (гормоны), сократительная (миозин), запасающая (ферритин)."
    ),
    22: (
        "**Размножение организмов** — воспроизведение себе подобных, обеспечивающее преемственность жизни.\n\n"
        "**Виды размножения:**\n"
        "- *Бесполое* — одна родительская особь, без гамет; потомство генетически идентично (клоны).\n"
        "- *Половое* — участие гамет, рекомбинация генетического материала.\n\n"
        "**Бесполое размножение — формы и примеры:**\n"
        "- Деление (бинарное у бактерий, митотическое у простейших).\n"
        "- Почкование (дрожжи, гидра).\n"
        "- Фрагментация и регенерация (планарии).\n"
        "- Спорообразование (плесневые грибы, папоротники).\n"
        "- Вегетативное (клубни картофеля, черенкование).\n"
        "- Партеногенез (тли, пчёлы-трутни)."
    ),
    25: (
        "**Размножение** — свойство живых систем воспроизводить себе подобных.\n\n"
        "**Виды размножения и отличительные признаки:**\n"
        "- *Бесполое* — одна особь, без оплодотворения, клоны.\n"
        "- *Половое* — гаметы, рекомбинация, повышенное разнообразие.\n\n"
        "**Бесполое размножение:**\n"
        "- *Шизогония (множественное деление)* — ядро делится многократно, затем цитоплазма делится на дочерние клетки "
        "(малярийный плазмодий, трипаносомы).\n"
        "- *Амитоз* — прямое деление ядра без образования хромосом и веретена (клетки печени, патологические состояния).\n"
        "- *Эндомитоз* — повторные деления ядра без деления цитоплазмы → полиплоидные клетки.\n"
        "- *Политения* — многократное удвоение хромосом без деления ядра; гигантские полихромосомные хромосомы "
        "(слюнные железы личинок двукрылых)."
    ),
    30: "",  # patched via PATCHES
    45: "",
    50: "",
    52: "",
    69: "",
    78: "",
    64: (
        "**Экология** — наука о взаимоотношениях организмов между собой и с окружающей средой.\n\n"
        "**Среда** в экологии — совокупность факторов, влияющих на организм (абиотических, биотических, антропогенных).\n\n"
        "**Классификация сред обитания:**\n"
        "- *Водная* (пресная, морская) — плотность, освещённость, солёность, течение.\n"
        "- *Наземно-воздушная* — температура, влажность, свет, ветер, рельеф.\n"
        "- *Почвенная* — структура почвы, влажность, pH, аэрация.\n"
        "- *Организменная (биотоп)* — внутренние полости и ткани хозяина у паразитов и симбионтов."
    ),
    84: (
        "**Биосфера** — глобальная экосистема Земли.\n\n"
        "**Живое вещество** — совокупность всех живых организмов и продуктов их жизнедеятельности; активно преобразует "
        "вещество и энергию планеты (по В.И. Вернадскому).\n\n"
        "**Геохимическая работа живого** — концентрирование, рассеивание и перераспределение химических элементов "
        "в литосфере, гидросфере и атмосфере под влиянием организмов.\n\n"
        "**Биологический круговорот** — замкнутое движение веществ через живые организмы и среду.\n\n"
        "**Роль живого вещества:** поддержание газового состава атмосферы, почвообразование, круговорот биогенных "
        "элементов, ускорение геохимических реакций в миллионы раз по сравнению с неживой природой."
    ),
}

PATCHES = {
    30: {
        "answer_append": (
            "\n\n**Аллельные гены** — разные формы одного гена, занимающие одинаковое положение (локус) "
            "на гомологичных хромосомах.\n\n"
            "**Аллельное исключение** — в гетерозиготе экспрессируется только один аллель (например, на Х-хромосоме у млекопитающих)."
        ),
        "question_replace": (
            "**Аллельные гены. Взаимодействие аллельных генов в детерминации признаков: полное и неполное доминирование, "
            "кодоминирование, межаллельная комплементация, аллельное исключение, сверхдоминирование. "
            "Множественные аллели. Наследование групп крови у человека.**"
        ),
    },
    45: {
        "answer_append": (
            "\n\n**Значение нарушений частных и интегративных механизмов онтогенеза:** сбой на генном, клеточном "
            "или органном уровне регуляции (хроногены, гомеозисные гены, индукция, апоптоз) приводит к "
            "врождённым порокам развития, особенно в критические периоды."
        ),
    },
    50: {
        "answer_append": (
            "\n\n**Биологическая сущность генетического груза** — накопление в популяции рецессивных и сублетальных "
            "аллелей, которые в гетерозиготном состоянии не проявляются, но в гомозиготном снижают "
            "жизнеспособность; особенно значим у человека из-за расширенной медицинской помощи."
        ),
    },
    52: {
        "answer_replace": {
            "Формы филогенеза": "Нормы филогенеза",
            "формы филогенеза": "нормы филогенеза",
        },
    },
    69: {"use_split": "susceptibility"},
    70: {"use_split": "immunity"},
    83: {
        "answer_append": (
            "\n\n**Круговорот фосфора:** поглощение фосфатов растениями → включение в биомассу → "
            "возврат в почву и водоёмы при разложении органики → осадочные фосфаты → снова в биосферу."
        ),
    },
    87: {"use_split": "vernadsky"},
    88: {"use_split": "noosphere"},
}


def build_answer(num: int, sources: list[dict]) -> str:
    override = ANSWER_OVERRIDES.get(num)
    if override:
        return override

    patch = PATCHES.get(num, {})
    if patch.get("use_split") == "susceptibility":
        return split_susceptibility(sources[0]["answer"])
    if patch.get("use_split") == "immunity":
        return split_immunity(sources[0]["answer"])
    if patch.get("use_split") == "vernadsky":
        return split_vernadsky(sources[0]["answer"])
    if patch.get("use_split") == "noosphere":
        return split_noosphere(sources[0]["answer"])

    if num == 4:
        return split_prokaryote(sources[0]["answer"])
    if num == 5:
        return split_eukaryote(sources[0]["answer"])
    if num == 10:
        return trim_cistron(sources[0]["answer"])
    if num in (11, 12):
        return trim_regulation(sources[0]["answer"])
    if num == 40:
        return merge_answers(sources)
    if num == 42:
        return split_gastrulation(sources[0]["answer"])
    if num == 43:
        return split_embryo_derivatives(sources[0]["answer"])
    if num == 25:
        return ANSWER_OVERRIDES[25]

    answer = merge_answers(sources)

    if "answer_append" in patch:
        answer += patch["answer_append"]
    if "answer_replace" in patch:
        for old, new in patch["answer_replace"].items():
            answer = answer.replace(old, new)

    return answer


def main() -> None:
    old_items = json.loads(OLD_PATH.read_text(encoding="utf-8"))
    by_id = {int(x["id"]): x for x in old_items}
    official = json.loads(OFFICIAL_PATH.read_text(encoding="utf-8"))

    out: list[dict] = []
    for row in official:
        num = int(row["num"])
        text = row["text"]
        patch = PATCHES.get(num, {})

        if "question_replace" in patch:
            question = patch["question_replace"]
        else:
            question = fmt_q(text)

        src_ids = SOURCE_MAP.get(num, [])
        sources = [by_id[i] for i in src_ids if i in by_id]
        base = dict(sources[0]) if sources else {}

        if num == 78 and sources:
            answer = sources[0]["answer"]
            answer = answer.replace(
                "Закон оптимума и закон ограничивающего фактора",
                "Реагирование организмов на изменение фактора",
            )
        elif ANSWER_OVERRIDES.get(num) or sources:
            answer = build_answer(num, sources)
        else:
            answer = "_Ответ готовится._"

        entry = {
            **{k: v for k, v in base.items() if k not in ("id", "question", "answer", "faculty", "subtopic")},
            "id": num,
            "question": question,
            "answer": answer,
            "subtopic": base.get("subtopic") or f"Стоматология · вопрос {num}",
            "faculty": ["stomatology"],
            "subject": "biology",
            "visible": True,
            "premium": True,
        }
        out.append(entry)

    OUT_PATH.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    shutil.copy2(OUT_PATH, LEGACY_PATH)
    print(f"Rebuilt {len(out)} stomatology questions -> {OUT_PATH.name}")


if __name__ == "__main__":
    main()
