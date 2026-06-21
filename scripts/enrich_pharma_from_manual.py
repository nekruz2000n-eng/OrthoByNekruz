# -*- coding: utf-8 -*-
"""Enrich pharma_questions.json with KrasGMU departmental manual (Олохова Е.А.)."""
from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MANUAL = ROOT / "scripts" / "_pharma_manual_text.txt"
QUESTIONS = ROOT / "src" / "data" / "pharma_questions.json"
MARKER = "## По методичке кафедры (КрасГМУ)"

# Generic pharmacokinetics intro wrongly attached to many unrelated questions.
GENERIC_MANUAL_FINGERPRINT = "ОБЩАЯ ФАРМАКОЛОГИЯ ФАРМАКОКИНЕТИКА"

# Ordered anchors in the departmental manual (later anchor ends previous block).
ANCHORS: list[tuple[str, str]] = [
    ("ОБЩАЯ ФАРМАКОЛОГИЯ", "general_intro"),
    ("Пути введения лекарственных средств", "routes"),
    ("РАСПРЕДЕЛЕНИЕ ЛЕКАРСТВЕННЫХ ВЕЩЕСТВ", "distribution"),
    ("ДЕПОНИРОВАНИЕ ЛЕКАРСТВЕННЫХ ВЕЩЕСТВ", "depot"),
    ("БИОТРАНСФОРМАЦИЯ ЛЕКАРСТВЕННЫХ ВЕЩЕСТВ", "biotransform"),
    ("ВЫВЕДЕНИЕ ЛЕКАРСТВЕННЫХ ВЕЩЕСТВ", "excretion"),
    ("ФАРМАКОДИНАМИКА включает", "pharmacodynamics"),
    ("Местно-анестезирующие средства", "local_anesth"),
    ("Механизм действия. Местные анестетики", "local_anesth_mech"),
    ("АНТИСЕПТИЧЕСКИЕ И ДЕЗИНФИЦИРУЮЩИЕ СРЕДСТВА", "antiseptics"),
    ("ПЕНИЦИЛЛИНЫ", "penicillins"),
    ("ЦЕФАЛОСПОРИНЫ", "cephalosporins"),
    ("МАКРОЛИДЫ", "macrolides"),
    ("АМИНОГЛИКОЗИДЫ", "aminoglycosides"),
    ("ТЕТРАЦИКЛИНЫ", "tetracyclines"),
    ("ЛИНКОЗАМИДЫ", "lincosamides"),
    ("КЛАССИФИКАЦИЯ НПВС", "nsaid"),
    ("ФАРМАКОДИНАМИКА НПВС", "nsaid_pd"),
    ("СРЕДСТВА, РЕГУЛИРУЮЩИЕ ПРОЦЕССЫ ОБМЕНА", "metabolism"),
    ("АНТИПСИХОТИЧЕСКИЕ СРЕДСТВА", "antipsych"),
    ("АНКСИОЛИТИЧЕСКИЕ СРЕДСТВА", "anxiolytics"),
    ("СРЕДСТВА ДЛЯ ИНГАЛЯЦИОННОГО НАРКОЗА", "inhal_anesth"),
    ("СРЕДСТВА ДЛЯ НЕИНГАЛЯЦИОННОГО НАРКОЗА", "iv_anesth"),
    ("АНАЛЬГЕЗИРУЮЩИЕ", "analgesics"),
    ("ХОЛИНОМИМЕТИЧЕСКИЕ СРЕДСТВА", "cholinomimetics"),
    ("СРЕДСТВА, БЛОКИРУЮЩИЕ ХОЛИНЕРГИЧЕСКИЕ", "anticholinergics"),
    ("СРЕДСТВА ДЛЯ ПРОФИЛАКТИКИ И ЛЕЧЕНИЯ ТРОМБОЗА", "antithrombotic"),
    ("ФАРМАКОЛОГИЧЕСКАЯ ХАРАКТЕРИСТИКА ЛС, ВЛИЯЮЩИХ НА ГЕМОСТАЗ", "hemostasis"),
]

SKIP_SENTENCE = re.compile(
    r"методы обучения|цели обучения|место проведения|обучающийся должен|"
    r"фгбоу|тема\s*№|разновидность занятия|оснащение занятия|"
    r"рекомендован к изданию|составители:|сборник методических|"
    r"^rp\.:|^d\.t\.d\.|^s\.|в родительном падеже",
    re.I,
)


def reflow_pdf(text: str) -> str:
    text = text.replace("\u0306", "")
    text = re.sub(r" +", " ", text)
    # join broken lines inside paragraphs
    lines = [ln.strip() for ln in text.splitlines()]
    merged: list[str] = []
    buf = ""
    for ln in lines:
        if not ln:
            if buf:
                merged.append(buf)
                buf = ""
            continue
        if not buf:
            buf = ln
            continue
        if re.search(r"[.!?:;]$", buf) or re.match(r"^[а-яa-z(]", ln):
            merged.append(buf)
            buf = ln
        else:
            buf += " " + ln
    if buf:
        merged.append(buf)
    return "\n".join(merged)


def normalize(text: str) -> str:
    t = text.lower().replace("ё", "е")
    t = re.sub(r"[^\w\s]", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def extract_sections(text: str) -> dict[str, str]:
    text = reflow_pdf(text)
    hits: list[tuple[int, str, str]] = []
    for anchor, key in ANCHORS:
        idx = text.find(anchor)
        if idx >= 0:
            hits.append((idx, key, anchor))
    hits.sort(key=lambda x: x[0])
    sections: dict[str, str] = {}
    for i, (idx, key, _anchor) in enumerate(hits):
        end = hits[i + 1][0] if i + 1 < len(hits) else len(text)
        body = text[idx:end].strip()
        if key in sections:
            sections[key] += "\n\n" + body
        else:
            sections[key] = body
    return sections


def sentences(text: str) -> list[str]:
    text = reflow_pdf(text)
    parts = re.split(r"(?<=[.!?])\s+", text)
    out: list[str] = []
    for p in parts:
        s = p.strip()
        if len(s) < 45 or len(s) > 420:
            continue
        if SKIP_SENTENCE.search(s):
            continue
        if re.match(r"^[a-z(]", s) and not re.match(r"^(per|sub|iso|intra)", s, re.I):
            continue
        if s.count(",") > 8 and len(s) > 200:
            continue
        out.append(s)
    return out


def pick_sections(qid: int, qtext: str) -> list[str]:
    t = normalize(qtext)
    keys: list[str] = []

    def has(*words: str) -> bool:
        return any(w in t for w in words)

    if qid <= 7 or has("пут", "введен", "энтераль", "парентераль", "перораль", "сублингв", "ректаль", "неотложн"):
        keys += ["routes", "general_intro"]
    if 8 <= qid <= 10 or has("всасыван", "диффуз", "транспорт", "биодоступност"):
        keys += ["general_intro", "routes"]
    if 11 <= qid <= 13 or has("распредел", "барьер", "гэб", "плацент"):
        keys += ["distribution", "general_intro"]
    if 14 <= qid <= 17 or has("биотрансформ", "метабол", "конъюгац", "cyp", "цитохром", "пролекар"):
        keys += ["biotransform"]
    if 18 <= qid <= 20 or has("депонир"):
        keys += ["depot"]
    if 21 <= qid <= 22 or has("выведен", "экскрец", "почечн"):
        keys += ["excretion"]
    if qid == 20 or has("полувывед", "клиренс", "элиминац"):
        keys += ["excretion"]
    if 23 <= qid <= 38 or has("фармакодинам", "агонист", "антагонист", "рецептор", "доз", "взаимодейств", "синерг", "антагонизм", "кумуляц", "привыкан", "тахифилакс", "зависимост"):
        keys += ["pharmacodynamics", "general_intro"]
    if has("местн", "анестет", "новокаин", "лидокаин"):
        keys += ["local_anesth", "local_anesth_mech"]
    if has("холин", "атропин", "пилокарпин", "миорелакс"):
        keys += ["cholinomimetics", "anticholinergics"]
    if has("адрен", "норадрен", "симпатомим", "блокатор"):
        keys += ["pharmacodynamics"]
    if has("антисепт", "дезинфиц", "хлоргексидин", "мирамистин"):
        keys += ["antiseptics"]
    if has("пенициллин", "амоксициллин", "аугментин"):
        keys += ["penicillins"]
    if has("цефалоспорин", "цефазолин", "цефтриаксон"):
        keys += ["cephalosporins"]
    if has("макролид", "эритромицин", "азитромицин", "кларитромицин"):
        keys += ["macrolides"]
    if has("аминогликозид", "гентамицин", "амикацин"):
        keys += ["aminoglycosides"]
    if has("тетрациклин", "доксициклин"):
        keys += ["tetracyclines"]
    if has("линкомицин", "клиндамицин"):
        keys += ["lincosamides"]
    if has("нпвс", "противовоспалит", "аспирин", "диклофенак", "ибупрофен", "индометацин"):
        keys += ["nsaid", "nsaid_pd"]
    if has("глюкокортик", "кортикостероид", "преднизолон", "дексаметазон"):
        keys += ["metabolism"]
    if has("антигистамин", "блокатор h1", "лоратадин", "дифенгидрамин"):
        keys += ["metabolism"]
    if has("витамин", "кальци", "фтор", "остеопороз"):
        keys += ["metabolism"]
    if has("наркот", "анальгет", "морфин", "фентанил", "трамадол"):
        keys += ["analgesics"]
    if has("транквилиз", "бензодиазепин", "седатив", "снотвор"):
        keys += ["anxiolytics"]
    if has("наркоз", "анестез", "тиопентал", "пропофол", "галотан"):
        keys += ["inhal_anesth", "iv_anesth"]
    if has("противосудорож", "фенитоин", "карбамазепин", "вальпро"):
        keys += ["analgesics", "pharmacodynamics"]
    if has("антикоагул", "гепарин", "варфарин", "тромб"):
        keys += ["antithrombotic", "hemostasis"]
    if has("нитроглицерин", "стенокард", "антиангин", "сердечно", "гипертенз"):
        keys += ["pharmacodynamics"]
    if 39 <= qid <= 42 or has("возраст", "пол как фактор", "хронофармак", "фармакогенет", "сопутствующ", "полипрагмаз"):
        keys += ["distribution", "biotransform", "excretion"]
    if has("рецепт", "пропис", "таблетк", "мазь", "линимент", "суппозитор"):
        keys += ["general_intro"]

    # dedupe preserve order
    seen: set[str] = set()
    ordered: list[str] = []
    for k in keys:
        if k not in seen:
            seen.add(k)
            ordered.append(k)
    return ordered[:3]


def new_sentences(answer: str, bodies: list[str], limit: int = 5) -> list[str]:
    ans_n = normalize(answer)
    picked: list[str] = []
    seen: set[str] = set()
    for body in bodies:
        for s in sentences(body):
            sn = normalize(s)
            if sn in seen:
                continue
            words = [w for w in sn.split() if len(w) > 4]
            if len(words) < 3:
                continue
            hit = sum(1 for w in words if w in ans_n)
            if hit / len(words) > 0.65:
                continue
            seen.add(sn)
            clean = re.sub(r"\s*\n\s*", " ", s).strip()
            picked.append(clean if clean.endswith((".", "!", "?")) else clean + ".")
            if len(picked) >= limit:
                return picked
    return picked


def is_generic_manual_block(block: str) -> bool:
    return GENERIC_MANUAL_FINGERPRINT in block


def strip_old_block(answer: str) -> str:
    if MARKER not in answer:
        return answer.rstrip()
    return answer.split(MARKER)[0].rstrip()


def strip_generic_manual(answer: str) -> str:
    if MARKER not in answer:
        return answer.rstrip()
    base, block = answer.split(MARKER, 1)
    if is_generic_manual_block(block):
        return base.rstrip()
    return answer.rstrip()


def enrich_question(q: dict, sections: dict[str, str]) -> tuple[dict, int]:
    qid = q["id"]
    qtext = re.sub(r"\*\*([^*]+)\*\*", r"\1", q["question"])
    base = strip_old_block(q["answer"])
    keys = pick_sections(qid, qtext)
    if not keys:
        return {**q, "answer": base}, 0
    bodies = [sections[k] for k in keys if k in sections]
    added = new_sentences(base, bodies, limit=5)
    if not added:
        return q, 0
    block = MARKER + "\n\n" + "\n".join(f"- {s}" for s in added)
    return {**q, "answer": base + "\n\n" + block}, len(added)


def main() -> None:
    manual = reflow_pdf(MANUAL.read_text(encoding="utf-8"))
    MANUAL.write_text(manual, encoding="utf-8")
    sections = extract_sections(manual)
    questions = json.loads(QUESTIONS.read_text(encoding="utf-8"))

    touched = 0
    total = 0
    updated: list[dict] = []
    for q in questions:
        nq, n = enrich_question(q, sections)
        updated.append(nq)
        if n:
            touched += 1
            total += n

    QUESTIONS.write_text(
        json.dumps(updated, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"sections: {len(sections)}")
    print(f"updated: {touched}/{len(updated)}, sentences: {total}")

    # refresh glossary from enriched answers
    subprocess.run(
        ["python", str(ROOT / "scripts" / "build_pharma_subject.py"), "--glossary-only"],
        check=True,
    )


if __name__ == "__main__":
    main()
